import { Request, Response, NextFunction } from "express";
import {Exception} from "../api-types.mjs"
import * as log from '../../services/log.mjs';
import { CredentialRequest, LoginRequest, loginResponse, LoginResponseBody, SignupRequest } from "./auth-types.mjs";
import { query, queryAll, queryTest, TestResult } from "../../services/database/database.mjs";
import { DB_USER } from "../../services/database/database-types.mjs";
import { RoleEnum } from "../profile/profile-types.mjs";
import { formatProfile } from "../profile/profile-utilities.mjs";

  

/* *******************
 JWT Token Management
******************* */
export const generateJWT = async(userProfile:DB_USER):Promise<string> => {
    //generate JWT
    return '100.100.100';
}

export const verifyJWT = (JWT:string):Boolean => {
    //Verify JWT still valid

    return (JWT === "100.100.100");
}

//Login Operation
export const getUserLogin = async(email:string, password: string, next: NextFunction, verifyVerification = true):Promise<LoginResponseBody> => {
    //Query Database
    const passwordHash:string = getPasswordHash(password);
    const userProfile:DB_USER = await query("SELECT * FROM user_table WHERE (email = $1 AND password_hash = $2);", [email, passwordHash]);

    //Login Failed
    if (verifyVerification && userProfile && !userProfile.verified) {
        next(new Exception(403, `Login Failed: Please verify account for user: ${userProfile.user_id} as a ${userProfile.user_role}.`));
        // return null;  

    //Login Success
    } else if(userProfile && userProfile.user_id) {
        log.auth("Successfully logged in user: ", userProfile.user_id);

        return {
            JWT: await generateJWT(userProfile),
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
