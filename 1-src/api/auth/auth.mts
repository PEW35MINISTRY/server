import express, {Router, Request, Response, NextFunction} from 'express';
import { DB_USER } from '../../services/database-types.mjs';
import { query, queryTest, TestResult } from '../../services/database.mjs';
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
        //Verify Password & Email

        //Save New Profile to Database
        const query:TestResult = await editProfile(null, request, null, true);
        if(query.success) {
            const body:LoginResponseBody = await getUserLogin(request.body['email'], request.body['password'], next);
            log.auth('Success :: New User Created:', body.userId, body.userProfile.displayName, body.userProfile.userRole)
            response.status(201).send(body);
        } else
            next(new Exception(500, "Failed to signup user"));
};


export const GET_login =  async(request: LoginRequest, response: Response, next: NextFunction) => {

    response.status(202).send(await getUserLogin(request.body['email'], request.body['password'], next));
};




/********************
 Authenticated Routes
 *********************/
 export const POST_logout =  async (request: CredentialRequest, response: Response, next: NextFunction) => {
    //Perform Logout Operations and Remove JWT

    const query:TestResult  = await queryTest(`UPDATE user_table SET jwt = $1 WHERE user_id = $2;`, [null, request.userId]);

    if(query.success) {
        response.status(202).send("You have been logged out of Encouraging Prayer System.");
        log.auth("Successfully logged out user: ", request.headers['user-id']);
    } else {
        next(new Exception(502, `Database failed to logout user: ${request.userId} | Error: `+query.error));
    }
};


