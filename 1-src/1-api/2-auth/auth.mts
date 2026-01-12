import express, { NextFunction, Request, Response, Router } from 'express';
import * as log from '../../2-services/10-utilities/logging/log.mjs';
import { LoginResponseBody } from '../../0-assets/field-sync/api-type-sync/auth-types.mjs';
import { EMAIL_REGEX, PASSWORD_RESET_PROFILE_FIELDS } from '../../0-assets/field-sync/input-config-sync/profile-field-config.mjs';
import { Exception } from '../api-types.mjs';
import { JwtClientRequest, JwtRequest, LoginRequest, PasswordResetConfirmRequest, EmailTokenInitializeRequest, SubscribePost, TokenReportRequest, EmailVerifyConfirmRequest } from './auth-types.mjs';
import { getJWTLogin, getEmailLogin, assembleLoginResponse, LoginMethod, generateToken, generatePasswordHash } from './auth-utilities.mjs';
import { DB_INSERT_EMAIL_SUBSCRIPTION } from '../../2-services/2-database/queries/queries.mjs';
import { DB_SELECT_USER, DB_UPDATE_USER } from '../../2-services/2-database/queries/user-queries.mjs';
import USER from '../../2-services/1-models/userModel.mjs';
import { sendEmailAction } from '../../2-services/4-email/email.mjs';
import { DB_CONSUME_TOKEN, DB_DELETE_TOKEN, DB_INSERT_TOKEN, DB_SELECT_TOKEN, DB_SELECT_TOKEN_USER_ALL } from '../../2-services/2-database/queries/user-security-queries.mjs';
import { DATABASE_TOKEN, DATABASE_TOKEN_TYPE_ENUM } from '../../2-services/2-database/database-types.mjs';
import { InputValidationResult } from '../../0-assets/field-sync/input-config-sync/inputValidation.mjs';
import { getEnvironment } from '../../2-services/10-utilities/utilities.mjs';
import InputField from '../../0-assets/field-sync/input-config-sync/inputField.mjs';
import validateInput from '../../0-assets/field-sync/input-config-sync/inputValidation.mjs';
import { sendUserEmailVerification } from '../../2-services/4-email/configurations/email-verification.mjs';



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

    const entry:DATABASE_TOKEN | undefined = await DB_SELECT_TOKEN(token);
    if(entry !== undefined) {
        log.warn('SECURITY EVENT: User reported unrequested token; token deleted - POST_reportUserToken', entry.userID, entry.type, `createdDT=${entry.createdDT}`, `expirationDT=${entry.expirationDT ?? 'NULL'}`, additionalQueryArguments);
        await DB_DELETE_TOKEN(request.query.token);
    }
}


 export const POST_emailVerifyResend = async(request:EmailTokenInitializeRequest, response:Response, next:NextFunction) => {

    if(validateInput({ field:PASSWORD_RESET_PROFILE_FIELDS.find((f:InputField) => f.field === 'email') as InputField, value: request.body.email, getInputField:(f:string) => request.body[f], simpleValidationOnly:false }).passed == false)
        return next(new Exception(400, `Invalid email format.`, `Invalid Email`));
    else
        response.send('Email Verification Sent.'); //Always return success to prevent email enumeration

    const userProfile:USER = await DB_SELECT_USER(new Map([['email', request.body.email]]), false);
    if(userProfile.isValid && !userProfile.isEmailVerified)
        await sendUserEmailVerification(userProfile.userID, userProfile.email, userProfile.firstName);
    else
        log.warn(`POST_emailVerifyResend not sent – profile existing: isValid=${userProfile.isValid}, isEmailVerified=${userProfile.isEmailVerified}`, userProfile.userID, userProfile.email);
}


 export const GET_emailVerifyConfirm = async(request:EmailVerifyConfirmRequest, response:Response, next:NextFunction) => {
    const email:string = request.query.email;
    const token:string = request.query.token;
    const userProfile:USER = await DB_SELECT_USER(new Map([['email', email]]), false);

    if(userProfile.isValid == false)
        log.error(`GET_emailVerifyConfirm - Email Verification Failed – user not found`, email);

    else if((request.query.token === undefined) || (String(request.query.token).length === 0))
        log.error(`GET_emailVerifyConfirm - Email Verification Failed – missing token`, email, token);

    else if(await DB_CONSUME_TOKEN({ userID:userProfile.userID, type:DATABASE_TOKEN_TYPE_ENUM.EMAIL_VERIFY, token:token }) == false)
        log.error(`GET_emailVerifyConfirm - Email Verification Failed – token consumption failed`, email);

    else if(await DB_UPDATE_USER(userProfile.userID, new Map([['isEmailVerified', true]])) == false)
        log.error(`GET_emailVerifyConfirm - Email Verification Failed – DB failed to update isEmailVerified status`, email);

    else
        return response.status(303).redirect(`${process.env.ENVIRONMENT_BASE_URL}/confirmation`);

    //Any Failed Situations
    return response.status(303).redirect(`${process.env.ENVIRONMENT_BASE_URL}/failed`);
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

    else
        response.status(202).send(`Subscription Saved`);
};


