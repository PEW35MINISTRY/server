import express, {Router, Request, Response, NextFunction} from 'express';
import URL, { URLSearchParams } from 'url';
import * as log from '../../services/log.mjs';
import {Exception} from '../api-types.mjs'
import { JwtClientRequest, JwtRequest } from '../auth/auth-types.mjs';
import { isMaxRoleGreaterThan, validateNewRoleTokenList } from '../auth/auth-utilities.mjs';
import { ProfileEditRequest } from './profile-types.mjs';
import { EDIT_PROFILE_FIELDS, EDIT_PROFILE_FIELDS_ADMIN, RoleEnum, SIGNUP_PROFILE_FIELDS, SIGNUP_PROFILE_FIELDS_STUDENT } from '../../services/models/Fields-Sync/profile-field-config.mjs';
import { DB_DELETE_USER, DB_DELETE_USER_ROLE, DB_INSERT_USER_ROLE, DB_SELECT_CONTACTS, DB_SELECT_USER, DB_SELECT_USER_PROFILE, DB_SELECT_USER_ROLES, DB_UNIQUE_USER_EXISTS, DB_UPDATE_USER } from '../../services/database/queries/user-queries.mjs';
import USER from '../../services/models/userModel.mjs';
import { DB_DELETE_CIRCLE_USER_STATUS, DB_SELECT_MEMBERS_OF_ALL_CIRCLES, DB_SELECT_USER_CIRCLES } from '../../services/database/queries/circle-queries.mjs';
import createModelFromJSON from '../../services/models/createModelFromJson.mjs';
import { DATABASE_USER_ROLE_ENUM } from '../../services/database/database-types.mjs';

//UI Helper Utility
export const GET_RoleList = (request: Request, response: Response, next: NextFunction) => {
    response.status(200).send([...Object.keys(RoleEnum)]);
}

//Public URL | UI Helper to get list of fields user allowed to  edit 
export const GET_SignupProfileFields = async(request: JwtRequest, response: Response, next: NextFunction) => {

    const role: string = request.params.role || 'student';
    
    if(role.toLowerCase() === 'student')
        response.status(200).send(SIGNUP_PROFILE_FIELDS_STUDENT.map(field => field.toJSON()));
    else
        response.status(200).send(SIGNUP_PROFILE_FIELDS.map(field => field.toJSON()));
}

//Public URL | UI Helper to get list of fields user allowed to  edit 
export const GET_EditProfileFields = async(request: JwtClientRequest, response: Response, next: NextFunction) => {
    
    if(request.jwtUserRole === RoleEnum.ADMIN)
        response.status(200).send(EDIT_PROFILE_FIELDS_ADMIN.map(field => field.toJSON()));
    else
        response.status(200).send(EDIT_PROFILE_FIELDS.map(field => field.toJSON()));
}

//Verifies Unique Profile Fields for realtime validations | userID excludes profile for editing
//Uses Query Parameters: GET localhost:5000/resources/available-account?email=ethan@encouragingprayer.org&displayName=ethan
export const GET_AvailableAccount =  async (request: Request, response: Response, next: NextFunction) => { //(ALL fields and values are case insensitive)
    if(URL.parse(request.originalUrl).query === '')
        new Exception(400, `Missing Details: Please supply -email- and/or -displayName- query parameters in request.  Including -userID- excludes profile.`);

    const fieldMap:Map<string, string> = new Map(new URLSearchParams(URL.parse(request.originalUrl).query).entries());
    const result:Boolean|undefined = await DB_UNIQUE_USER_EXISTS(fieldMap, true);

    if(result === undefined) 
        response.status(400).send(`Invalid Field Request: ${Array.from(fieldMap.keys()).join(', ')}`);
    if(result === false) 
        response.status(204).send(`No Account exists for ${Array.from(fieldMap.values()).join(', ')}`);
    else
        response.status(403).send(`Account Exists`);
}
   
export const GET_publicProfile =  async (request: JwtClientRequest, response: Response, next: NextFunction) => {
    const profile:USER = await DB_SELECT_USER(new Map([['userID', request.clientID]]));

    if(profile.isValid) {
        profile.circleList = await DB_SELECT_USER_CIRCLES(profile.userID);   
        response.status(200).send(profile.toPublicJSON())   
        log.event("Returning public profile for userID: ", request.clientID);
    } else //Necessary; otherwise no response waits for timeout | Ignored if next() already replied
        next(new Exception(404, `GET_publicProfile - user  ${request.clientID} failed to parse from database and is invalid.`)); 
};

export const GET_profileAccessUserList =  async (request: JwtRequest, response: Response, next: NextFunction) => { 

    if(request.jwtUserRole === RoleEnum.ADMIN)
        response.status(200).send(await DB_SELECT_CONTACTS(request.jwtUserID));

    else if(isMaxRoleGreaterThan({testUserRole: RoleEnum.CIRCLE_LEADER, currentMaxUserRole:request.jwtUserRole}))
        response.status(200).send(await DB_SELECT_MEMBERS_OF_ALL_CIRCLES(request.jwtUserID));
}


