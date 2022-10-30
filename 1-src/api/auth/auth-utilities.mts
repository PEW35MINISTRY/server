import { Request, Response, NextFunction } from "express";
import {Exception} from "../api-types.mjs"
import { loginResponse } from "./auth-types.mjs";

  
/* Utility Methods */
const generateJWT = (userId:String):String => {

    return "100.100.100";
}

export const verifyJWT = (JWT:String, userId:String):Boolean => {

    return (JWT === "100.100.100");
}

export const authenticateJWT = (request: Request|any, response: Response, next: NextFunction):any => {
    //Verify Credentials Exist
    if(!request.headers.jwt || !request.headers.userid)
        next(new Exception(400, `Authentication Failed: missing JWT or UserId in request header: ${request.headers.jwt} :: ${request.headers.userid}`));

    //Verify JWT
    if(verifyJWT(request.headers.jwt, request.headers.userid)) 
        next();
    else 
        next(new Exception(401, `Authentication Failed for User: ${request.headers.userid}`));
}

export default authenticateJWT;


export const getLoginResponse = (userId: String):loginResponse => {
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