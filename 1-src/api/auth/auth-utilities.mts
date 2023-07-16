import { Request, Response, NextFunction } from "express";
import {Exception} from "../api-types.mjs"
import * as log from '../../services/log.mjs';
import { JwtData, LoginResponseBody } from "./auth-types.mjs";
import JWT_PKG, { JwtPayload } from "jsonwebtoken";
import { createHash } from 'node:crypto'
import { RoleEnum } from "../profile/Fields-Sync/profile-field-config.mjs";
import { DB_SELECT_USER_PROFILE } from "../../services/database/queries/user-queries.mjs";
import USER from "../../services/models/user.mjs";
import dotenv from 'dotenv';
dotenv.config(); 

const {sign, verify, decode} = JWT_PKG;

/********************
   Create secret key
********************/
var APP_SECRET_KEY;

export const generateSecretKey = () => {
   const time = new Date().getTime();
   APP_SECRET_KEY = createHash("sha256").update(time + process.env.SECRET_KEY).digest("base64");
}
generateSecretKey();

/* *******************
 JWT Token Management
******************* */
export const generateJWT = (userID:number, userRole:RoleEnum):string => {
    //generate JWT as type JWTData
    if(userID > 0 && userRole as RoleEnum !== undefined)
        return sign({jwtUserID: userID, jwtUserRole: userRole}, APP_SECRET_KEY, {expiresIn: "2 days"});
    else {
        log.error(`JWT Generation Failed: INVALID userID: ${userID} or userRole: ${userRole}`);
        return '';
    }
}

export const verifyJWT = (jwt:string):Boolean => {
    try {
        verify(jwt, APP_SECRET_KEY);
        return true;
    } catch(err) {
        log.auth("Failed to verify JWT", err);
        return false;
    }
}

export const getJWTData = (jwt:string):JwtData => {
    const tokenObject:JwtPayload|string|null = decode(jwt); //Does not verify
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
            jwtUserRole: RoleEnum.STUDENT,
        };
}

export const validateNewRoleTokenList = async({newRoleList, jsonRoleTokenList, email, currentRoleList, adminOverride}
                                        :{newRoleList:RoleEnum[], jsonRoleTokenList:{role: RoleEnum, token: string}[], email:string, currentRoleList?:RoleEnum[], adminOverride?:boolean}) => 
    await [...newRoleList].every( async(role:RoleEnum) => {
        if(adminOverride) 
            return true;
        else if(currentRoleList !== undefined && currentRoleList.includes(role)) 
            return true;
        else if(role === RoleEnum.STUDENT)
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

//Create Account token required for non student accounts (Not required for )
const verifyNewAccountToken = async(userRole:RoleEnum = RoleEnum.STUDENT, token:string, email:string):Promise<boolean> => {
    log.auth('New Account Authorized attempted: ', userRole, token, email);

    if(userRole === undefined || token === undefined || email === undefined) return false;

    switch(userRole as RoleEnum) {
        case RoleEnum.STUDENT:
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
""
        //Individual Codes:
    //TODO Query Special Database
        default:
            return false;
    }
}

//Login Operation
export const getUserLogin = async(email:string = '', password: string = ''):Promise<LoginResponseBody|undefined> => {
    //Query Database
    const passwordHash:string = getPasswordHash(password);
    const userProfile:USER = await DB_SELECT_USER_PROFILE(new Map([['email', email], ['passwordHash', passwordHash]]));

    if(userProfile.userID > 0) {
        log.auth("Successfully logged in user: ", userProfile.userID);

        return {
            jwt: generateJWT(userProfile.userID, userProfile.getHighestRole()),
            userID: userProfile.userID,
            userRole: userProfile.getHighestRole(),
            userProfile: userProfile.toProfileJSON(),
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

export const isRequestorAllowedProfile = async(clientProfile:USER, userProfile:USER):Promise<boolean> => {
    if(clientProfile.userID === userProfile.userID || userProfile.isRole(RoleEnum.ADMIN)) return true;

    //Test Member of Leader's Circle
    if(userProfile.isRole(RoleEnum.CIRCLE_LEADER)) {
        // const clientLeaderIDList:number[] = await DB_SELECT_CIRCLE_LEADER_IDS(clientProfile.userID);
        // return (clientLeaderIDList.includes(userProfile.userID));
    }
    return false;
}


export const getPasswordHash = (password:string):string => {
    return password;
}
