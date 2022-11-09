import express, {Router, Request, Response, NextFunction} from 'express';
import { format } from 'path';
import { TestResult } from '../../services/database.mjs';
import * as log from '../../services/log.mjs';
import {Exception} from '../api-types.mjs'
import { CredentialRequest } from '../auth/auth-types.mjs';
import authenticateAccess, { authenticateIdentity, isRequestorAllowed } from '../auth/auth-utilities.mjs';
import { ProfileEditRequest,  ProfileResponse, RoleEnum } from './profile-types.mjs';
import { editProfile, formatProfile, formatPublicProfile, getPartnerProfile, getProfile, getPublicProfile } from './profile-utilities.mjs';


const router:Router = express.Router();
router.use(express.json());

//Verify Identity
router.use((request:CredentialRequest, response:Response, next:NextFunction) => authenticateIdentity(request, response, next));
   
router.get('/public', async(request: CredentialRequest, response: Response) => {

    response.status(200).send(await formatPublicProfile(request.headers.userProfile));
    log.event("Returning public profile for userId: ", request.headers.userId);
});


//Verify Authorization
router.use((request:CredentialRequest, response:Response, next:NextFunction) => authenticateAccess(request, response, next));


router.get('/', async(request: CredentialRequest, response: Response) => {
    response.status(200).send(await formatProfile(request.headers.userProfile));
    log.event("Returning profile for userId: ", request.headers.userId);
});

router.get('/partner', async(request: CredentialRequest, response: Response) => {
  
    response.status(200).send(await getPartnerProfile(request.headers.userId, request.headers.requestorId));
    log.event("Returning partner profile for userId: ", request.headers.requestorId);
});

/* Update Profiles */
//NOTE: user-id is editor and request-id is profile editing
router.patch('/', async(request: ProfileEditRequest, response: Response) => {

    if(await isRequestorAllowed(request.headers.userId, request.headers.requestorId)){
        const queryResult:TestResult = await editProfile(request.headers.userId, request, RoleEnum[request.headers.requestorProfile.user_role as string]);
        const currentProfile:ProfileResponse = await getProfile(request.headers.userId);

        response.status(queryResult.success ? 202 : 404).send({profile: currentProfile, success: queryResult.success, result: queryResult.result || 'None', error: queryResult.error || 'None'});

        log.event("Updated profile for userId: ", request.headers.userId);
    } else 
        new Exception(401, `User ${request.headers.requestorId} is UNAUTHORIZED to edit the profile of User: ${request.headers.userId}`)
});



export default router;
