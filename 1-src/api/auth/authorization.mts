import { Request, Response, NextFunction } from "express";
import {Exception} from "../api-types.mjs"
import * as log from '../../services/log.mjs';
import { IdentityCircleRequest, IdentityClientRequest, IdentityRequest, JWTClientRequest, JWTRequest } from "./auth-types.mjs";
import { queryAll } from "../../services/database/database.mjs";
import { DB_USER } from "../../services/database/database-types.mjs";
import { RoleEnum } from "../profile/profile-types.mjs";
import { isRequestorAllowedProfile, verifyJWT } from "./auth-utilities.mjs";

/* *******************
 Middleware Authentication
******************* */
/* NOTE: DO NOT CALL DIRECTLY : next(); is for middleware and only called once (but doesn't return/exit function)*/

//#0 Verify JWT is valid
export const jwtAuthenticationMiddleware = async(request: JWTRequest, response: Response, next: NextFunction):Promise<void> => {
    //Verify Credentials Exist
    if(!request.headers['jwt']) 
        next(new Exception(400, `FAILED AUTHENTICATED :: IDENTITY :: missing JWT in request header: ${request.headers['jwt']}`));

    //Verify JWT
    else if(!verifyJWT(request.headers['jwt'])) 
        next(new Exception(401, `FAILED AUTHENTICATED :: IDENTITY :: Invalid JWT for User: ${request.headers['jwt']}`));

    //Inject jwtUserId into request object
    else {
        request.jwt = request.headers['jwt'];
        request.jwtUserId = 0;
        request.jwtUserRole = RoleEnum.STUDENT;

        next();
    }
}

// #1 - Verify Identity
export const authenticateUserMiddleware = async(request: IdentityRequest, response: Response, next: NextFunction):Promise<void> => {

    //Verify Credentials Exist
    if(!request.headers["user-id"]) 
        next(new Exception(400, `FAILED AUTHENTICATED :: IDENTITY :: missing user-id in request header: ${request.headers['jwt']} :: ${request.headers["user-id"]}`));

    //Verify Client Exists
    else {
        const userId:number = request.headers['user-id'];

        const userProfileList:DB_USER[] = await queryAll("SELECT * FROM user_table WHERE user_id = $1;", [userId]);

        if(userProfileList.length !== 1) 
            next(new Exception(404, `FAILED AUTHENTICATED :: IDENTITY :: User: ${userId} - DOES NOT EXIST`));

        //JWT Credentials against Database //TODO Once JWT is implemented
        // else if(userProfileList[0].user_id !== request.jwtUserId || userProfileList[0].user_role !== request.jwtUserRole) 
        //     next(new Exception(401, `FAILED AUTHENTICATED :: IDENTITY :: Inaccurate JWT ${request.headers['jwt']} for User: ${userId}`));

        //Inject userProfile into request object
        else {
            request.userId = userId;
            request.userRole = RoleEnum[userProfileList[0].user_role as string],
            request.userProfile = userProfileList[0];

            next();
        }
    }
}

//HELPER UTILITY: Identify client ID in URL path and Inject client user profile into request object 
export const extractClientProfile = async(request: JWTClientRequest | IdentityClientRequest):Promise<Exception|false> => {
    //Verify Credentials Exist
    if(!request.params.client) 
        return new Exception(400, `FAILED AUTHENTICATED :: CLIENT :: missing client-id parameter :: ${request.params.client}`);

    //Verify Client Exists
    const clientId:number = parseInt(request.params.client);

    const clientProfileList:DB_USER[] = await queryAll("SELECT * FROM user_table WHERE user_id = $1;", [clientId]);

    if(clientProfileList.length !== 1) 
      return new Exception(404, `FAILED AUTHENTICATED :: CLIENT :: User: ${clientId} - DOES NOT EXIST`);

    //Inject Client ID & profile into request object
    request.clientId = clientId;
    request.clientProfile = clientProfileList[0];

    return false;
}

