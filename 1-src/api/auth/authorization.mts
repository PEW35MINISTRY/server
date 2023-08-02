import { Request, Response, NextFunction } from "express";
import {Exception} from "../api-types.mjs"
import * as log from '../../services/log.mjs';
import { IdentityCircleRequest, IdentityClientRequest, IdentityRequest, JWTClientRequest, JwtData, JwtRequest } from "./auth-types.mjs";
import { isRequestorAllowedProfile, verifyJWT as verifyJwt, getJWTData as getJwtData } from "./auth-utilities.mjs";
import { RoleEnum } from "../../services/models/Fields-Sync/profile-field-config.mjs";
import { DB_SELECT_USER_PROFILE } from "../../services/database/queries/user-queries.mjs";
import USER from "../../services/models/userModel.mjs";
import CIRCLE from "../../services/models/circleModel.mjs";
import { DB_IS_CIRCLE_USER_OR_LEADER, DB_SELECT_CIRCLE, DB_SELECT_CIRCLE_DETAIL } from "../../services/database/queries/circle-queries.mjs";
import { DATABASE_CIRCLE_STATUS_ENUM } from "../../services/database/database-types.mjs";

/* *******************
 Middleware Authentication
******************* */
/* NOTE: DO NOT CALL DIRECTLY : next(); is for middleware and only called once (but doesn't return/exit function)*/

//#0 Verify JWT is valid
export const jwtAuthenticationMiddleware = async(request: JwtRequest, response: Response, next: NextFunction):Promise<void> => {
    //Verify Credentials Exist
    if(!request.headers['jwt']) 
        next(new Exception(400, `FAILED AUTHENTICATED :: IDENTITY :: missing JWT in request header: ${request.headers['jwt']}`));

    //Verify JWT
    else if(!verifyJwt(request.headers['jwt'])) 
        next(new Exception(401, `FAILED AUTHENTICATED :: IDENTITY :: Invalid JWT for User: ${request.headers['jwt']}`));

    //Inject jwtUserID into request object
    else {
        const client_token = request.headers['jwt'];
        const token_data = getJwtData(client_token);

        if(!token_data || token_data['jwtUserID'] === undefined || token_data['jwtUserID'] <= 0 || token_data['jwtUserRole'] === undefined) {
            log.auth(`Failed to parse JWT for user: ${request.headers['user-id']}`, `UserID from token: ${token_data['jwtUserID']}`, 
                        `User Role from token: ${token_data['jwtUserRole']}`, 'JWT: ', client_token);
            next(new Exception(401, `FAILED AUTHENTICATED :: IDENTITY :: Failed to parse JWT: ${request.headers['jwt']}`));

        } else {
            request.jwt = client_token
            request.jwtUserID = token_data['jwtUserID'];
            request.jwtUserRole = token_data['jwtUserRole'];

            next();
        }
    }
}

