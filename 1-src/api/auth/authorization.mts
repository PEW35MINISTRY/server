import { Request, Response, NextFunction } from "express";
import {Exception} from "../api-types.mjs"
import * as log from '../../services/log.mjs';
import { JwtCircleRequest, JwtPrayerRequest, JwtClientRequest, JwtRequest, JwtAdminRequest, JwtCircleClientRequest } from "./auth-types.mjs";
import { verifyJWT as verifyJwt, getJWTData as getJwtData, isMaxRoleGreaterThan } from "./auth-utilities.mjs";
import { RoleEnum } from "../../services/models/Fields-Sync/profile-field-config.mjs";
import { DB_IS_ANY_USER_ROLE, DB_IS_USER_ROLE } from "../../services/database/queries/user-queries.mjs";
import { DB_IS_CIRCLE_LEADER, DB_IS_CIRCLE_USER_OR_LEADER, DB_IS_USER_MEMBER_OF_ANY_LEADER_CIRCLES, DB_SELECT_CIRCLE, DB_SELECT_CIRCLE_DETAIL } from "../../services/database/queries/circle-queries.mjs";
import { DATABASE_CIRCLE_STATUS_ENUM, DATABASE_USER_ROLE_ENUM } from "../../services/database/database-types.mjs";
import { DB_IS_USER_PARTNER } from "../../services/database/queries/partner-queries.mjs";


/* **************************
 Middleware Authentication
*****************************/
/* NOTE: DO NOT CALL DIRECTLY : next(); is for middleware and only called once (but doesn't return/exit function)*/

/* Verify JWT is valid */
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


/* Extract Client Parameter | cache: request.clientID */
export const extractClientMiddleware = async(request: JwtClientRequest, response: Response, next: NextFunction):Promise<void> => {
    //Verify Client Parameter Exist
    if(request.params.client === undefined || isNaN(parseInt(request.params.client))) 
        next(new Exception(400, `FAILED AUTHENTICATED :: CLIENT :: missing client-id parameter :: ${request.params.client}`, 'Missing Client'));

    else {
        const clientID:number = parseInt(request.params.client);
        request.clientID = clientID;
        next();
    }
}

/* Authenticate Partner Status | extractClientMiddleware cached: request.clientID */
//Note: ADMIN allowed access for testing; but leader or same user not allowed; must use authenticateProfileMiddleware routes
export const authenticatePartnerMiddleware = async(request: JwtClientRequest, response: Response, next: NextFunction):Promise<void> => { //TODO: query patch to remove unmatched partner

    if(request.jwtUserID === request.clientID) 
        next(new Exception(403, `FAILED AUTHENTICATED :: PARTNER :: userID cannot match clientID :: ${request.clientID}`, 'Cannot be partner with self'));

    else if((request.jwtUserRole === RoleEnum.ADMIN && await DB_IS_USER_ROLE({userID: request.jwtUserID, userRole: DATABASE_USER_ROLE_ENUM.ADMIN}))
            || await DB_IS_USER_PARTNER({userID: request.jwtUserID, clientID: request.clientID})) {

        request.clientID = request.clientID;
        log.auth(`AUTHENTICATED :: PARTNER :: status verified: Requestor: ${request.jwtUserID} is a partner of User: ${request.clientID}`);
        next();

    } else {
        next(new Exception(404, `FAILED AUTHENTICATED :: PARTNER :: Requestor: ${request.jwtUserID} is not a partner of User: ${request.clientID}`, 'Partnership Not Found'));
    }
}


/* Authenticate User access to Client profile | extractClientMiddleware cached: request.clientID */
export const authenticateClientAccessMiddleware = async(request: JwtClientRequest, response: Response, next: NextFunction):Promise<void> => {
    //Verify Requestor Authorization
    if((request.jwtUserID === request.clientID)
        || (request.jwtUserRole === RoleEnum.ADMIN && await DB_IS_USER_ROLE({userID: request.jwtUserID, userRole: DATABASE_USER_ROLE_ENUM.ADMIN}))
        || (await DB_IS_USER_MEMBER_OF_ANY_LEADER_CIRCLES({userID: request.clientID, leaderID: request.jwtUserID}))) {

            request.clientID = request.clientID;
            log.auth(`AUTHENTICATED :: PROFILE :: profile status verified: User: ${request.jwtUserID} has access to Client: ${request.clientID}`);
            next();

    } else {
        next(new Exception(401, `FAILED AUTHENTICATED :: PROFILE :: User: ${request.jwtUserID} denied access to Client: ${request.clientID}`));
    }
}


