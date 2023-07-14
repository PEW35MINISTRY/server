import express, {Router, Request, Response, NextFunction} from 'express';
import { USER_TABLE_COLUMNS, USER_TABLE_COLUMNS_REQUIRED } from '../../services/database/database-types.mjs';
import * as log from '../../services/log.mjs';
import {Exception} from '../api-types.mjs'
import { createUserFromJSON } from '../profile/profile-utilities.mjs';
import { IdentityRequest, JWTClientRequest, JwtRequest, JWTResponse, JwtResponseBody, LoginRequest, LoginResponseBody } from './auth-types.mjs';
import {generateJWT, getUserLogin, verifyNewAccountToken} from './auth-utilities.mjs'
import { extractClientProfile } from './authorization.mjs';
import { generateSecretKey } from './auth-utilities.mjs';
import { RoleEnum, SIGNUP_PROFILE_FIELDS } from '../profile/Fields-Sync/profile-field-config.mjs';
import { CredentialProfile, ProfileSignupRequest } from '../profile/profile-types.mjs';
import { DB_INSERT_USER, DB_INSERT_USER_ROLE, DB_SELECT_CREDENTIALS } from '../../services/database/queries/user-queries.mjs';
import USER from '../../services/models/user.mjs';

/********************
 Unauthenticated Routes
 *********************/
 export const POST_signup =  async(request: ProfileSignupRequest, response: Response, next: NextFunction) => {
    
    const newProfile:USER|undefined = createUserFromJSON({jsonObj:request.body, fieldList: SIGNUP_PROFILE_FIELDS});

    if(newProfile === undefined)
        next(new Exception(500, `Signup Failed :: Failed to parse input.`, 'Sign Up Failed'));

    else if(USER_TABLE_COLUMNS_REQUIRED.every((column) => newProfile[column] !== undefined) === false) 
        next(new Exception(400, `Signup Failed :: Missing Required Fields: ${JSON.stringify(USER_TABLE_COLUMNS_REQUIRED)}.`, 'Missing Details'));

    //Verify user roles and verify account type tokens
    else if(!(await newProfile.userRoleList.every(async (role:RoleEnum) => (await verifyNewAccountToken(role, request.body.userRoleTokenMap?.find(({userRole, token}) => (role === RoleEnum[userRole]))?.token, newProfile.email) === true))))
        next(new Exception(402, `Signup Failed :: failed to verify token for user roles: ${JSON.stringify(newProfile.userRoleList)}for new user ${newProfile.email}.`, 'Ineligible Account Type'));

    else if(await !DB_INSERT_USER(newProfile.getValidProperties(USER_TABLE_COLUMNS, false))) 
            next(new Exception(500, `Signup Failed :: Failed to save new user account.`, 'Save Failed'));

    //New Account Success -> Auto Login Response
    else { 
        //Add user roles, already verified permission above
        const insertRoleList:RoleEnum[] = newProfile.userRoleList.filter((role) => (role !== RoleEnum.STUDENT));
        if(insertRoleList.length > 0 && !DB_INSERT_USER_ROLE({email:newProfile.email, userRoleList: insertRoleList}))
            log.error(`SIGNUP: Error assigning userRoles ${JSON.stringify(insertRoleList)} to ${newProfile.email}`);

        const loginDetails:LoginResponseBody = await getUserLogin(newProfile.email, request.body['password']);

        if(loginDetails)
            response.status(201).send(loginDetails);
        else
            next(new Exception(404, `Signup Failed: Account successfully created; but failed to auto login new user.`));
    }
};


export const POST_login =  async(request: LoginRequest, response: Response, next: NextFunction) => {
    const loginDetails:LoginResponseBody = await getUserLogin(request.body['email'], request.body['password']);

    if(loginDetails)
        response.status(202).send(loginDetails);
    else
        next(new Exception(404, `Login Failed: Credentials do not match our records.`));
};

//Temporary for easy debugging
export const GET_allUserCredentials =  async (request: Request, response: Response, next: NextFunction) => { 
    const userList:CredentialProfile[] = await DB_SELECT_CREDENTIALS();
    response.status(200).send(userList);
}


/********************
 Authenticated Routes
 *********************/
 export const GET_jwtVerify = async (request: JwtRequest, response: JWTResponse, next: NextFunction) => { //After jwtAuthenticationMiddleware; already authenticated
    const body:JwtResponseBody = {
        jwt: generateJWT(request.jwtUserID, request.jwtUserRole as RoleEnum), //Update Token
        userID: request.jwtUserID,
        userRole: request.jwtUserRole as RoleEnum,
    }
    response.status(202).send(body);
};


 export const POST_logout =  async (request: JWTClientRequest, response: Response, next: NextFunction) => {
    
    const clientException = await extractClientProfile(request); 
    if(clientException) 
        next(clientException);

    else {
        response.status(200).send(`User ${request.clientID} has been logged out of Encouraging Prayer.`);
        
        log.auth(`User ${request.clientID} has been logged out of Encouraging Prayer.`);
    }
};

export const POST_authorization_reset = async (request:IdentityRequest, response:Response, next: NextFunction) => {
    generateSecretKey();
    response.status(202).send(`App secret key has been reset`);
    log.auth(`User ${request.userID} has reset the server's secret key`);
}