// #2 - Verify Partner Status
export const authenticatePartnerMiddleware = async(request: IdentityClientRequest, response: Response, next: NextFunction):Promise<void> => { //TODO: query patch to remove unmatched partner

    const clientException = await extractClientProfile(request);
    if(clientException) 
        next(clientException);

    else if(request.userProfile.partners && request.clientProfile.partners
            && request.userProfile.partners.includes(request.clientId) 
            && request.clientProfile.partners.includes(request.userId)) {

        log.auth(`AUTHENTICATED :: PARTNER :: status verified: Requestor: ${request.userId} is a partner of User: ${request.clientId}`);
        next();

    } else {
        next(new Exception(401, `FAILED AUTHENTICATED :: PARTNER :: Requestor: ${request.userId} is not a partner of User: ${request.clientId}`));
    }
}

//HELPER UTILITY: Identify circle ID in URL path and Inject circle profile into request object 
export const extractCircleProfile = async(request: IdentityCircleRequest):Promise<Exception|false> => {
    //Verify Credentials Exist
    if(!request.params.circle) 
        return new Exception(400, `FAILED AUTHENTICATED :: CIRCLE :: missing circle-id parameter :: ${request.params.circle}`);

    //Verify Client Exists
    const circleId:number = parseInt(request.params.circle);

    const circleIdList:DB_USER[] = []; //await queryAll("SELECT * FROM user_table WHERE user_id = $1;", [circleId]);

    if(circleIdList.length !== 1) 
      return new Exception(404, `FAILED AUTHENTICATED :: CIRCLE :: Circle: ${circleId} - DOES NOT EXIST`);

    //Inject circle ID and Profile Into request Object
    request.circleId = circleId;
    request.circleProfile = circleIdList[0];

    return false;
}

// #3 - Verify Circle Status
export const authenticateCircleMiddleware = async(request: IdentityCircleRequest, response: Response, next: NextFunction):Promise<void> => {

    const circleException = await extractCircleProfile(request);
    if(circleException) 
        next(circleException);

    else if((RoleEnum[request.userProfile.user_role as string] === RoleEnum.ADMIN)
            || (request.userProfile.circles && request.userProfile.circles.includes(request.circleId))) {

        log.auth(`AUTHENTICATED :: CIRCLE :: status verified: User: ${request.userId} is a member of CIRCLE: ${request.circleId}`);
        next();

    } else {
        next(new Exception(401, `FAILED AUTHENTICATED :: CIRCLE :: User: ${request.userId} denied access to circle: ${request.circleId}`));
    }
}


// #4 - Verify User Profile Access
export const authenticateProfileMiddleware = async(request: IdentityClientRequest, response: Response, next: NextFunction):Promise<void> => {

    const clientException = await extractClientProfile(request);
    if(clientException) 
        next(clientException);

    //Verify Requestor Authorization
    else if(await isRequestorAllowedProfile(request.clientProfile, request.userProfile)) {

        log.auth(`AUTHENTICATED :: USER :: profile status verified: User: ${request.userId} has access to Client: ${request.clientId}`);
        next();

    } else {
        next(new Exception(401, `FAILED AUTHENTICATED :: USER :: User: ${request.userId} denied access to Client: ${request.clientId}`));
    }
}


// #5 - Verify Leader Access
export const authenticateLeaderMiddleware = async(request: IdentityCircleRequest, response: Response, next: NextFunction):Promise<void> => {

    const circleException = await extractCircleProfile(request);
    if(circleException) 
        next(circleException);

    else if((RoleEnum[request.userProfile.user_role as string] === RoleEnum.ADMIN) 
        || (RoleEnum[request.userProfile.user_role as string] === RoleEnum.LEADER
            && request.userProfile.circles && request.userProfile.circles.includes(request.circleId))) {

        log.auth(`AUTHENTICATED :: LEADER :: status verified: User: ${request.userId} is a LEADER of circle: ${request.circleId}`);
        next();

    } else {
        next(new Exception(401, `FAILED AUTHENTICATED :: LEADER :: User: ${request.userId} denied access to circle: ${request.circleId}`));
    }
}


// #6 - Verify ADMIN Access
export const authenticateAdminMiddleware = async(request: IdentityRequest, response: Response, next: NextFunction):Promise<void> => {

    if(RoleEnum[request.userProfile.user_role as string] === RoleEnum.ADMIN) {

        log.auth(`AUTHENTICATED :: ADMIN :: status verified: User: ${request.userId} is an ADMIN`);
        next();

    } else {
        next(new Exception(401, `FAILED AUTHENTICATED :: ADMIN :: User: ${request.userId} is not an ADMIN.`));
    }
}
