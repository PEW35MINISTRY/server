import express, { NextFunction, Request, Response, Router } from 'express';
import * as log from '../../2-services/10-utilities/logging/log.mjs';
import { LoginResponseBody } from '../../0-assets/field-sync/api-type-sync/auth-types.mjs';
import { EMAIL_REGEX } from '../../0-assets/field-sync/input-config-sync/profile-field-config.mjs';
import { Exception } from '../api-types.mjs';
import { JwtClientRequest, JwtRequest, LoginRequest, PasswordResetConfirmRequest, EmailTokenInitializeRequest, SubscribePost, TokenReportRequest, EmailVerifyConfirmRequest } from './auth-types.mjs';
import { getJWTLogin, getEmailLogin, assembleLoginResponse, LoginMethod, generateToken, generatePasswordHash } from './auth-utilities.mjs';
import { DB_INSERT_EMAIL_SUBSCRIPTION } from '../../2-services/2-database/queries/queries.mjs';
import { DB_SELECT_USER, DB_UPDATE_USER } from '../../2-services/2-database/queries/user-queries.mjs';
import { sendSubscribeWelcomeEmail } from '../../2-services/4-email/configurations/email-release-notes.mjs';
import { DB_CONSUME_TOKEN, DB_DELETE_TOKEN, DB_INSERT_TOKEN, DB_SELECT_TOKEN, DB_SELECT_TOKEN_USER_ALL } from '../../2-services/2-database/queries/user-security-queries.mjs';
import { DATABASE_TOKEN, DATABASE_TOKEN_TYPE_ENUM } from '../../2-services/2-database/database-types.mjs';


/********************
 Unauthenticated Routes
 *********************/

 //General Callback for users to report unrequested tokens
 //Note: Additional details can be included as query parameters for logging
 export const GET_reportUserToken = async(request:TokenReportRequest, response:Response, next:NextFunction) => {
    const { token, ...additionalQueryArguments } = request.query;

    if((token === undefined) || (token.length === 0))
        return next(new Exception(400, `Invalid token request.`, 'Invalid Request'));
    else
        response.status(303).redirect(`${process.env.ENVIRONMENT_BASE_URL}/confirmation`); //Always success

    
    /* Sanitize additionalQueryArguments for Logging purposes*/
    const logDetails:Record<string,string> = {};
    for(const key of Object.keys(additionalQueryArguments).slice(0, 3)) { //max 3
        let value:string = additionalQueryArguments[key];
        if(value == null || (typeof value !== 'string' && typeof value !== 'number'))
            continue;
        
        if(!new RegExp(/^[A-Za-z0-9\-_.@]{4,20}$/).test(key))
            continue;

        const cleanValue = String(value).replace(new RegExp(/[^A-Za-z0-9\-_.@]/g), '').slice(0, 200); //max 200 length cleaned
        if(cleanValue.length > 0)
            logDetails[key] = cleanValue;
    }

    
    /* Delete & Log */
    const entry:DATABASE_TOKEN | undefined = await DB_SELECT_TOKEN(token);
    if(entry !== undefined) {
        log.warn('SECURITY EVENT: User reported unrequested token; token deleted - POST_reportUserToken', entry.userID, entry.type, `createdDT=${entry.createdDT}`, `expirationDT=${entry.expirationDT ?? 'NULL'}`, logDetails);
        await DB_DELETE_TOKEN(request.query.token);
    }
}


export const POST_login =  async(request:LoginRequest, response:Response, next:NextFunction) => {
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

    else {
        sendSubscribeWelcomeEmail(request.body.email);
        response.status(202).send(`Subscription Saved`);
    }
};


/********************
 Authenticated Routes
 *********************/
 export const POST_JWTLogin = async (request: JwtRequest, response: Response, next: NextFunction) => {
    response.status(202).send(await getJWTLogin(request.jwtUserID, true));
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


/* General Access Utilities */
export const GET_userActiveTokensAdmin = async(request:JwtClientRequest, response: Response, next: NextFunction) => {
    return response.status(200).send(await DB_SELECT_TOKEN_USER_ALL({ userID:request.clientID }));
}