/* Password Reset */
export const POST_resetPasswordInitialize = async(request:EmailTokenInitializeRequest, response:Response, next:NextFunction) => {

    if(validateInput({ field: PASSWORD_RESET_PROFILE_FIELDS.find((f:InputField) => f.field === 'email'), value: request.body.email, getInputField:(f:string) => request.body[f], simpleValidationOnly:false }).passed == false)
        return next(new Exception(400, `Invalid email format.`, `Invalid Email`));
    else
        response.status(200).send('Password Reset Initialized.');     //Always return success to prevent email enumeration


    const userProfile:USER = await DB_SELECT_USER(new Map([['email', request.body.email]]), false);
    if(userProfile.isValid && !userProfile.isEmailVerified)
        await sendUserEmailVerification(userProfile.userID, userProfile.email, userProfile.firstName);

    else if(userProfile.isValid) {
        const token:string = generateToken();
        const expirationDate:Date = new Date(Date.now() + (Number(process.env.PASSWORD_RESET_TOKEN_MS) || (15 * 60 * 1000)));

        if(await DB_INSERT_TOKEN({userID:userProfile.userID, token, type:DATABASE_TOKEN_TYPE_ENUM.PASSWORD_RESET, expirationDT: expirationDate}) == false)
            log.error('POST_resetPasswordInitialize CANCELED - failed to insert token', userProfile.userID, userProfile.email);

        else if(await sendEmailAction({
                    subject: 'Password Reset',
                    message: `A request was made to reset the password for your account. 
                        Use the token provided or select the “Reset Password” button below to proceed. 
                        This request is time-limited for your security.  
                        If you did not initiate this request, your account may be at risk. 
                        Please click the “Not Me” button so we can secure your account and prevent unauthorized access.`,
                    buttonList: [{label:'Not Me', link:`${process.env.ENVIRONMENT_BASE_URL}/api/report-token?email=${encodeURIComponent(userProfile.email)}&token=${encodeURIComponent(token)}`, style:'OUTLINE'},
                                {label:'Reset Password', link:`${process.env.ENVIRONMENT_BASE_URL}/password-reset?email=${encodeURIComponent(userProfile.email)}&token=${encodeURIComponent(token)}`, style:'PRIMARY'}],
                    userIDList: [userProfile.userID],

                }) == false) {
                    log.error('POST_resetPasswordInitialize CANCELED - failed to send email, deleting token', userProfile.userID, userProfile.email);
                    await DB_DELETE_TOKEN(token);
                }
    }
}


export const POST_resetPasswordConfirm = async(request:PasswordResetConfirmRequest, response:Response, next:NextFunction) => {
    const userProfile:USER = await DB_SELECT_USER(new Map([['email', request.body.email]]), false);

    if((userProfile.isValid == false) || (userProfile.isEmailVerified == false))
        next(new Exception(401, `Password Reset Failed.`, 'Invalid User'));

    else {
        const fieldList:InputField[] = PASSWORD_RESET_PROFILE_FIELDS.filter((field: InputField) => field.environmentList.includes(getEnvironment()));
        for(let field of fieldList) {
            const result:InputValidationResult = validateInput({ field, value:request.body[field.field], getInputField:(f:string) => request.body[f], simpleValidationOnly:false });

            if(!result.passed) {
                next(new Exception(400, `Password Reset | ${field.title} failed validation: ${result.description}.`, `${field.title}: ${result.message}`));
                return;
            }
        }

        if(await DB_CONSUME_TOKEN({userID:userProfile.userID, type:DATABASE_TOKEN_TYPE_ENUM.PASSWORD_RESET, token:request.body.token}) == false)
            next(new Exception(401, `Password Reset Failed.`, 'Token Consume Failed'));

        else if(await DB_UPDATE_USER(userProfile.userID, new Map([['passwordHash', await generatePasswordHash(request.body.password)]])) == false)
            next(new Exception(500, `Password Reset Failed.`, 'Password Save Failed'));

        else
            return response.status(201).send(await assembleLoginResponse(LoginMethod.EMAIL, userProfile, true));
    }
}



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