export const GET_userProfile = async (request: JwtClientRequest, response: Response, next: NextFunction) => {
    const profile:USER = await DB_SELECT_USER_PROFILE(new Map([['userID', request.clientID]]));

    if(profile.isValid) {
        response.status(200).send(profile.toJSON())   
        log.event("Returning profile for userID: ", request.clientID);
    } else //Necessary; otherwise no response waits for timeout | Ignored if next() already replied
        next(new Exception(404, `GET_userProfile - user  ${request.clientID} failed to parse from database and is invalid.`)); 
};

export const GET_partnerProfile = async (request: JwtClientRequest, response: Response, next: NextFunction) => {     
    const profile:USER = await DB_SELECT_USER_PROFILE(new Map([['userID', request.clientID]]));

    if(profile.isValid) {
        response.status(200).send(profile.toPartnerJSON())   
        log.event("Returning partner profile for userID: ", request.clientID);
    } else //Necessary; otherwise no response waits for timeout | Ignored if next() already replied
        next(new Exception(500, `GET_partnerProfile - user  ${request.clientID} failed to parse from database and is invalid.`)); 
};

/* Update Profiles */
//NOTE: request.userID is editor and request.clientID is profile editing
export const PATCH_userProfile = async (request: ProfileEditRequest, response: Response, next: NextFunction) => {

    const currentProfile:USER = await DB_SELECT_USER(new Map([['userID', request.clientID]]));

    const editProfile:USER|undefined = createModelFromJSON({currentModel: currentProfile, jsonObj:request.body, fieldList: (request.jwtUserRole === RoleEnum.ADMIN) ? EDIT_PROFILE_FIELDS_ADMIN : EDIT_PROFILE_FIELDS, next: next}) as USER;

    if(currentProfile.isValid && editProfile !== undefined && editProfile.isValid) {  //undefined handles next(Exception)
        //Verify user roles and verify account type tokens
        const currentRoleList:RoleEnum[] = await DB_SELECT_USER_ROLES(request.clientID);
        if(await validateNewRoleTokenList({newRoleList:editProfile.userRoleList, jsonRoleTokenList: request.body.userRoleTokenList, email: editProfile.email, currentRoleList: currentRoleList, adminOverride: (request.jwtUserRole === RoleEnum.ADMIN)}) === false)
            next(new Exception(401, `Edit Profile Failed :: failed to verify token for user roles: ${JSON.stringify(editProfile.userRoleList)} for user ${editProfile.email}.`, 'Ineligible Account Type'));

        else if((editProfile.getUniqueDatabaseProperties(currentProfile).size > 0 )
                && await DB_UPDATE_USER(request.clientID, editProfile.getUniqueDatabaseProperties(currentProfile)) === false) 
            next(new Exception(500, `Edit Profile Failed :: Failed to update user ${request.clientID} account.`, 'Save Failed'));

        else {
            //Handle userRoleList: Add new user roles, already verified permission above
            const deleteRoleList:DATABASE_USER_ROLE_ENUM[] = currentRoleList.filter((role) => (!editProfile.userRoleList.includes(role))).map((role) => DATABASE_USER_ROLE_ENUM[role]);
            if(deleteRoleList.length > 0 && !DB_DELETE_USER_ROLE({userID:editProfile.userID, userRoleList: deleteRoleList}))
                log.error(`Edit Profile Failed :: Error removing userRoles ${JSON.stringify(deleteRoleList)} to ${editProfile.userID}`);

            const saveStudentRole:boolean = editProfile.userRoleList.length > 1; //Only save student role for multi role users
            const insertRoleList:DATABASE_USER_ROLE_ENUM[] = editProfile.userRoleList?.filter((role) => ((role !== RoleEnum.STUDENT || saveStudentRole) && !currentRoleList.includes(role))).map((role) => DATABASE_USER_ROLE_ENUM[role]);
            if(insertRoleList.length > 0 && !DB_INSERT_USER_ROLE({userID:editProfile.userID, userRoleList: insertRoleList}))
                log.error(`Edit Profile Failed :: Error assigning userRoles ${JSON.stringify(insertRoleList)} to ${editProfile.userID}`);

            response.status(202).send(editProfile.toJSON());
        }
    } else //Necessary; otherwise no response waits for timeout | Ignored if next() already replied
        next(new Exception(500, `PATCH_userProfile - user  ${request.clientID} failed to parse from database and is invalid.`));
};

/* Delete Profiles */
export const DELETE_userProfile = async (request: JwtClientRequest, response: Response, next: NextFunction) => {

    if(await DB_DELETE_CIRCLE_USER_STATUS({userID: request.clientID, circleID: undefined}) === false) //Leader must delete circle manually
        next(new Exception(500, `Failed to delete all circle membership of user ${request.clientID}`, 'Circle Membership Exists'));

    // else if(await DB_DELETE_PARTNERSHIP({userID: request.clientID, partnerUserID: undefined}) === false)
    //     next(new Exception(500, `Failed to delete all partnerships of user ${request.clientID}`, 'Partnerships Exists'));

    else if(await DB_DELETE_USER_ROLE({userID: request.clientID, userRoleList: undefined}) === false)
        next(new Exception(500, `Failed to delete all user roles of user ${request.clientID}`, 'User Roles Exists'));

    else if(await DB_DELETE_USER(request.clientID))
        response.status(204).send(`User ${request.clientID} deleted successfully`);
    else
        next(new Exception(404, `Profile Delete Failed :: Failed to delete user ${request.clientID} account.`, 'Delete Failed'));
};