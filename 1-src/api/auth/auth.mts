import express, {Router, Request, Response, NextFunction} from 'express';
import * as log from '../../services/log.mjs';
import {Exception} from '../api-types.mjs'
import { CredentialRequest, loginRequest, loginResponse } from './auth-types.mjs';
import authenticateAccess, {authenticateIdentity, getLoginResponse} from './auth-utilities.mjs'


const router:Router = express.Router();
router.use(express.json());


router.post('/signup', (request: loginRequest, response: loginResponse) => {
        //Verify Password & Email

        //Save to Database
        const userId = "New User ID"

        response.status(201).send(getLoginResponse(userId));
        log.auth("New user created with user id: ", userId);
});


router.get('/login', (request: CredentialRequest, response: Response) => {
    //Query Database

    response.status(202).send(getLoginResponse(request.headers['user-id']));
    log.auth("Successfully logged in user: ", request.headers['user-id']);
});

//Verify Identity
router.use((request:CredentialRequest, response:Response, next:NextFunction) => authenticateIdentity(request, response, next));

router.post('/logout', (request: CredentialRequest, response: Response) => {
    //Perform Logout Operations and Remove JWT
    
    response.status(202).send("You have been logged out of Encouraging Prayer System.");
    log.auth("Successfully logged out user: ", request.headers['user-id']);
});


export default router;


