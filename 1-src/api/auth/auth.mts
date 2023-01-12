import express, {Router, Request, Response, NextFunction} from 'express';
import { DB_USER } from '../../services/database/database-types.mjs';
import { query, queryAll, queryTest, TestResult } from "../../services/database/database.mjs";
import * as log from '../../services/log.mjs';
import {Exception} from '../api-types.mjs'
import { RoleEnum } from '../profile/profile-types.mjs';
import { editProfile, formatProfile } from '../profile/profile-utilities.mjs';
import { CredentialRequest, LoginRequest, loginResponse, LoginResponseBody, SignupRequest } from './auth-types.mjs';
import {generateJWT, getPasswordHash, getUserLogin, updateJWTQuery} from './auth-utilities.mjs'




/********************
 Unauthenticated Routes
 *********************/
 export const POST_signup =  async(request: SignupRequest, response: Response, next: NextFunction) => { //TODO Signup Process & Verify Accounts
        //Verify Password & Email Exist
    if(!request.body.email || !request.body.password)
        next(new Exception(400, `Signup Failed :: missing required Email or Password in request.`));

        //Save New Profile to Database
        const query:TestResult = await editProfile(null, request, null, true);
        if(query.success) {
            const body:LoginResponseBody = await getUserLogin(request.body['email'], request.body['password'], next, false);
            log.auth(`Success :: New User Created: ${body.userId}`);
            response.status(201).send(body);
        } else
            next(new Exception(500, "Failed to signup user"));
};


export const POST_login =  async(request: LoginRequest, response: Response, next: NextFunction) => {

    response.status(202).send(await getUserLogin(request.body['email'], request.body['password'], next));
};

//Temporary for easy debugging
export const GET_allUserCredentials =  async (request: Request, response: Response, next: NextFunction) => { 
    const userList:DB_USER[] = await queryAll("SELECT user_id, display_name, user_role, email, password_hash FROM user_table");

    response.status(200).send(userList);
}


/********************
 Authenticated Routes
 *********************/
 export const POST_logout =  async (request: CredentialRequest, response: Response, next: NextFunction) => {
    //TODO: Perform Logout Operations and Remove JWT

    // const query:TestResult  = await queryTest(`UPDATE user_table SET jwt = $1 WHERE user_id = $2;`, [null, request.userId]);

    // if(query.success) {
    //     response.status(202).send(`User: ${request.userId} has been logged out of Encouraging Prayer System.`);
    //     log.auth("Successfully logged out user: ", request.userId);
    // } else {
        // next(new Exception(502, `Database failed to logout user: ${request.userId} | Error: `+query.error));
    // }

    next(new Exception(502, `Database failed to logout user`));

};


