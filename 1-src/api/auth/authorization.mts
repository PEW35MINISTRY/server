import { Request, Response, NextFunction } from "express";
import {Exception} from "../api-types.mjs"
import * as log from '../../services/log.mjs';
import { CredentialRequest } from "./auth-types.mjs";
import { queryAll } from "../../services/database.mjs";
import { DB_USER } from "../../services/database-types.mjs";
import { RoleEnum } from "../profile/profile-types.mjs";
import { isRequestorAllowedProfile, verifyJWT } from "./auth-utilities.mjs";
import { CircleRequest } from "../circle/circle-types.mjs";

/* *******************
 Middleware Authentication
******************* */

//Private Local Utility
const generalAuthentication = async(request: CredentialRequest, response: Response, next: NextFunction):Promise<Boolean> => {
    //Verify Credentials Exist
    if(!request.headers.jwt || !request.headers["user-id"])
        next(new Exception(400, `FAILED AUTHENTICATED :: IDENTITY :: missing JWT or UserId in request header: ${request.headers.jwt} :: ${request.headers["user-id"]}`));

    //Verify Client Exists
    const userId:number = request.headers['user-id'];
    const requestorId:number = request.headers["requestor-id"] || request.headers["user-id"];

    const userIdList:DB_USER[] = (request.userProfile) ? [request.userProfile] : await queryAll("SELECT * FROM user_table WHERE user_id = $1;", [userId]);
    const requestorIdList:DB_USER[] = (userId === requestorId) ? userIdList : (request.requestorProfile) ? [request.requestorProfile] :  await queryAll("SELECT * FROM user_table WHERE user_id = $1;", [requestorId]);

    if(requestorIdList.length !== 1)
      next(new Exception(400, `FAILED AUTHENTICATED :: IDENTITY :: Requestor: ${requestorId} - DOES NOT EXIST`));
    if(userIdList.length !== 1)
      next(new Exception(400, `FAILED AUTHENTICATED :: IDENTITY :: User: ${userId} - DOES NOT EXIST`));

    //Verify JWT
    else if(!verifyJWT(request.headers['jwt'], requestorId)) 
        next(new Exception(401, `FAILED AUTHENTICATED :: IDENTITY :: Invalid JWT for User: ${requestorId}`));

    else {
        request.userId = userId;
        request.userProfile = userIdList[0];
        request.requestorId = requestorId;
        request.requestorProfile = requestorIdList[0];
        return true;
    }

    return false;
}

// #1 - Verify Identity
export const authenticateIdentity = async(request: CredentialRequest, response: Response, next: NextFunction):Promise<Boolean> => {

    if(await generalAuthentication(request, response, next)) {
        log.auth(`AUTHENTICATED :: IDENTITY :: status verified: Requestor: ${request.requestorId} has a PEW35 Account.`);
        next();
        return true;
    } else {
        next(new Exception(401, `FAILED AUTHENTICATED :: IDENTITY :: Requestor: ${request.requestorId} does not have a PEW35 account.`));
    }
}

// #2 - Verify Partner Status
export const authenticatePartner = async(request: CredentialRequest, response: Response, next: NextFunction):Promise<Boolean> => { //TODO: query patch to remove unmatched partner

    if(request.userProfile.partners && request.requestorProfile.partners
        && request.userProfile.partners.includes(request.requestorId) 
        && request.requestorProfile.partners.includes(request.userId)) {

        log.auth(`AUTHENTICATED :: PARTNER :: status verified: Requestor: ${request.requestorId} is a partner of User: ${request.userId}`);
        next();
        return true;
    } else {
        next(new Exception(401, `FAILED AUTHENTICATED :: PARTNER :: Requestor: ${request.requestorId} is not a partner of User: ${request.userId}`));
    }
}


// #3 - Verify Circle Status
export const authenticateCircle = async(request: CircleRequest, response: Response, next: NextFunction):Promise<Boolean> => {

    if(request.requestorProfile.circles.includes(request.headers["circle-id"])) {

        request.circleId = request.headers["circle-id"]; 

        log.auth(`AUTHENTICATED :: CIRCLE :: status verified: Requestor: ${request.requestorId} is a member of CIRCLE: ${request.headers["circle-id"]}`);
        next();
        return true;
    } else {
        next(new Exception(401, `FAILED AUTHENTICATED :: CIRCLE :: Requestor: ${request.requestorId} denied access to circle: ${request.headers["circle-id"]}`));
    }
}


// #4 - Verify User Profile Access
export const authenticateProfile = async(request: CredentialRequest, response: Response, next: NextFunction):Promise<Boolean> => {

    //Verify Requestor Authorization
        if(await isRequestorAllowedProfile(request.userProfile, request.requestorProfile)) {

            log.auth(`AUTHENTICATED :: USER :: profile status verified: Requestor: ${request.requestorId} has access to User: ${request.userId}`);
            next();
            return true;
        } else {
            next(new Exception(401, `FAILED AUTHENTICATED :: USER :: Requestor: ${request.requestorId} denied access to User: ${request.userId}`));
            return false;
        }
}


// #5 - Verify Leader Access
export const authenticateLeader = async(request: CircleRequest, response: Response, next: NextFunction):Promise<Boolean> => {

    if(RoleEnum[request.requestorProfile.user_role as string] === RoleEnum.ADMIN 
        || RoleEnum[request.requestorProfile.user_role as string] === RoleEnum.LEADER
            && request.requestorProfile.circles.includes(request.headers["circle-id"])) {

            log.auth(`AUTHENTICATED :: LEADER :: status verified: Requestor: ${request.requestorId} is a LEADER of circle: ${request.headers["circle-id"]}`);
            next();
        return true;
    } else {
        next(new Exception(401, `FAILED AUTHENTICATED :: LEADER :: Requestor: ${request.requestorId} denied access to circle: ${request.headers["circle-id"]}`));
    }
}


// #6 - Verify ADMIN Access
export const authenticateAdmin = async(request: CredentialRequest, response: Response, next: NextFunction):Promise<Boolean> => {

    if(RoleEnum[request.requestorProfile.user_role as string] === RoleEnum.ADMIN) {

        log.auth(`AUTHENTICATED :: ADMIN :: status verified: Requestor: ${request.requestorId} is an ADMIN`);
        next();
        return true;
    } else {
        next(new Exception(401, `FAILED AUTHENTICATED :: ADMIN :: Requestor: ${request.requestorId} is not an ADMIN.`));
    }
}
