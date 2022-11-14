import { Request, Response, NextFunction } from "express";
import {Exception} from "../api-types.mjs"
import * as log from '../../services/log.mjs';
import { CredentialRequest, LoginRequest, loginResponse, LoginResponseBody, SignupRequest } from "./auth-types.mjs";
import { query, queryAll, queryTest, TestResult } from "../../services/database.mjs";
import { DB_USER } from "../../services/database-types.mjs";
import { RoleEnum } from "../profile/profile-types.mjs";
import { formatProfile } from "../profile/profile-utilities.mjs";

  

/* *******************
 JWT Token Management
******************* */
export const generateJWT = async(userId:number):Promise<string> => {
    //generate JWT
    return '100.100.100';
}

export const updateJWTQuery = async(userId:number):Promise<string> => {
    //generate JWT
    const JWT:string = await generateJWT(userId);

    const query:TestResult  =await queryTest(`UPDATE user_table SET jwt = $1 WHERE user_id = $2;`, [JWT, userId]);

    if(query.success) return JWT;
    else {
        new Exception(502, 'Database Failed to save JWT: Error: '+query.error);
        // return null;
    }
}

export const verifyJWT = (JWT:string, userId:number):Boolean => {
    //Verify JWT still valid

    return (JWT === "100.100.100");
}

//Login Operation
export const getUserLogin = async(email:string, password: string, next: NextFunction):Promise<LoginResponseBody> => {
    //Query Database
    const passwordHash:string = getPasswordHash(password);
    const userProfile:DB_USER = await query("SELECT * FROM user_table WHERE (email = $1 AND password_hash = $2);", [email, passwordHash]);

    //Login Failed
    if (userProfile && !userProfile.verified) {
        next(new Exception(403, `Login Failed: Please verify account for user: ${userProfile.user_id} as a ${userProfile.user_role}.`));
        // return null;  

    //Login Success
    } else if(userProfile && userProfile.user_id) {
        log.auth("Successfully logged in user: ", userProfile.user_id);

        return {
            JWT: await updateJWTQuery(userProfile.user_id),
            userId: userProfile.user_id,
            userProfile: formatProfile(userProfile),
            service: 'Email & Password Authenticated'
        }

    //Login Failed
    } else {
        next(new Exception(400, `Login Failed: Email and/or Password does not match our records.`));
        // return null;  
    }
}


/* *******************
 Utility Methods
******************* */

export const isRequestorAllowedProfile = async(userProfile: DB_USER, requestorProfile: DB_USER):Promise<boolean> => { //TODO: add column circleId to leader Table

    if(userProfile.user_id === requestorProfile.user_id || requestorProfile.user_role === RoleEnum.ADMIN) return true;

    //Test Member of Leader's Circle
    if(requestorProfile.user_role === RoleEnum.LEADER) {
        return (requestorProfile.circles.find((circleId, index) => {
            return userProfile.circles.includes(circleId);
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
    return 'password';
}