/* Extract Circle Parameter | cache: request.circleID */
export const extractCircleMiddleware = async(request: JwtCircleRequest, response: Response, next: NextFunction):Promise<void> => {
    //Verify Circle Parameter Exist
    if(request.params.circle === undefined || isNaN(parseInt(request.params.circle))) 
        next(new Exception(400, `FAILED AUTHENTICATED :: CIRCLE :: missing circle-id parameter :: ${request.params.circle}`, 'Missing Circle'));

    else {
        const circleID:number = parseInt(request.params.circle);
        request.circleID = circleID;
        next();
    }
}


/* Authenticate Circle Membership | extractCircleMiddleware cached: request.circleID */
export const authenticateCircleMembershipMiddleware = async(request: JwtCircleRequest, response: Response, next: NextFunction):Promise<void> => {

    if((request.jwtUserRole === RoleEnum.ADMIN && await DB_IS_USER_ROLE({userID: request.jwtUserID, userRole: DATABASE_USER_ROLE_ENUM.ADMIN}))
        || await DB_IS_CIRCLE_USER_OR_LEADER({userID: request.jwtUserID, circleID: request.circleID, status: DATABASE_CIRCLE_STATUS_ENUM.MEMBER})) {
            log.auth(`AUTHENTICATED :: CIRCLE MEMBER :: status verified: User: ${request.jwtUserID} is a member of circle: ${request.circleID}`);
            next();

    } else {
        next(new Exception(401, `FAILED AUTHENTICATED :: CIRCLE MEMBER :: User: ${request.jwtUserID} denied access to circle: ${request.circleID}`));
    }
}

/* Authenticate leader of specified circle and re-verify leader role (JWT could be stale) | extractCircleMiddleware cached: request.circleID */
export const authenticateCircleLeaderMiddleware = async(request: JwtCircleRequest, response: Response, next: NextFunction):Promise<void> => {

    if((request.jwtUserRole === RoleEnum.ADMIN 
            && await DB_IS_USER_ROLE({userID: request.jwtUserID, userRole: DATABASE_USER_ROLE_ENUM.ADMIN}))
        || (isMaxRoleGreaterThan({testUserRole: RoleEnum.CIRCLE_LEADER, currentMaxUserRole: request.jwtUserRole}) 
            && await DB_IS_CIRCLE_LEADER({leaderID: request.jwtUserID, circleID: request.circleID}))) {

        log.auth(`AUTHENTICATED :: CIRCLE LEADER :: status verified: User: ${request.jwtUserID} is a Circle Leader of circle: ${request.circleID}`);
        next();

    } else {
        next(new Exception(401, `FAILED AUTHENTICATED :: CIRCLE LEADER :: User: ${request.jwtUserID} denied access to circle: ${request.circleID}`));
    }
}

/* Authenticate current CIRCLE_LEADER role (Circle not specified) (JWT could be stale) */
export const authenticateLeaderMiddleware = async(request: JwtRequest, response: Response, next: NextFunction):Promise<void> => {

    if((isMaxRoleGreaterThan({testUserRole: RoleEnum.CIRCLE_LEADER, currentMaxUserRole: request.jwtUserRole}) 
            && await DB_IS_ANY_USER_ROLE({userID: request.jwtUserID, userRoleList: [DATABASE_USER_ROLE_ENUM.ADMIN, DATABASE_USER_ROLE_ENUM.CIRCLE_LEADER]}))) {

        log.auth(`AUTHENTICATED :: LEADER :: status verified: User: ${request.jwtUserID} is a Leader Role`);
        next();

    } else {
        next(new Exception(401, `FAILED AUTHENTICATED :: LEADER :: User: ${request.jwtUserID} is not a Leader Role.`));
    }
}

/* Authenticate current ADMIN role (JWT could be stale) */
export const authenticateAdminMiddleware = async(request: JwtRequest, response: Response, next: NextFunction):Promise<void> => {

    if(request.jwtUserRole === RoleEnum.ADMIN && await DB_IS_USER_ROLE({userID: request.jwtUserID, userRole: DATABASE_USER_ROLE_ENUM.ADMIN})) {
        log.auth(`AUTHENTICATED :: ADMIN :: status verified: User: ${request.jwtUserID} is an ADMIN`);
        next();

    } else {
        next(new Exception(401, `FAILED AUTHENTICATED :: ADMIN :: User: ${request.jwtUserID} is not an ADMIN.`));
    }
}
