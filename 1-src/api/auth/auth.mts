import express, {Router, Request, Response, NextFunction} from 'express';
import { DB_USER } from '../../services/database/database-types.mjs';
import { query, queryAll, queryTest, TestResult } from "../../services/database/database.mjs";
import * as log from '../../services/log.mjs';
import {Exception} from '../api-types.mjs'
import { RoleEnum } from '../profile/profile-types.mjs';
import { editProfile, EDIT_TYPES, formatProfile } from '../profile/profile-utilities.mjs';
import { IdentityRequest, JWTClientRequest, JWTRequest, LoginRequest, loginResponse, LoginResponseBody, SignupRequest } from './auth-types.mjs';
import {generateJWT, getPasswordHash, getUserLogin, verifyJWT, verifyNewAccountToken} from './auth-utilities.mjs'
import { extractClientProfile, jwtAuthenticationMiddleware } from './authorization.mjs';
import { generateSecretKey } from './auth-utilities.mjs';

/********************
 Unauthenticated Routes
 *********************/
 export const POST_signup =  async(request: SignupRequest, response: Response, next: NextFunction) => { //TODO Signup Process & Verify Accounts
    let userList:DB_USER[] = [];
        //Verify Password & Email Exist
    if(!request.body.email || !request.body.password || !request.body.displayName)
        next(new Exception(400, `Signup Failed :: missing required fields.`));

        //Verify Email is Unique
    else if((userList = await queryAll("SELECT * FROM user_table WHERE email = $1;", [request.body.email])).length !== 0) {
        next(new Exception(403, `Signup Failed :: Unique email is required for a new account.`));

        if(userList.length > 1)
            log.error(`Multiple Accounts Detected with same username`, request.body.displayName, ...userList.map(user => user.user_id));

            //Verify Username is Unique
    } else if((userList = await queryAll("SELECT * FROM user_table WHERE display_name = $1;", [request.body.displayName])).length !== 0) {
        next(new Exception(409, `Signup Failed :: Unique username is required for a new account.`));

        if(userList.length > 1)
            log.error(`Multiple Accounts Detected with same username`, request.body.displayName, ...userList.map(user => user.user_id));
    
        //Verify New Account Token for userRole
    } else if(!await verifyNewAccountToken(request.body.token, request.body.email, request.body.userRole))
        next(new Exception(402, `Signup Failed :: Invalid token to create a ${request.body.userRole} account.`));

        //Success: Create and Save New Profile to Database
    else {

        if(verifyNewAccountToken(request.body.token, request.body.email, request.body.userRole)
           && !(await editProfile(null, request, RoleEnum.SIGNUP, EDIT_TYPES.CREATE)).success) 
            next(new Exception(500, `Signup Failed :: Failed to save new user account.`));

        else {
            const loginDetails:LoginResponseBody = await getUserLogin(request.body['email'], request.body['displayName'], request.body['password']);

            if(loginDetails)
                response.status(201).send(loginDetails);
            else
                next(new Exception(404, `Signup Failed: Account successfully created; but failed to auto login new user.`));
        }
    }
};


export const POST_login =  async(request: LoginRequest, response: Response, next: NextFunction) => {
    const loginDetails:LoginResponseBody = await getUserLogin(request.body['email'], request.body['displayName'], request.body['password']);

    if(loginDetails)
        response.status(202).send(loginDetails);
    else
        next(new Exception(404, `Login Failed: Credentials do not match our records.`));
};

//Temporary for easy debugging
export const GET_allUserCredentials =  async (request: Request, response: Response, next: NextFunction) => { 
    const userList:DB_USER[] = await queryAll("SELECT user_id, display_name, user_role, email, password_hash FROM user_table");

    response.status(200).send(userList);
}


/********************
 Authenticated Routes
 *********************/
 export const GET_jwtVerify = async (request: JWTRequest, response: Response, next: NextFunction) => { //After jwtAuthenticationMiddleware; already authenticated

    response.status(202).send('JWT is valid.');
};


 export const POST_logout =  async (request: JWTClientRequest, response: Response, next: NextFunction) => {
    
    const clientException = await extractClientProfile(request); 
    if(clientException) 
        next(clientException);

    else {
        response.status(200).send(`User ${request.clientId} has been logged out of Encouraging Prayer.`);
        
        log.auth(`User ${request.clientId} has been logged out of Encouraging Prayer.`);
    }
};

export const POST_authorization_reset = async (request:IdentityRequest, response:Response, next: NextFunction) => {
    generateSecretKey();
    response.status(202).send(`App secret key has been reset`);
    log.auth(`User ${request.userId} has reset the server's secret key`);
}
