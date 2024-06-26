import dotenv from 'dotenv';
import { NextFunction, Request, Response } from 'express';
import jwtPackage, { JwtPayload } from 'jsonwebtoken';
import { createHash } from 'node:crypto';
import { RoleEnum } from '../../0-assets/field-sync/input-config-sync/profile-field-config.mjs';
import USER from '../../2-services/1-models/userModel.mjs';
import { DB_SELECT_USER, DB_SELECT_USER_PROFILE } from '../../2-services/2-database/queries/user-queries.mjs';
import * as log from '../../2-services/log.mjs';
import { JwtData } from './auth-types.mjs';
import { LoginResponseBody } from '../../0-assets/field-sync/api-type-sync/auth-types.mjs';
import { GetSecretValueCommand, GetSecretValueResponse, SecretsManagerClient } from '@aws-sdk/client-secrets-manager';
dotenv.config(); 

/********************
   Create secret key
********************/
let APP_SECRET_KEY:string | undefined;

const getJWTSecretValue = async ():Promise<string> => {
    try {
        const client = new SecretsManagerClient({ region: process.env.JWT_SECRET_REGION });
        const response:GetSecretValueResponse = await client.send(new GetSecretValueCommand({
            SecretId: process.env.JWT_SECRET_NAME
        }));
        return JSON.parse(response.SecretString);
    } catch (error) {
        await log.alert(`JWT | AWS Secret Manager failed to connect to JWT Secret: ${process.env.JWT_SECRET_NAME} in Region: ${process.env.JWT_SECRET_REGION}.`, error);
        throw error;
    }
}

export const InitializeJWTSecretKey = async ():Promise<string> => {
    if(process.env.ENVIRONMENT === 'PRODUCTION') {
        APP_SECRET_KEY = await getJWTSecretValue();
    }
    else APP_SECRET_KEY = process.env.SECRET_KEY;
    return APP_SECRET_KEY;
}

await InitializeJWTSecretKey();

/* *******************
 JWT Token Management
******************* */
export const generateJWT = (userID:number, userRole:RoleEnum):string => {
    //generate JWT as type JWTData
    if(userID > 0 && userRole as RoleEnum !== undefined)
        // default config generates signature with HS256 - https://www.npmjs.com/package/jsonwebtoken
        return jwtPackage.sign({jwtUserID: userID, jwtUserRole: userRole}, APP_SECRET_KEY, {expiresIn: process.env.JWT_DURATION || '15 minutes'});
    else {
        log.error(`JWT Generation Failed: INVALID userID: ${userID} or userRole: ${userRole}`);
        return '';
    }
}

export const verifyJWT = (jwt:string):Boolean => {
    try {
        jwtPackage.verify(jwt, APP_SECRET_KEY);
        return true;
    } catch(err) {
        log.auth('Failed to verify JWT', err);
        return false;
    }
}

export const getJWTData = (jwt:string):JwtData => {
    const tokenObject:JwtPayload|string|null = jwtPackage.decode(jwt); //Does not verify
    if('jwtUserID' in (tokenObject as JwtData)) { //Must use type predicates
        return {
            jwtUserID: (tokenObject as JwtData).jwtUserID,
            jwtUserRole: ((tokenObject as JwtData).jwtUserRole as string) as RoleEnum,
        }
    } 
    //Default
    else 
        return {
            jwtUserID: 0,
            jwtUserRole: RoleEnum.USER,
        };
}

export const validateNewRoleTokenList = async({newRoleList, jsonRoleTokenList, email, currentRoleList, adminOverride}
                                        :{newRoleList:RoleEnum[], jsonRoleTokenList:{role: RoleEnum, token: string}[], email:string, currentRoleList?:RoleEnum[], adminOverride?:boolean}) => 
    await [...newRoleList].every( async(role:RoleEnum) => {
        if(adminOverride) 
            return true;
        else if(currentRoleList !== undefined && currentRoleList.includes(role)) 
            return true;
        else if(role === RoleEnum.USER)
            return true;
        else {
            try {
                const roleTokenItem = jsonRoleTokenList.find(({role: userRole, token}) => (role === RoleEnum[userRole]));
                const authenticationToken = roleTokenItem?.token;

                return await verifyNewAccountToken(role, authenticationToken, email);

            } catch(error) {
                log.auth(`validateNewRoleTokenList | Failed to validate role: ${role} for ${email}`);
                return false;
            }
        }
    });

//Create Account token required for non 'USER' accounts
const verifyNewAccountToken = async(userRole:RoleEnum = RoleEnum.USER, token:string, email:string):Promise<boolean> => {
    log.auth('New Account Authorized attempted: ', userRole, token, email);

    if(userRole === undefined || token === undefined || email === undefined) return false;

    switch(userRole as RoleEnum) {
        case RoleEnum.USER:
            return true;

        //Universal Token Codes
        case RoleEnum.ADMIN:
            return token === process.env.TOKEN_ADMIN;
        case RoleEnum.DEVELOPER:
            return token === process.env.TOKEN_DEVELOPER;
        case RoleEnum.CONTENT_APPROVER:
            return token === process.env.TOKEN_CONTENT_APPROVER;
        case RoleEnum.CIRCLE_LEADER:
            return token === process.env.TOKEN_CIRCLE_LEADER;

    //Individual Codes:
    //TODO Query Special Database

        default:
            return false;
    }
}

//Login Operation
export const getUserLogin = async(email:string = '', password: string = '', detailed = true):Promise<LoginResponseBody|undefined> => {
    //Query Database
    const passwordHash:string = getPasswordHash(password);
    const userProfile:USER = detailed ? await DB_SELECT_USER_PROFILE(new Map([['email', email], ['passwordHash', passwordHash]]))
    : await DB_SELECT_USER(new Map([['email', email], ['passwordHash', passwordHash]]));

    if(userProfile.userID > 0) {
        log.auth('Successfully logged in user: ', userProfile.userID);

        return {
            jwt: generateJWT(userProfile.userID, userProfile.getHighestRole()),
            userID: userProfile.userID,
            userRole: userProfile.getHighestRole(),
            userProfile: userProfile.toJSON(),
            service: 'Email & Password Authenticated'
        }

    //Login Failed
    } else {
        return undefined;  
    }
}


/* *******************
 Utility Methods
******************* */

//Since request.jwtUserRole is max role; this utility tests if userRole is possible
export const isMaxRoleGreaterThan = ({testUserRole, currentMaxUserRole}:{testUserRole:RoleEnum, currentMaxUserRole:RoleEnum}):boolean => 
    Object.values(RoleEnum).indexOf(testUserRole) <= Object.values(RoleEnum).indexOf(currentMaxUserRole);

export const getPasswordHash = (password:string):string => {
    return password;
}
