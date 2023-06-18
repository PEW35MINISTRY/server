import { Request, Response, NextFunction } from "express";
import {Exception} from "../api-types.mjs"
import * as log from '../../services/log.mjs';
import { IdentityRequest, JWTData, LoginRequest, LoginResponse, LoginResponseBody, SignupRequest } from "./auth-types.mjs";
import { query, queryAll, queryTest, TestResult } from "../../services/database/database.mjs";
import { DB_USER } from "../../services/database/database-types.mjs";
import { formatProfile } from "../profile/profile-utilities.mjs";
import JWT_PKG, { JwtPayload } from "jsonwebtoken";
import { createHash } from 'node:crypto'
import dotenv from 'dotenv';
import { RoleEnum } from "../profile/Fields-Sync/profile-field-config.mjs";
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
export const generateJWT = (userId:number, userRole:RoleEnum):string => {
    //generate JWT as type JWTData
    if(userId > 0 && userRole as RoleEnum !== undefined)
        return sign({jwtUserId: userId, jwtUserRole: userRole}, APP_SECRET_KEY, {expiresIn: "2 days"});
    else {
        log.error(`JWT Generation Failed: INVALID userId: ${userId} or userRole: ${userRole}`);
        return '';
    }
}

export const verifyJWT = (JWT:string):Boolean => {
    try {
        verify(JWT, APP_SECRET_KEY);
        return true;
    } catch(err) {
        log.auth("Failed to verify JWT", err);
        return false;
    }
}

export const getJWTData = (JWT:string):JWTData => {
    const tokenObject:JwtPayload|string|null = decode(JWT); //Does not verify
    if('jwtUserId' in (tokenObject as JWTData)) { //Must use type predicates
        return {
            jwtUserId: (tokenObject as JWTData).jwtUserId,
            jwtUserRole: ((tokenObject as JWTData).jwtUserRole as string) as RoleEnum,
        }
    } 
    //Default
    else 
        return {
            jwtUserId: 0,
            jwtUserRole: RoleEnum.STUDENT,
        };
}

//Create Account token required for non student accounts
export const verifyNewAccountToken = async(token: string, email: string, userRole: string = RoleEnum.STUDENT):Promise<boolean> => {

    switch(userRole as RoleEnum) {
        case RoleEnum.STUDENT:
            return true;

        //Universal Token Codes (Save to ENV)
        case RoleEnum.ADMIN:
            return token === 'ADMIN';
        case RoleEnum.DEVELOPER:
            return token === "DEVELOPER";
        case RoleEnum.CONTENT_APPROVER:
            return token === "APPROVER";
        case RoleEnum.CIRCLE_LEADER:
            return token === "LEADER";

        //Individual Codes:
    //TODO Query Special Database
        default:
            return false;
    }
}

//Login Operation
export const getUserLogin = async(email:string = '', displayName:string = '', password: string = ''):Promise<LoginResponseBody|undefined> => {
    //Query Database
    const passwordHash:string = getPasswordHash(password);
    const userProfile:DB_USER = await query("SELECT * FROM user_table WHERE ((email = $1 OR display_name = $2) AND password_hash = $3);", [email, displayName, passwordHash]);

    if(userProfile && userProfile.user_id) {
        log.auth("Successfully logged in user: ", userProfile.user_id);

        return {
            JWT: generateJWT(userProfile.user_id, (userProfile.user_role as string) as RoleEnum),
            userId: userProfile.user_id,
            userRole: (userProfile.user_role as string) as RoleEnum,
            userProfile: formatProfile(userProfile),
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

export const isRequestorAllowedProfile = async(clientProfile: DB_USER, userProfile: DB_USER):Promise<boolean> => { //TODO: add column circleId to leader Table
    const userRole:RoleEnum = userProfile.user_role as RoleEnum;
    if(clientProfile.user_id === userProfile.user_id || userRole === RoleEnum.ADMIN) return true;

    //Test Member of Leader's Circle
    if(userRole === RoleEnum.CIRCLE_LEADER) {
        return (userProfile.circles && userProfile.circles.find((circleId, index) => {
            return clientProfile.circles.includes(circleId);
          }))
          ? true : false; //Because .find returns undefine for no match
    }
    return false;
}

export const isRequestorAllowedProfileQuery = async(userId: number, requestorId: number):Promise<boolean> => {

    const userProfile = await query("SELECT * FROM user_table WHERE user_id = $1;", [userId]);
    const requestorProfile = await query("SELECT * FROM user_table WHERE user_id = $1;", [requestorId]);

    return await isRequestorAllowedProfile(userProfile, requestorProfile);
}

export const getPasswordHash = (password:string):string => {
    return password;
}
