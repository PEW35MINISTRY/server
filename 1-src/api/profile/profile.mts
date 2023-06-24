import express, {Router, Request, Response, NextFunction} from 'express';
import { format } from 'path';
import URL, { URLSearchParams } from 'url';
import { DB_USER } from '../../services/database/database-types.mjs';
import { queryAll, TestResult } from "../../services/database/database.mjs";
import * as log from '../../services/log.mjs';
import {Exception} from '../api-types.mjs'
import { IdentityClientRequest, IdentityRequest, JWTClientRequest, JWTRequest } from '../auth/auth-types.mjs';
import { isRequestorAllowedProfile, verifyJWT } from '../auth/auth-utilities.mjs';
import { extractClientProfile } from '../auth/authorization.mjs';
import { ProfileEditRequest,  ProfileResponse } from './profile-types.mjs';
import { editProfile, formatPartnerProfile, formatProfile, formatPublicProfile, getPartnerProfile, getProfile, getPublicProfile } from './profile-utilities.mjs';
import { EDIT_PROFILE_FIELDS, EDIT_PROFILE_FIELDS_ADMIN, EMAIL_REGEX, RoleEnum, SIGNUP_PROFILE_FIELDS, SIGNUP_PROFILE_FIELDS_STUDENT } from './Fields-Sync/profile-field-config.mjs';

//UI Helper Utility
export const GET_RoleList = (request: Request, response: Response, next: NextFunction) => {
    response.status(200).send([...Object.keys(RoleEnum)]);
}

//Public URL | UI Helper to get list of fields user allowed to  edit 
export const GET_SignupProfileFields = async(request: JWTRequest, response: Response, next: NextFunction) => {

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

//Verifies Unique Profile Fields for realtime validations | userId excludes profile fro editing
//Uses Query Parameters: GET localhost:5000/resources/available-account?email=ethan@encouragingprayer.org&displayName=ethan
export const GET_AvailableAccount =  async (request: Request, response: Response, next: NextFunction) => {
    if(URL.parse(request.originalUrl).query === '')
        new Exception(400, `Missing Details: Please supply -email- and/or -displayName- query parameters in request.  Including -userId- excludes profile.`);

    //Parse Query Fields
    const queryValues:string[] = [];

    let queryFields:string = '( ' + [...new URLSearchParams(URL.parse(request.originalUrl).query).entries()].filter(([k,v]) => (k!=='userId'))
                    .map(([k,v],i) => { queryValues.push(v.toLowerCase()); return `LOWER(${k}) = $${i+1}`;}).join(' OR ') + ' )';

    //userId query excludes that profile for edit features
    if(request.query.userId !== undefined && request.query.userId as unknown as number > 0)
        queryFields += ` AND ( userId != ${request.query.userId} )`; 

    //Temporary to support old database columns //TODO remove with new database implementation
    queryFields = queryFields.replace('displayName', 'display_name');
    queryFields = queryFields.replace('userId', 'user_id');

    const userList:DB_USER[] = await queryAll(`SELECT * FROM user_table WHERE ${queryFields};`, queryValues);

    if(userList.length === 0) 
        response.status(204).send(`No Account exists for ${request.body.email}`);
    else
        response.status(403).send(formatPublicProfile(userList[0]));

    if(userList.length > 1)
        log.error(`Multiple Accounts Detected with matching fields`, queryFields);
}
   
export const GET_publicProfile =  async (request: JWTClientRequest, response: Response, next: NextFunction) => {

    const clientException = await extractClientProfile(request);
    if(clientException) 
        next(clientException);
        
    else {
        response.status(200).send(await formatPublicProfile(request.clientProfile));
        
        log.event("Returning public profile for userId: ", request.clientId);
    } 
};

export const GET_profileAccessUserList =  async (request: JWTClientRequest, response: Response, next: NextFunction) => { 
    let userList:DB_USER[] = [];

    if(request.jwtUserRole === RoleEnum.ADMIN)
        userList = await queryAll("SELECT user_id, display_name, user_role FROM user_table");

    else if(request.jwtUserRole === RoleEnum.CIRCLE_LEADER) //TODO: Filter appropriately
        userList = await queryAll("SELECT user_id, display_name, user_role FROM user_table");

    response.status(200).send(userList);
}


export const GET_userProfile = async (request: IdentityClientRequest, response: Response) => {

    response.status(200).send(await formatProfile(request.clientProfile));
    log.event("Returning profile for userId: ", request.clientId);
};

export const GET_partnerProfile = async (request: IdentityClientRequest, response: Response) => {
      
    response.status(200).send(await formatPartnerProfile(request.clientProfile));
    log.event("Returning profile for userId: ", request.clientId);
};

/* Update Profiles */
//NOTE: request.userId is editor and request.clientId is profile editing
export const PATCH_userProfile = async (request: ProfileEditRequest, response: Response) => {

    if(await isRequestorAllowedProfile(request.clientProfile, request.userProfile)){
        const queryResult:TestResult = await editProfile(request.clientId, request, request.userProfile.user_role as RoleEnum);
        const currentProfile:ProfileResponse = queryResult.success ? await getProfile(request.clientId) : formatProfile(request.clientProfile);

        response.status(queryResult.success ? 202 : 404).send((request.userProfile.user_role as RoleEnum === RoleEnum.ADMIN)
             ? {profile: currentProfile, success: queryResult.success, result: queryResult.result, query: queryResult.query, parameters: queryResult.parameters, error: queryResult.error}
             : {profile: currentProfile, success: queryResult.success}); 

        if(queryResult.success) log.event("Updated profile for userId: ", request.userId);
    } else 
        new Exception(401, `User ${request.userId} is UNAUTHORIZED to edit the profile of Client: ${request.clientId}`)
};


