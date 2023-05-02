import { Request, Response, NextFunction } from "express";
import {Exception} from "../api-types.mjs"
import * as log from '../../services/log.mjs';
import { IdentityRequest, LoginRequest, loginResponse, LoginResponseBody, SignupRequest } from "./auth-types.mjs";
import { query, queryAll, queryTest, TestResult } from "../../services/database/database.mjs";
import { DB_USER } from "../../services/database/database-types.mjs";
import { RoleEnum } from "../profile/profile-types.mjs";
import { formatProfile } from "../profile/profile-utilities.mjs";
import JWT_PKG, { JwtPayload } from "jsonwebtoken";
import { createHash } from 'node:crypto'
import dotenv from 'dotenv';
dotenv.config(); 

const {sign, verify} = JWT_PKG;

/********************
   Create secret key
********************/
var APP_SECRET_KEY;

export const generateSecretKey = () => {
   const time = new Date().getTime();
   APP_SECRET_KEY = createHash("sha256").update(time + process.env.SECRET_KEY).digest("base64");
}


/* *******************
 JWT Token Management
******************* */
export const generateJWT = (userProfile:DB_USER):string => {
    //generate JWT
    return sign({userID: userProfile.user_id, userRole: userProfile.user_role}, APP_SECRET_KEY, {expiresIn: "2 days"});
}

export const verifyJWT = (JWT:string):Boolean => {
    //Verify JWT still valid
    try {
        verify(JWT, APP_SECRET_KEY);
        return true;
    } catch(err) {
        console.log(err);
        return false;
    }
}

export const getJWTData = (JWT:string):string | JwtPayload => {
    return verify(JWT, APP_SECRET_KEY);
}

//Create Account token required for non student accounts
export const verifyNewAccountToken = async(token: string, email: string, userRole: string = RoleEnum.STUDENT):Promise<boolean> => {

    switch(RoleEnum[userRole as string]) {
        case RoleEnum.STUDENT:
            return true;

        //Universal Token Codes (Save to ENV)
        case RoleEnum.ADMIN:
            return token === 'ADMIN';
        case RoleEnum.LEADER:
            return token === "LEADER";

        //Individual Codes:
            default:
    //TODO Query Special Database
            // return await queryAll(`SELECT ');
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
            JWT: generateJWT(userProfile),
            userId: userProfile.user_id,
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

    if(clientProfile.user_id === userProfile.user_id || userProfile.user_role === RoleEnum.ADMIN) return true;

    //Test Member of Leader's Circle
    if(userProfile.user_role === RoleEnum.LEADER) {
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
generateSecretKey();