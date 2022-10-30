import express, {Router, Request, Response, NextFunction} from 'express';
import fs, { PathLike } from 'fs';
import * as log from '../../services/log.mjs';
import {Exception} from '../api-types.mjs'
import authenticateJWT, {getLoginResponse} from './auth-utilities.mjs'


const router:Router = express.Router();
router.use(express.json());





router.post('/signup', (request: Request|any, response: Response) => {
        //Verify Password & Email

        //Save to Database

        response.status(201).send(getLoginResponse(request.headers.userid));
        log.auth("New user created with user id: ", request.headers.userid);
});

//Verify Authentication
router.use((request:Request, response:Response, next:NextFunction) => authenticateJWT(request, response, next));
   
router.get('/login', (request: Request|any, response: Response) => {
    //Query Database

    response.status(202).send(getLoginResponse(request.headers.userid));
    log.auth("Successfully logged in user: ", request.headers.userid);
});

router.post('/logout', (request: Request, response: Response) => {
    //Perform Logout Operations and Remove JWT
    
    response.status(202).send("You have been logged out of Encouraging Prayer System.");
    log.auth("Successfully logged out user: ", request.headers.userid);
});


export default router;


