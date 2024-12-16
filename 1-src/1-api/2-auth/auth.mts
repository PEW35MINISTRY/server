import express, { NextFunction, Request, Response, Router } from 'express';
import * as log from '../../2-services/log.mjs';
import { LoginResponseBody } from '../../0-assets/field-sync/api-type-sync/auth-types.mjs';
import { EMAIL_REGEX } from '../../0-assets/field-sync/input-config-sync/profile-field-config.mjs';
import { Exception } from '../api-types.mjs';
import { JwtClientRequest, JwtRequest, LoginRequest, SubscribePost } from './auth-types.mjs';
import { getJWTLogin, getEmailLogin } from './auth-utilities.mjs';
import { DB_INSERT_EMAIL_SUBSCRIPTION } from '../../2-services/2-database/queries/queries.mjs';
import { DB_UPDATE_USER } from '../../2-services/2-database/queries/user-queries.mjs';

/********************
 Unauthenticated Routes
 *********************/

export const POST_login =  async(request: LoginRequest, response: Response, next: NextFunction) => {
    const loginDetails:LoginResponseBody = await getEmailLogin(request.body['email'], request.body['password'], true);

    if(loginDetails)
        response.status(202).send(loginDetails);
    else
        next(new Exception(404, `Login Failed: Credentials do not match our records.`, 'Invalid Credentials'));
};


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
 export const POST_JWTLogin = async (request: JwtRequest, response: Response, next: NextFunction) => {
    response.status(202).send(await getJWTLogin(request, true));
};


 export const POST_logout =  async (request: JwtRequest | JwtClientRequest, response: Response, next: NextFunction) => {
    
    const userID = (request as JwtClientRequest).clientID || request.jwtUserID; 

    response.status(200).send(`User ${userID} has been logged out of Encouraging Prayer.`);
    
    log.auth(`User ${userID} has been logged out of Encouraging Prayer.`);
};


export const POST_resetPasswordAdmin =  async(request:JwtClientRequest, response: Response, next: NextFunction) => {
    const defaultPassword:string = process.env.DEFAULT_PASSWORD_HASH ?? '';

    if((defaultPassword.length === 0)
        || await DB_UPDATE_USER(request.clientID, new Map([['passwordHash', defaultPassword]])) === false)
            next(new Exception(500, `Password Reset Failed, verify hash defined in ENV.`, 'Saving Reset Failed'));
    else 
        response.send('Password Reset Successful.');
}
