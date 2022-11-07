import { Request, Response, NextFunction } from "express";
import {Exception} from "../api-types.mjs"
import * as log from '../../services/log.mjs';
import { CredentialRequest, loginResponse, loginResponseBody } from "./auth-types.mjs";
import { query, queryAll, queryTest } from "../../services/database.mjs";

  
/* Utility Methods */
const generateJWT = (userId:string):string => {

    return "100.100.100";
}

export const verifyJWT = (JWT:string, userId:string):Boolean => {

    return (JWT === "100.100.100");
}

export const authenticateJWT = async(request: CredentialRequest, response: Response, next: NextFunction):Promise<any> => {

    //Verify Credentials Exist
    if(!request.headers.jwt || !request.headers["user-id"])
        next(new Exception(400, `Authentication Failed: missing JWT or UserId in request header: ${request.headers.jwt} :: ${request.headers.userid}`));
    //Verify Client Exists
    if((await queryAll("SELECT user_id FROM user_table WHERE user_id = $1;", [request.headers["user-id"]])).length !== 1)
        next(new Exception(400, `Authentication Failed: User: ${request.headers["user-id"]} - DOES NOT EXIST`));
    //Verify JWT
    else if(!verifyJWT(request.headers.jwt, request.headers["user-id"])) 
        next(new Exception(401, `Authentication Failed JWT for User: ${request.headers["user-id"]}`));
    else {
        log.auth('User verified and authenticated: ', request.headers["user-id"]);
        next();
    }
}

export default authenticateJWT;


export const getLoginResponse = (userId: string):loginResponseBody => {
    //Database Query

    return {
        JWT: '100.100.100', 
        userId: 101, 
        userRole: 'Student', 
        displayName: 'Ethan', 
        profileImage: 'Profile Image coming soon.', 
        service: 'Email'
    };
}