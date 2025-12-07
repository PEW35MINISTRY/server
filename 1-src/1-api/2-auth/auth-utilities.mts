import jwtPackage, { JwtPayload } from 'jsonwebtoken';
import { RoleEnum } from '../../0-assets/field-sync/input-config-sync/profile-field-config.mjs';
import USER from '../../2-services/1-models/userModel.mjs';
import { DB_POPULATE_USER_PROFILE, DB_SELECT_USER } from '../../2-services/2-database/queries/user-queries.mjs';
import * as log from '../../2-services/10-utilities/logging/log.mjs';
import { JwtData, JwtRequest } from './auth-types.mjs';
import { LoginResponseBody } from '../../0-assets/field-sync/api-type-sync/auth-types.mjs';
import { GetSecretValueCommand, GetSecretValueResponse, SecretsManagerClient } from '@aws-sdk/client-secrets-manager';
import { DB_SELECT_USER_CONTENT_LIST } from '../../2-services/2-database/queries/content-queries.mjs';
import { hash, verify } from 'argon2';
import { ENVIRONMENT_TYPE } from '../../0-assets/field-sync/input-config-sync/inputField.mjs';
import { getEnvironment } from '../../2-services/10-utilities/utilities.mjs';


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
        return response.SecretString;
    } catch (error) {
        await log.alert(`JWT | AWS Secret Manager failed to connect to JWT Secret: ${process.env.JWT_SECRET_NAME} in Region: ${process.env.JWT_SECRET_REGION}.`, error, error.message);
        throw error;
    }
}

export const InitializeJWTSecretKey = async ():Promise<string> => {
    if(getEnvironment() === ENVIRONMENT_TYPE.PRODUCTION) {
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
    if(userID > 0 && userRole as RoleEnum !== undefined) {
        type ExpireTimeValue = '2h' | '15m' | '10d';  //jsonwebtoken has strick type format checking; here's a few options for
        
        // default config generates signature with HS256 - https://www.npmjs.com/package/jsonwebtoken
        return jwtPackage.sign({jwtUserID: userID, jwtUserRole: userRole}, APP_SECRET_KEY, {expiresIn: (process.env.JWT_DURATION || '15m') as ExpireTimeValue});
    } else {
        log.error(`JWT Generation Failed: INVALID userID: ${userID} or userRole: ${userRole}`);
        return '';
    }
}

export const verifyJWT = (jwt:string):boolean => {
    try {
        jwtPackage.verify(jwt, APP_SECRET_KEY);
        return true;
    } catch(error) {
        log.auth('Failed to verify JWT', error, error.message);
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
                log.auth(`validateNewRoleTokenList | Failed to validate role: ${role} for ${email}`, error.message);
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


/**************************
* LOGIN RESPONSE HANDLING *
***************************/
export enum LoginMethod {
    JWT = 'JWT',
    EMAIL = 'EMAIL',
    APPLE = 'APPLE',
    GOOGLE = 'GOOGLE',
    FACEBOOK = 'FACEBOOK'
}

export const getJWTLogin = async(userID:number, detailed = true):Promise<LoginResponseBody|undefined> => {
    const userProfile:USER = await DB_SELECT_USER(new Map([['userID', userID]]));
    return await assembleLoginResponse(LoginMethod.JWT, userProfile, detailed);
}

export const getEmailLogin = async(email:string = '', password: string = '', detailed = true):Promise<LoginResponseBody|undefined> => {
    const userProfile:USER = await DB_SELECT_USER(new Map([['email', email]]));

    // Verify user credentials
    if(!userProfile.isValid || userProfile.userID <= 0 
        || password === undefined || password.length === 0 
        || !(await verifyPassword(userProfile.passwordHash, password)))
            return undefined;

    return await assembleLoginResponse(LoginMethod.EMAIL, userProfile, detailed);
}

export const assembleLoginResponse = async(loginMethod:LoginMethod, userProfile:USER, detailed = true):Promise<LoginResponseBody|undefined> => {
    // Verify user credentials
    if(!userProfile.isValid || userProfile.userID <= 0)
        return undefined;
    
    if(detailed) 
        await DB_POPULATE_USER_PROFILE(userProfile);

    //Always include default content for dashboard
    else if(userProfile.recommendedContentList === undefined || userProfile.recommendedContentList.length === 0)
        userProfile.recommendedContentList = await DB_SELECT_USER_CONTENT_LIST(userProfile.userID, 5);

    if(getEnvironment() === ENVIRONMENT_TYPE.LOCAL)
        log.auth(`Logging in user ${userProfile.userID} via ${loginMethod}`);

    return {
        jwt: generateJWT(userProfile.userID, userProfile.getHighestRole()),
        userID: userProfile.userID,
        userRole: userProfile.getHighestRole(),
        userProfile: userProfile.toJSON(),
        service: loginMethod
    }
}


/*******************
 * Utility Methods *
 *******************/

//Since request.jwtUserRole is max role; this utility tests if userRole is possible
export const isMaxRoleGreaterThan = ({testUserRole, currentMaxUserRole}:{testUserRole:RoleEnum, currentMaxUserRole:RoleEnum}):boolean => 
    Object.values(RoleEnum).indexOf(testUserRole) <= Object.values(RoleEnum).indexOf(currentMaxUserRole);

export const verifyPassword = async (passwordHash:string, password:string):Promise<boolean> => {
    try {
        return await verify(passwordHash, password);

    } catch (error) { //Intentionally do not log
        return false;
    }
}

export const generatePasswordHash = async (password:string):Promise<string> => {
    return hash(password);
}
