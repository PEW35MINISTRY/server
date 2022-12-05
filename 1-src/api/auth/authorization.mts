import { Request, Response, NextFunction } from "express";
import {Exception} from "../api-types.mjs"
import * as log from '../../services/log.mjs';
import { CircleRequest, CredentialRequest, ProfileRequest } from "./auth-types.mjs";
import { queryAll } from "../../services/database/database.mjs";
import { DB_USER } from "../../services/database/database-types.mjs";
import { RoleEnum } from "../profile/profile-types.mjs";
import { isRequestorAllowedProfile, verifyJWT } from "./auth-utilities.mjs";

/* *******************
 Middleware Authentication
******************* */

//Private Local Utility  | User-id from header
const generalAuthentication = async(request: CredentialRequest, response: Response, next: NextFunction):Promise<Boolean> => {
    //Verify Credentials Exist
    if(!request.headers.jwt || !request.headers["user-id"])
        next(new Exception(400, `FAILED AUTHENTICATED :: IDENTITY :: missing JWT or UserId in request header: ${request.headers.jwt} :: ${request.headers["user-id"]}`));

    //Verify Client Exists
    const userId:number = request.headers['user-id'];

    const userIdList:DB_USER[] = await queryAll("SELECT * FROM user_table WHERE user_id = $1;", [userId]);

    if(userIdList.length !== 1)
      next(new Exception(400, `FAILED AUTHENTICATED :: IDENTITY :: User: ${userId} - DOES NOT EXIST`));

    //Verify JWT
    else if(!verifyJWT(request.headers['jwt'], userId)) 
        next(new Exception(401, `FAILED AUTHENTICATED :: IDENTITY :: Invalid JWT for User: ${userId}`));

    else {
        request.userId = userId;
        request.userProfile = userIdList[0];
        return true;
    }
    return false;
}

// #1 - Verify Identity
export const authenticateIdentity = async(request: CredentialRequest, response: Response, next: NextFunction):Promise<Boolean> => {

    if(await generalAuthentication(request, response, next)) {
        log.auth(`AUTHENTICATED :: IDENTITY :: status verified: User: ${request.userId} has a PEW35 Account.`);
        next();
        return true;
    } else {
        next(new Exception(401, `FAILED AUTHENTICATED :: IDENTITY :: User: ${request.userId} does not have a PEW35 account.`));
    }
}

//Authenticate another User, where existing user has access
export const clientAuthentication = async(request: ProfileRequest, response: Response, next: NextFunction):Promise<Boolean> => {
    //Verify Credentials Exist
    if(!request.params.client)
        next(new Exception(400, `FAILED AUTHENTICATED :: CLIENT :: missing client-id parameter :: ${request.params.client}`));

    //Verify Client Exists
    const partnerId:number = parseInt(request.params.client);

    const partnerIdList:DB_USER[] = await queryAll("SELECT * FROM user_table WHERE user_id = $1;", [partnerId]);

    if(partnerIdList.length !== 1)
      next(new Exception(400, `FAILED AUTHENTICATED :: CLIENT :: User: ${partnerId} - DOES NOT EXIST`));

    else  {            
        request.clientId = partnerId;
        request.clientProfile = partnerIdList[0];
        return true;
    } 
    return false;
}

// #2 - Verify Partner Status
export const authenticatePartner = async(request: ProfileRequest, response: Response, next: NextFunction):Promise<Boolean> => { //TODO: query patch to remove unmatched partner

    if(await clientAuthentication(request, response, next)
        && request.userProfile.partners && request.clientProfile.partners
            && request.userProfile.partners.includes(request.clientId) 
            && request.clientProfile.partners.includes(request.userId)) {

        log.auth(`AUTHENTICATED :: PARTNER :: status verified: Requestor: ${request.userId} is a partner of User: ${request.clientId}`);
        next();
        return true;
    } else {
        next(new Exception(401, `FAILED AUTHENTICATED :: PARTNER :: Requestor: ${request.userId} is not a partner of User: ${request.clientId}`));
    }
}

export const circleAuthentication = async(request: CircleRequest, response: Response, next: NextFunction):Promise<Boolean> => {
    //Verify Credentials Exist
    if(!request.params.circle)
        next(new Exception(400, `FAILED AUTHENTICATED :: CIRCLE :: missing circle-id parameter :: ${request.params.circle}`));

    //Verify Client Exists
    const circleId:number = parseInt(request.params.circle);

    const circleIdList:DB_USER[] = []; //await queryAll("SELECT * FROM user_table WHERE user_id = $1;", [circleId]);

    if(circleIdList.length !== 1)
      next(new Exception(400, `FAILED AUTHENTICATED :: CIRCLE :: Circle: ${circleId} - DOES NOT EXIST`));

    else  {            
        request.circleId = circleId;
        request.circleProfile = circleIdList[0];
        return true;
    } 
    return false;
}

// #3 - Verify Circle Status
export const authenticateCircle = async(request: CircleRequest, response: Response, next: NextFunction):Promise<Boolean> => {

    if(await circleAuthentication(request, response, next)
        && ((RoleEnum[request.userProfile.user_role as string] === RoleEnum.ADMIN)
            || (request.userProfile.circles && request.userProfile.circles.includes(request.circleId)))) {

        log.auth(`AUTHENTICATED :: CIRCLE :: status verified: User: ${request.userId} is a member of CIRCLE: ${request.circleId}`);
        next();
        return true;
    } else {
        next(new Exception(401, `FAILED AUTHENTICATED :: CIRCLE :: User: ${request.userId} denied access to circle: ${request.circleId}`));
    }
}


// #4 - Verify User Profile Access
export const authenticateProfile = async(request: ProfileRequest, response: Response, next: NextFunction):Promise<Boolean> => {
console.log('AUtthenticateProfile-called');
    //Verify Requestor Authorization
        if(await clientAuthentication(request, response, next)
            && await isRequestorAllowedProfile(request.clientProfile, request.userProfile)) {

            log.auth(`AUTHENTICATED :: USER :: profile status verified: User: ${request.userId} has access to Client: ${request.clientId}`);
            next();
            return true;
        } else {
            next(new Exception(401, `FAILED AUTHENTICATED :: USER :: User: ${request.userId} denied access to Client: ${request.clientId}`));
            return false;
        }
}


// #5 - Verify Leader Access
export const authenticateLeader = async(request: CircleRequest, response: Response, next: NextFunction):Promise<Boolean> => {

    if(await circleAuthentication(request, response, next)
    && ((RoleEnum[request.userProfile.user_role as string] === RoleEnum.ADMIN) 
        || (RoleEnum[request.userProfile.user_role as string] === RoleEnum.LEADER
            && request.userProfile.circles && request.userProfile.circles.includes(request.circleId)))) {

            log.auth(`AUTHENTICATED :: LEADER :: status verified: User: ${request.userId} is a LEADER of circle: ${request.circleId}`);
            next();
        return true;
    } else {
        next(new Exception(401, `FAILED AUTHENTICATED :: LEADER :: User: ${request.userId} denied access to circle: ${request.circleId}`));
    }
}


// #6 - Verify ADMIN Access
export const authenticateAdmin = async(request: CredentialRequest, response: Response, next: NextFunction):Promise<Boolean> => {

    if(RoleEnum[request.userProfile.user_role as string] === RoleEnum.ADMIN) {

        log.auth(`AUTHENTICATED :: ADMIN :: status verified: User: ${request.userId} is an ADMIN`);
        next();
        return true;
    } else {
        next(new Exception(401, `FAILED AUTHENTICATED :: ADMIN :: User: ${request.userId} is not an ADMIN.`));
    }
}
