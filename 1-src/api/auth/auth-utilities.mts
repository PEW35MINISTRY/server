import { Request, Response, NextFunction } from "express";
import {Exception} from "../api-types.mjs"
import * as log from '../../services/log.mjs';
import { CredentialRequest, loginResponse, loginResponseBody } from "./auth-types.mjs";
import { query, queryAll, queryTest } from "../../services/database.mjs";
import { DB_USER } from "../../services/database-types.mjs";
import { RoleEnum } from "../profile/profile-types.mjs";

  
/* Utility Methods */
const generateJWT = (requestorId:string):string => {

    return "100.100.100";
}

export const verifyJWT = (JWT:string, requestorId:number):Boolean => {
    

    return (JWT === "100.100.100");
}

//Private Local Utility
const generalAuthentication = async(request: CredentialRequest, response: Response, next: NextFunction):Promise<Boolean> => {

    //Verify Credentials Exist
    if(!request.headers.jwt || !request.headers["user-id"])
        next(new Exception(400, `Authentication Failed: missing JWT or UserId in request header: ${request.headers.jwt} :: ${request.headers.userid}`));

    //Verify Client Exists
    const userId:number = parseInt(request.headers['user-id'] as unknown as string);
    const requestorId:number = parseInt(request.headers["requestor-id"] as string || request.headers["user-id"] as string);

    const userIdList:DB_USER[] = await queryAll("SELECT * FROM user_table WHERE user_id = $1;", [userId]);
    const requestorIdList:DB_USER[] = (userId === requestorId) ? userIdList : await queryAll("SELECT * FROM user_table WHERE user_id = $1;", [requestorId]);


    if(userIdList.length !== 1 && requestorIdList.length !== 1) 
        next(new Exception(400, `Authentication Failed: User: ${userId} OR Requestor: ${requestorId} - DOES NOT EXIST`));

    //Verify JWT
    else if(!verifyJWT(request.headers.jwt, requestorId)) 
        next(new Exception(401, `Authentication Failed JWT for User: ${userId}`));

    else {
        request.headers.userId = userId;
        request.headers.userProfile = userIdList[0];
        request.headers.requestorId = requestorId;
        request.headers.requestorProfile = requestorIdList[0];
        return true;
    }

    return false;
}


export const authenticateIdentity = async(request: CredentialRequest, response: Response, next: NextFunction):Promise<Boolean> => {

    if(generalAuthentication(request, response, next)) {

        log.auth(`AUTHENTICATED :: User verified, and authenticated: Requestor: ${request.headers.requestorId} has access to User: ${request.headers.userId}`);
        next();
        return true;
    }
    return false;
}

export const authenticateIdentityAndAdmin = async(request: CredentialRequest, response: Response, next: NextFunction):Promise<Boolean> => {

    if(generalAuthentication(request, response, next) && RoleEnum[request.headers.requestorProfile.user_role as string] === RoleEnum.ADMIN) {

        log.auth(`AUTHENTICATED :: User verified, and authenticated: Requestor: ${request.headers.requestorId} has access to User: ${request.headers.userId}`);
        next();
        return true;
    }
    return false;
}

export const authenticateIdentityAndAccess = async(request: CredentialRequest, response: Response, next: NextFunction):Promise<Boolean> => {

    if(generalAuthentication(request, response, next)) {

        //Verify Requestor Authorization
        if(!isRequestorAllowed(request.headers.userId, request.headers.requestorId)) 
            next(new Exception(401, `Authentication Failed Authorization for Requestor: ${request.headers.requestorId} to access User: ${request.headers.userId}`));

        else {
            log.auth(`TOTAL AUTHORIZATION :: User verified, authorized, and authenticated: Requestor: ${request.headers.requestorId} has access to User: ${request.headers.userId}`);
            next();
            return true;
        }
    }
    return false;
}

export const authenticateRequestorAllowed = async(request: CredentialRequest, response: Response, next: NextFunction):Promise<Boolean> => {

    //Verify Requestor Authorization
    if(!isRequestorAllowed(request.headers.userId, request.headers.requestorId)) 
        next(new Exception(401, `Authentication Failed Authorization for Requestor: ${request.headers.requestorId} to access User: ${request.headers.userId}`));

    else {
        log.auth(`ACCESS :: User verified, authorized, and authenticated: Requestor: ${request.headers.requestorId} has access to User: ${request.headers.userId}`);
        next();
        return true;
    }
    return false;
}

export default authenticateIdentityAndAccess;

export const isRequestorAllowed = async(userId: number, requestorId: number):Promise<boolean> => {
    //TODO: add column circleId to leader Table
    const requestorRoleAndCircle = await query("SELECT user_role FROM user_table WHERE user_id = $1;", [requestorId]);

    if(userId === requestorId || requestorRoleAndCircle.user_role === RoleEnum.ADMIN) return true;

    //Test Member of Leader's Circle
    if(requestorRoleAndCircle.user_role === RoleEnum.LEADER) {
        // const userCircleList = await query("SELECT circleList FROM user_table WHERE user_id = $1;", [userId]);
        // if(userCircleList.includes(requestorRoleAndCircle.circleId))
            return true;
    }
    return false;
}

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