// #1 - Verify Identity  and cache user Profile
export const authenticateUserMiddleware = async(request: IdentityRequest, response: Response, next: NextFunction):Promise<void> => {

    //Verify Credentials Exist
    if(!request.headers["user-id"]) 
        next(new Exception(400, `FAILED AUTHENTICATED :: IDENTITY :: missing user-id in request header: ${request.headers['jwt']} :: ${request.headers["user-id"]}`));

    //Verify Client Exists
    else {
        const client_token = request.headers['jwt'];
        const token_data:JwtData = getJwtData(client_token);
        const userID:number = request.headers['user-id'];

        const userProfile:USER = await DB_SELECT_USER_PROFILE(new Map([['userID', userID]]));      

        if(userProfile.userID < 0) 
            next(new Exception(404, `FAILED AUTHENTICATED :: IDENTITY :: User: ${userID} - DOES NOT EXIST`));

        //JWT Credentials against Database 
        if(userProfile.userID !== token_data.jwtUserID || !userProfile.isRole(token_data.jwtUserRole)) 
            next(new Exception(401, `FAILED AUTHENTICATED :: IDENTITY :: Inaccurate JWT ${request.headers['jwt']} for User: ${userID}`));

        //Inject userProfile into request object
        else {
            request.userID = parseInt(userID as unknown as string);
            request.userRole = userProfile.getHighestRole(),
            request.userProfile = userProfile;

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
    const clientID:number = parseInt(request.params.client);

    const clientProfile:USER = await DB_SELECT_USER_PROFILE(new Map([['userID', clientID]]));

    if(clientProfile.userID < 0) 
      return new Exception(404, `FAILED AUTHENTICATED :: CLIENT :: User: ${clientID} - DOES NOT EXIST`);

    //Inject Client ID & profile into request object
    request.clientID = parseInt(clientID as unknown as string);
    request.clientProfile = clientProfile;

    return false;
}

// #2 - Verify Partner Status and cache client Profile
export const authenticatePartnerMiddleware = async(request: IdentityClientRequest, response: Response, next: NextFunction):Promise<void> => { //TODO: query patch to remove unmatched partner

    const clientException = await extractClientProfile(request);
    if(clientException) 
        next(clientException);

    else if(request.userProfile.getPartnerIDList().includes(request.clientID) 
            && request.clientProfile.getPartnerIDList().includes(request.userID)) {

        log.auth(`AUTHENTICATED :: PARTNER :: status verified: Requestor: ${request.userID} is a partner of User: ${request.clientID}`);
        next();

    } else {
        next(new Exception(401, `FAILED AUTHENTICATED :: PARTNER :: Requestor: ${request.userID} is not a partner of User: ${request.clientID}`));
    }
}

//HELPER UTILITY: Identify circle ID in URL path and Inject circle profile into request object 
export const extractCircleProfile = async(request: IdentityCircleRequest):Promise<Exception|false> => {
    //Verify Circle Parameter Exist
    if(request.params.circle === undefined || isNaN(parseInt(request.params.circle))) 
        return new Exception(400, `FAILED AUTHENTICATED :: CIRCLE :: missing circle-id parameter :: ${request.params.circle}`, 'Missing Circle');

    const circleID:number = parseInt(request.params.circle);

    const circleProfile:CIRCLE = await DB_SELECT_CIRCLE_DETAIL({userID: request.userProfile.isRole(RoleEnum.ADMIN) ? -1 : request.userID, circleID});

    if(circleProfile.circleID < 0) 
      return new Exception(404, `FAILED AUTHENTICATED :: CIRCLE :: Circle: ${circleID} - DOES NOT EXIST`);

    //Inject circle ID and Profile Into request Object
    request.circleID = circleID;
    request.circleProfile = circleProfile;

    return false;
}

// #3 - Verify Circle Status and cache circle
export const authenticateCircleMiddleware = async(request: IdentityCircleRequest, response: Response, next: NextFunction):Promise<void> => {

    const circleException = await extractCircleProfile(request);
    if(circleException) 
        next(circleException);

    else if((request.userProfile.isRole(RoleEnum.ADMIN))
            || await DB_IS_CIRCLE_USER_OR_LEADER({userID: request.userID, circleID: request.circleID, status: DATABASE_CIRCLE_STATUS_ENUM.MEMBER})) {

        log.auth(`AUTHENTICATED :: CIRCLE :: status verified: User: ${request.userID} is a member of CIRCLE: ${request.circleID}`);
        next();

    } else {
        next(new Exception(401, `FAILED AUTHENTICATED :: CIRCLE :: User: ${request.userID} denied access to circle: ${request.circleID}`));
    }
}


// #4 - Verify User Profile Access and cache client Profile
export const authenticateProfileMiddleware = async(request: IdentityClientRequest, response: Response, next: NextFunction):Promise<void> => {

    const clientException = await extractClientProfile(request);
    if(clientException) 
        next(clientException);

    //Verify Requestor Authorization
    else if(await isRequestorAllowedProfile(request.clientProfile, request.userProfile)) {

        log.auth(`AUTHENTICATED :: USER :: profile status verified: User: ${request.userID} has access to Client: ${request.clientID}`);
        next();

    } else {
        next(new Exception(401, `FAILED AUTHENTICATED :: USER :: User: ${request.userID} denied access to Client: ${request.clientID}`));
    }
}


// #5 - Verify CIRCLE_LEADER Access
export const authenticateLeaderMiddleware = async(request: IdentityRequest, response: Response, next: NextFunction):Promise<void> => {

    if(request.userProfile.isRole(RoleEnum.CIRCLE_LEADER) || request.userProfile.isRole(RoleEnum.ADMIN)) {
        log.auth(`AUTHENTICATED :: LEADER :: status verified: User: ${request.userID} is a Circle Leader`);
        next();

    } else {
        next(new Exception(401, `FAILED AUTHENTICATED :: LEADER :: User: ${request.userID} is not a Circle Leader.`));
    }
}

// #6 - Verify CIRCLE_LEADER Access and cache circle
export const authenticateCircleLeaderMiddleware = async(request: IdentityCircleRequest, response: Response, next: NextFunction):Promise<void> => {

    const circleException = await extractCircleProfile(request);

    if(circleException) 
        next(circleException);

    else if(request.userProfile.isRole(RoleEnum.ADMIN)
            || (request.userProfile.isRole(RoleEnum.CIRCLE_LEADER)
                && `${request.userID}` === `${request.circleProfile.leaderID}`)) {

        log.auth(`AUTHENTICATED :: CIRCLE LEADER :: status verified: User: ${request.userID} is a Circle Leader of CIRCLE: ${request.circleID}`);
        next();

    } else {
        next(new Exception(401, `FAILED AUTHENTICATED :: CIRCLE LEADER :: User: ${request.userID} denied access to circle: ${request.circleID}`));
    }
}

// #7 - Verify ADMIN Access
export const authenticateAdminMiddleware = async(request: IdentityRequest, response: Response, next: NextFunction):Promise<void> => {

    if(request.userProfile.isRole(RoleEnum.ADMIN)) {
        log.auth(`AUTHENTICATED :: ADMIN :: status verified: User: ${request.userID} is an ADMIN`);
        next();

    } else {
        next(new Exception(401, `FAILED AUTHENTICATED :: ADMIN :: User: ${request.userID} is not an ADMIN.`));
    }
}
