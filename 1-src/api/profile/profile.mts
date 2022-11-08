import express, {Router, Request, Response, NextFunction} from 'express';
import { TestResult } from '../../services/database.mjs';
import * as log from '../../services/log.mjs';
import {Exception} from '../api-types.mjs'
import { CredentialRequest } from '../auth/auth-types.mjs';
import authenticateJWT from '../auth/auth-utilities.mjs';
import { ProfileEditRequest, ProfilePartnerRequest, ProfilePublicRequest, ProfilePublicResponse, ProfileRequest, ProfileResponse } from './profile-types.mjs';
import { editProfile, getPartnerProfile, getProfile, getProfileRoles, getPublicProfile, isProfileEditAllowed } from './profile-utilities.mjs';


const router:Router = express.Router();
router.use(express.json());

//Verify Authentication
router.use((request:CredentialRequest, response:Response, next:NextFunction) => authenticateJWT(request, response, next));
   

router.get('/', async(request: ProfileRequest, response: Response) => {
    response.status(200).send(await getProfile(parseInt(request.headers['user-id'])));
    log.event("Returning profile for userId: ");
});


router.get('/public', async(request: ProfilePublicRequest, response: Response) => {

    response.status(200).send(await getPublicProfile(parseInt(request.headers['request-id'])));
    log.event("Returning public profile for userId: ", request.headers['request-id']);
});

router.get('/partner', async(request: ProfilePartnerRequest, response: Response) => {

  
    response.status(200).send(await getPartnerProfile(parseInt(request.headers['user-id']), parseInt(request.headers['partner-id'])));
    log.event("Returning partner profile for userId: ", request.headers['partner-id']);
});

/* Update Profiles */
//NOTE: user-id is editor and request-id is profile editing
router.patch('/', async(request: ProfileEditRequest, response: Response) => {
    const userId:number = parseInt(request.body['userId'] as unknown as string);
    const requestorId:number = parseInt(request.headers["user-id"]);

    if(await isProfileEditAllowed(userId, requestorId)){
        const queryResult:TestResult = await editProfile(userId, request, getProfileRoles(requestorId)[0].userRole);
        const currentProfile:ProfileResponse = await getProfile(userId);

        response.status(queryResult.success ? 202 : 404).send({profile: currentProfile, success: queryResult.success, result: queryResult.result || 'None', error: queryResult.error || 'None'});

        log.event("Updated profile for userId: ", userId);
    } else 
        new Exception(401, `User ${requestorId} is UNAUTHORIZED to edit the profile of User: ${userId}`)
});



export default router;
