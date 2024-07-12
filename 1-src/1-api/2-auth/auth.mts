import express, { NextFunction, Request, Response, Router } from 'express';
import { JwtResponseBody, LoginResponseBody } from '../../0-assets/field-sync/api-type-sync/auth-types.mjs';
import { EMAIL_REGEX, RoleEnum } from '../../0-assets/field-sync/input-config-sync/profile-field-config.mjs';
import { DB_SELECT_CREDENTIALS } from '../../2-services/2-database/queries/user-queries.mjs';
import * as log from '../../2-services/log.mjs';
import { CredentialProfile } from '../3-profile/profile-types.mjs';
import { Exception } from '../api-types.mjs';
import { JwtClientRequest, JwtRequest, LoginRequest, SubscribePost } from './auth-types.mjs';
import { generateJWT, getUserLogin, validateNewRoleTokenList } from './auth-utilities.mjs';
import { DB_INSERT_EMAIL_SUBSCRIPTION } from '../../2-services/2-database/queries/queries.mjs';

/********************
 Unauthenticated Routes
 *********************/

export const POST_login =  async(request: LoginRequest, response: Response, next: NextFunction) => {
    const loginDetails:LoginResponseBody = await getUserLogin(request.body['email'], request.body['password']);

    if(loginDetails)
        response.status(202).send(loginDetails);
    else
        next(new Exception(404, `Login Failed: Credentials do not match our records.`, 'Invalid Credentials'));
};


//Temporary for easy debugging
export const GET_allUserCredentials =  async (request: Request, response: Response, next: NextFunction) => { 
    const userList:CredentialProfile[] = await DB_SELECT_CREDENTIALS();
    response.status(200).send(userList);
}


//Website Email Subscribe for Updates | Note: request.role is NOT RoleEnum | [USER, LEADER, FINANCIAL SUPPORTER]
export const POST_emailSubscribe = async(request:SubscribePost, response:Response, next:NextFunction) => {

    if (!EMAIL_REGEX.test(request.body.email) || (typeof request.body.role !== 'string') || (request.body.note !== undefined && typeof request.body.note !== 'string'))
        next(new Exception(400, `Invalid subscription request body: ${JSON.stringify(request.body)}`, 'Invalid Request'));

    else if(await DB_INSERT_EMAIL_SUBSCRIPTION(request.body.email, request.body.role.toUpperCase(), request.body.note) === false)
        next(new Exception(500, `Failed to save email subscription: ${JSON.stringify(request.body)}`, 'Save Failed'));

    else
        response.status(202).send(`Subscription Saved`);
};


/********************
 Authenticated Routes
 *********************/
 export const GET_jwtVerify = async (request: JwtRequest, response: Response, next: NextFunction) => { //After jwtAuthenticationMiddleware; already authenticated
    const body:JwtResponseBody = {
        jwt: generateJWT(request.jwtUserID, request.jwtUserRole as RoleEnum), //Update Token
        userID: request.jwtUserID,
        userRole: request.jwtUserRole as RoleEnum,
    }
    response.status(202).send(body);
};


 export const POST_logout =  async (request: JwtRequest | JwtClientRequest, response: Response, next: NextFunction) => {
    
    const userID = (request as JwtClientRequest).clientID || request.jwtUserID; 

    response.status(200).send(`User ${userID} has been logged out of Encouraging Prayer.`);
    
    log.auth(`User ${userID} has been logged out of Encouraging Prayer.`);
};
