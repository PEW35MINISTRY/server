import express, {Router, Request, Response, NextFunction} from 'express';
import { format } from 'path';
import { TestResult } from "../../services/database/database.mjs";
import * as log from '../../services/log.mjs';
import {Exception} from '../api-types.mjs'
import { CredentialRequest, ProfileRequest } from '../auth/auth-types.mjs';
import { isRequestorAllowedProfile } from '../auth/auth-utilities.mjs';
import { clientAuthentication } from '../auth/authorization.mjs';
import { getRoleList, ProfileEditRequest,  ProfileResponse, RoleEnum } from './profile-types.mjs';
import { editProfile, formatPartnerProfile, formatProfile, formatPublicProfile, getPartnerProfile, getProfile, getPublicProfile } from './profile-utilities.mjs';


export const GET_RoleList =  (request: Request, response: Response, next: NextFunction) => {
    response.status(200).send(getRoleList());
}
   
export const GET_publicProfile =  async(request: ProfileRequest, response: Response, next: NextFunction) => {

    if(await clientAuthentication(request, response, next)) {
        response.status(200).send(await formatPublicProfile(request.clientProfile));
        log.event("Returning public profile for userId: ", request.clientId);
    } else
        next(new Exception(500, `FAILED to find public profile for User: ${request.clientId}`));
};



export const GET_userProfile = async(request: ProfileRequest, response: Response) => {

    response.status(200).send(await formatProfile(request.clientProfile));
    log.event("Returning profile for userId: ", request.clientId);
};

export const GET_partnerProfile = async(request: ProfileRequest, response: Response) => {
      
    response.status(200).send(await formatPartnerProfile(request.clientProfile));
    log.event("Returning profile for userId: ", request.clientId);
};

/* Update Profiles */
//NOTE: user-id is editor and request-id is profile editing
export const PATCH_userProfile = async(request: ProfileEditRequest, response: Response) => {

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
