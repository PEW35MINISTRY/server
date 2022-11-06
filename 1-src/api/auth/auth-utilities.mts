import { Request, Response, NextFunction } from "express";
import {Exception} from "../api-types.mjs"
import * as log from '../../services/log.mjs';
import { CredentialRequest, loginResponse, loginResponseBody } from "./auth-types.mjs";

  
/* Utility Methods */
const generateJWT = (userId:String):String => {

    return "100.100.100";
}

export const verifyJWT = (JWT:String, userId:String):Boolean => {

    return (JWT === "100.100.100");
}

export const authenticateJWT = (request: CredentialRequest, response: Response, next: NextFunction):any => {

    log.auth('Authenticating User: ', request.headers["user-id"]);

    //Verify Credentials Exist
    if(!request.headers.jwt || !request.headers["user-id"])
        next(new Exception(400, `Authentication Failed: missing JWT or UserId in request header: ${request.headers.jwt} :: ${request.headers.userid}`));

    //Verify JWT
    if(verifyJWT(request.headers.jwt, request.headers["user-id"])) 
        next();
    else 
        next(new Exception(401, `Authentication Failed for User: ${request.headers["access-control-allow-methods"]}`));
}

export default authenticateJWT;


export const getLoginResponse = (userId: String):loginResponseBody => {
    //Database Query

    return {
        JWT: '100.100.100', 
        userId: '101', 
        userRole: 'Student', 
        displayName: 'Ethan', 
        profileImage: 'Profile Image coming soon.', 
        service: 'Email'
    };
}