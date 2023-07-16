import express, {Router, Request, Response, NextFunction} from 'express';
import URL, { URLSearchParams } from 'url';
import * as log from '../../services/log.mjs';
import {Exception} from '../api-types.mjs'
import { IdentityClientRequest, IdentityRequest, JWTClientRequest, JwtRequest } from '../auth/auth-types.mjs';
import { isRequestorAllowedProfile, validateNewRoleTokenList } from '../auth/auth-utilities.mjs';
import { extractClientProfile } from '../auth/authorization.mjs';
import { ProfileEditRequest,  ProfileListItem,  ProfileResponse } from './profile-types.mjs';
import { createUserFromJSON } from './profile-utilities.mjs';
import { EDIT_PROFILE_FIELDS, EDIT_PROFILE_FIELDS_ADMIN, RoleEnum, SIGNUP_PROFILE_FIELDS, SIGNUP_PROFILE_FIELDS_STUDENT } from './Fields-Sync/profile-field-config.mjs';
import { DB_DELETE_USER, DB_DELETE_USER_ROLE, DB_INSERT_USER_ROLE, DB_SELECT_CONTACTS, DB_UNIQUE_USER_EXISTS, DB_UPDATE_USER } from '../../services/database/queries/user-queries.mjs';
import USER from '../../services/models/user.mjs';

//UI Helper Utility
export const GET_RoleList = (request: Request, response: Response, next: NextFunction) => {
    response.status(200).send([...Object.keys(RoleEnum)]);
}

//Public URL | UI Helper to get list of fields user allowed to  edit 
export const GET_SignupProfileFields = async(request: JwtRequest, response: Response, next: NextFunction) => {

    const role: string = request.params.role || 'student';
    
    if(role === 'student')
        response.status(200).send(SIGNUP_PROFILE_FIELDS_STUDENT.map(field => field.toJSON()));
    else
        response.status(200).send(SIGNUP_PROFILE_FIELDS.map(field => field.toJSON()));
}

//Public URL | UI Helper to get list of fields user allowed to  edit 
export const GET_EditProfileFields = async(request: IdentityClientRequest, response: Response, next: NextFunction) => {
    
    if(request.userRole === RoleEnum.ADMIN)
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
   
export const GET_publicProfile =  async (request: JWTClientRequest, response: Response, next: NextFunction) => {

    const clientException = await extractClientProfile(request);
    if(clientException) 
        next(clientException);        
    else {
        response.status(200).send(request.clientProfile.toPublicJSON());        
        log.event("Returning public profile for userID: ", request.clientID);
    } 
};

export const GET_profileAccessUserList =  async (request: IdentityRequest, response: Response, next: NextFunction) => { 
    let userList:ProfileListItem[] = [];

    if(request.userProfile.isRole(RoleEnum.ADMIN))
        userList = await DB_SELECT_CONTACTS(request.userID);

    else if(request.userProfile.isRole(RoleEnum.CIRCLE_LEADER))
        userList = [] //await DB_SELECT_MEMBERS_OF_ALL_CIRCLES(request.userID);

    response.status(200).send(userList);
}


export const GET_userProfile = async (request: IdentityClientRequest, response: Response) => {
    response.status(200).send(request.clientProfile.toProfileJSON());
    log.event("Returning profile for userID: ", request.clientID);
};

export const GET_partnerProfile = async (request: IdentityClientRequest, response: Response) => {
      
    response.status(200).send(request.clientProfile.toPartnerJSON());
    log.event("Returning profile for userID: ", request.clientID);
};

/* Update Profiles */
//NOTE: request.userID is editor and request.clientID is profile editing
export const PATCH_userProfile = async (request: ProfileEditRequest, response: Response, next: NextFunction) => {

    if(await isRequestorAllowedProfile(request.clientProfile, request.userProfile)){
        const editProfile:USER|undefined = createUserFromJSON({currentUser: request.clientProfile, jsonObj:request.body, fieldList: request.userProfile.isRole(RoleEnum.ADMIN) ? EDIT_PROFILE_FIELDS_ADMIN : EDIT_PROFILE_FIELDS, next: next});

        if(editProfile !== undefined) {
            //Verify user roles and verify account type tokens
            if(await validateNewRoleTokenList({newRoleList:editProfile.userRoleList, jsonRoleTokenList: request.body.userRoleTokenList, email: editProfile.email, currentRoleList: request.clientProfile.userRoleList, adminOverride: request.userProfile.isRole(RoleEnum.ADMIN)}) === false)
                next(new Exception(402, `Edit Profile Failed :: failed to verify token for user roles: ${JSON.stringify(editProfile.userRoleList)} for user ${editProfile.email}.`, 'Ineligible Account Type'));

            else if((editProfile.getUniqueDatabaseProperties(request.clientProfile).size > 0 )
                    && await !DB_UPDATE_USER(request.clientID, editProfile.getUniqueDatabaseProperties(request.clientProfile))) 
                next(new Exception(500, `Edit Profile Failed :: Failed to update user ${request.clientID} account.`, 'Save Failed'));

            else {
                //Handle userRoleList: Add new user roles, already verified permission above
                const saveStudentRole:boolean = editProfile.userRoleList.length > 1; //Only save student role for multi role users
                const insertRoleList:RoleEnum[] = editProfile.userRoleList?.filter((role) => ((role !== RoleEnum.STUDENT || saveStudentRole) && !request.clientProfile.userRoleList.includes(role)));
                if(insertRoleList.length > 0 && !DB_INSERT_USER_ROLE({userID:editProfile.userID, userRoleList: insertRoleList}))
                    log.error(`Edit Profile Failed :: Error assigning userRoles ${JSON.stringify(insertRoleList)} to ${editProfile.userID}`);

                const deleteRoleList:RoleEnum[] = request.clientProfile.userRoleList?.filter((role) => ((role !== RoleEnum.STUDENT || saveStudentRole) && !editProfile.userRoleList.includes(role)));
                if(deleteRoleList.length > 0 && !DB_DELETE_USER_ROLE({userID:editProfile.userID, userRoleList: deleteRoleList}))
                    log.error(`Edit Profile Failed :: Error removing userRoles ${JSON.stringify(deleteRoleList)} to ${editProfile.userID}`);

                response.status(202).send(editProfile.toProfileJSON());
            }
        }
    } else 
        new Exception(401, `User ${request.userID} is UNAUTHORIZED to edit the profile of Client: ${request.clientID}`)
};

/* Delete Profiles */
export const DELETE_userProfile = async (request: IdentityClientRequest, response: Response, next: NextFunction) => {

    // if(!await DB_DELETE_CIRCLE_MEMBER({userID: request.clientID, circleID: undefined}))
    //     next(new Exception(500, `Failed to delete all circle membership of user ${request.clientID}`, 'Circle Membership Exists'));

    // else if(!await DB_DELETE_PARTNERSHIP({userID: request.clientID, partnerUserID: undefined}))
    //     next(new Exception(500, `Failed to delete all partnerships of user ${request.clientID}`, 'Partnerships Exists'));

    if(!await DB_DELETE_USER_ROLE({userID: request.clientID, userRoleList: undefined}))
        next(new Exception(500, `Failed to delete all user roles of user ${request.clientID}`, 'User Roles Exists'));

    else if(await DB_DELETE_USER(request.clientID))
        response.status(204).send(`User ${request.clientID} deleted successfully`);
    else
        next(new Exception(404, `Profile Delete Failed :: Failed to delete user ${request.clientID} account.`, 'Delete Failed'));
};