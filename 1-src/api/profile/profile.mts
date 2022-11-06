import express, {Router, Request, Response, NextFunction} from 'express';
import * as log from '../../services/log.mjs';
import {Exception} from '../api-types.mjs'
import { CredentialRequest } from '../auth/auth-types.mjs';
import authenticateJWT from '../auth/auth-utilities.mjs';
import { ProfilePartnerRequest, ProfilePublicRequest, ProfilePublicResponse, ProfileRequest, ProfileResponse } from './profile-types.mjs';
import { getPartnerProfile, getProfile, getPublicProfile } from './profile-utilities.mjs';


const router:Router = express.Router();
router.use(express.json());

//Verify Authentication
router.use((request:CredentialRequest, response:Response, next:NextFunction) => authenticateJWT(request, response, next));
   

router.get('/', (request: ProfileRequest, response: Response) => {
    //Query Database

    response.status(200).send('Here is your profile Information');
    log.event("Returning profile for userId: ");
});

router.post('/', (request: ProfileRequest, response: Response) => {
    //Query Database

    response.status(200).send(getProfile(request.headers['user-id']));
    log.event("Returning personal profile for userId: ", request.headers['user-id']);
});

router.get('/public', (request: ProfilePublicRequest, response: Response) => {
    //Query Database

    //Verify user privilege 

    response.status(200).send(getPublicProfile(request.headers['request-id']));
    log.event("Returning public profile for userId: ", request.headers['request-id']);
});

router.get('/partner', (request: ProfilePartnerRequest, response: Response) => {
    //Query Database

    //Verify user privilege 

    response.status(200).send(getPartnerProfile(request.headers['partner-id']));
    log.event("Returning partner profile for userId: ", request.headers['partner-id']);
});



export default router;
