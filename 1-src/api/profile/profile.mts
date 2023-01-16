import express, {Router, Request, Response, NextFunction} from 'express';
import { format } from 'path';
import { DB_USER } from '../../services/database/database-types.mjs';
import { queryAll, TestResult } from "../../services/database/database.mjs";
import * as log from '../../services/log.mjs';
import {Exception} from '../api-types.mjs'
import { IdentityClientRequest, IdentityRequest, JWTClientRequest, JWTRequest } from '../auth/auth-types.mjs';
import { isRequestorAllowedProfile, verifyJWT } from '../auth/auth-utilities.mjs';
import { extractClientProfile } from '../auth/authorization.mjs';
import { getRoleList, getUserRoleProfileAccessList, ProfileEditRequest,  ProfileResponse, RoleEnum } from './profile-types.mjs';
import { editProfile, formatPartnerProfile, formatProfile, formatPublicProfile, getPartnerProfile, getProfile, getPublicProfile } from './profile-utilities.mjs';

//UI Helper Utility
export const GET_RoleList = (request: Request, response: Response, next: NextFunction) => {
    response.status(200).send(getRoleList());
}

//Public URL | UI Helper to get list of fields user allowed to  edit 
export const GET_ProfileRoleEditList = async(request: JWTRequest, response: Response, next: NextFunction) => {
    let userRole:RoleEnum = RoleEnum.SIGNUP; //default

    if(request.headers.jwt && verifyJWT(request.headers['jwt'])) {
        //TODo Temporary until JWT implemented
        const userList:DB_USER[] = await queryAll("SELECT * FROM user_table WHERE user_id = $1;", [request.headers['user-id']]);
        userRole = RoleEnum[userList[0].user_role as string];
    }
    
    response.status(200).send(getUserRoleProfileAccessList(userRole));
}

export const POST_EmailExists =  async (request: Request, response: Response, next: NextFunction) => {

    const userList:DB_USER[] = await queryAll("SELECT * FROM user_table WHERE email = $1;", [request.body.email]);
    if(userList.length === 0) 
        response.status(404).send(`No Account exists for ${request.body.email}`);

    else {
        response.status(204).send(formatPublicProfile(userList[0]));

        if(userList.length > 1)
            log.error(`Multiple Accounts Detected with same email`, request.body.email, ...userList.map(user => user.user_id));
    }
}

export const POST_UsernameExists =  async (request: Request, response: Response, next: NextFunction) => {

    const userList:DB_USER[] = await queryAll("SELECT * FROM user_table WHERE display_name = $1;", [request.body.displayName]);
    if(userList.length === 0) 
        response.status(404).send(`No Account exists for ${request.body.displayName}`);

    else {
        response.status(204).send(formatPublicProfile(userList[0]));

        if(userList.length > 1)
            log.error(`Multiple Accounts Detected with same username`, request.body.displayName, ...userList.map(user => user.user_id));
    }
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

export const GET_profileAccessUserList =  async (request: JWTClientRequest, response: Response, next: NextFunction) => { //TODO: Filter appropriately

    const userList:DB_USER[] = await queryAll("SELECT user_id, display_name, user_role FROM user_table");

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
//NOTE: user-id is editor and request-id is profile editing
export const PATCH_userProfile = async (request: ProfileEditRequest, response: Response) => {

    if(await isRequestorAllowedProfile(request.clientProfile, request.userProfile)){
        const queryResult:TestResult = await editProfile(request.clientId, request, RoleEnum[request.userProfile.user_role as string]);
        const currentProfile:ProfileResponse = queryResult.success ? await getProfile(request.userId) : formatProfile(request.userProfile);

        response.status(queryResult.success ? 202 : 404).send((RoleEnum[request.userProfile.user_role as string] === RoleEnum.ADMIN)
             ? {profile: currentProfile, success: queryResult.success, result: queryResult.result, query: queryResult.query, parameters: queryResult.parameters, error: queryResult.error}
             : {profile: currentProfile, success: queryResult.success}); 

        if(queryResult.success) log.event("Updated profile for userId: ", request.userId);
    } else 
        new Exception(401, `User ${request.userId} is UNAUTHORIZED to edit the profile of Client: ${request.clientId}`)
};


