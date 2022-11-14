import express, {Router, Request, Response, NextFunction} from 'express';
import { format } from 'path';
import { TestResult } from '../../services/database.mjs';
import * as log from '../../services/log.mjs';
import {Exception} from '../api-types.mjs'
import { CredentialRequest } from '../auth/auth-types.mjs';
import { isRequestorAllowedProfile } from '../auth/auth-utilities.mjs';
import { ProfileEditRequest,  ProfileResponse, RoleEnum } from './profile-types.mjs';
import { editProfile, formatProfile, formatPublicProfile, getPartnerProfile, getProfile, getPublicProfile } from './profile-utilities.mjs';



   
export const GET_publicProfile =  async(request: CredentialRequest, response: Response) => {

    response.status(200).send(await formatPublicProfile(request.userProfile));
    log.event("Returning public profile for userId: ", request.userId);
};



export const GET_userProfile = async(request: CredentialRequest, response: Response) => {

    response.status(200).send(await formatProfile(request.userProfile));
    log.event("Returning profile for userId: ", request.userId);
};

export const GET_partnerProfile = async(request: CredentialRequest, response: Response) => {
  
    response.status(200).send(await getPartnerProfile(request.userId, request.requestorId));
    log.event("Returning partner profile for userId: ", request.requestorId);
};

/* Update Profiles */
//NOTE: user-id is editor and request-id is profile editing
export const PATCH_userProfile = async(request: ProfileEditRequest, response: Response) => {

    if(await isRequestorAllowedProfile(request.userProfile, request.requestorProfile)){
        const queryResult:TestResult = await editProfile(request.userId, request, RoleEnum[request.requestorProfile.user_role as string]);
        const currentProfile:ProfileResponse = queryResult.success ? await getProfile(request.userId) : formatProfile(request.userProfile);

        response.status(queryResult.success ? 202 : 404).send((RoleEnum[request.requestorProfile.user_role as string] === RoleEnum.ADMIN)
             ? {profile: currentProfile, success: queryResult.success, result: queryResult.result, query: queryResult.query, parameters: queryResult.parameters, error: queryResult.error}
             : {profile: currentProfile, success: queryResult.success}); 

        if(queryResult.success) log.event("Updated profile for userId: ", request.userId);
    } else 
        new Exception(401, `User ${request.requestorId} is UNAUTHORIZED to edit the profile of User: ${request.userId}`)
};
