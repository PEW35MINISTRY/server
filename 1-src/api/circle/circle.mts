import { Response, NextFunction } from 'express';
import * as log from '../../services/log.mjs';
import {Exception} from '../api-types.mjs'
import { IdentityCircleRequest, IdentityRequest } from '../auth/auth-types.mjs';
import { extractCircleProfile } from '../auth/authorization.mjs';
import { DB_DELETE_CIRCLE, DB_DELETE_CIRCLE_ANNOUNCEMENT, DB_DELETE_CIRCLE_USER_STATUS, DB_INSERT_CIRCLE, DB_INSERT_CIRCLE_ANNOUNCEMENT, DB_INSERT_CIRCLE_USER_STATUS, DB_SELECT_ALL_CIRCLES, DB_SELECT_CIRCLE_ANNOUNCEMENT_CURRENT, DB_SELECT_CIRCLE_DETAIL, DB_SELECT_CIRCLE_DETAIL_BY_NAME, DB_SELECT_CIRCLE_USER_LIST, DB_SELECT_USER_CIRCLES, DB_UPDATE_CIRCLE, DB_UPDATE_CIRCLE_USER_STATUS } from '../../services/database/queries/circle-queries.mjs';
import CIRCLE from '../../services/models/circleModel.mjs';
import { RoleEnum } from '../../services/models/Fields-Sync/profile-field-config.mjs';
import { CIRCLE_ANNOUNCEMENT_TABLE_COLUMNS, CIRCLE_ANNOUNCEMENT_TABLE_COLUMNS_REQUIRED, CIRCLE_TABLE_COLUMNS, CIRCLE_TABLE_COLUMNS_REQUIRED, DATABASE_CIRCLE_STATUS_ENUM } from '../../services/database/database-types.mjs';
import createModelFromJSON from '../../services/models/createModelFromJson.mjs';
import { DB_IS_USER_ROLE } from '../../services/database/queries/user-queries.mjs';
import { CIRCLE_ANNOUNCEMENT_FIELDS, CIRCLE_FIELDS, CIRCLE_FIELDS_ADMIN, CircleStatus, InputField } from '../../services/models/Fields-Sync/circle-field-config.mjs';
import { CircleAnnouncementCreateRequest } from './circle-types.mjs';
import CIRCLE_ANNOUNCEMENT from '../../services/models/circleAnnouncementModel.mjs';
import getCircleEventSampleList from './circle-event-samples.mjs';
import PrayerRequestSampleList from '../prayer-request/prayer-request-sample.mjs';

/******************
 *  CIRCLE ROUTES
 ******************/
export const GET_publicCircle =  async(request: IdentityCircleRequest, response: Response, next: NextFunction) => {
    const clientException = await extractCircleProfile(request);

    if(clientException) 
        next(clientException);        
    else {
        request.circleProfile.eventList = getCircleEventSampleList(request.circleID); //TODO Define Circle Event and Prayer Request once Implemented
        response.status(200).send(request.circleProfile.toJSON());        
        log.event("Returning public circle for circleID: ", request.circleID);
    }
};

export const GET_circle =  async(request: IdentityCircleRequest, response: Response, next: NextFunction) => {
    const circle:CIRCLE = request.circleProfile;
    circle.announcementList = await DB_SELECT_CIRCLE_ANNOUNCEMENT_CURRENT(request.circleID);
    circle.eventList = getCircleEventSampleList(request.circleID); //TODO Define Circle Event and Prayer Request once Implemented
    circle.prayerRequestList = PrayerRequestSampleList;
    circle.memberList = await DB_SELECT_CIRCLE_USER_LIST(circle.circleID, DATABASE_CIRCLE_STATUS_ENUM.MEMBER);
    if(request.userProfile.isRole(RoleEnum.CIRCLE_LEADER) || request.userProfile.isRole(RoleEnum.ADMIN)) {
        circle.pendingInviteList = await DB_SELECT_CIRCLE_USER_LIST(circle.circleID, DATABASE_CIRCLE_STATUS_ENUM.INVITE);
        circle.pendingRequestList = await DB_SELECT_CIRCLE_USER_LIST(circle.circleID, DATABASE_CIRCLE_STATUS_ENUM.REQUEST);
    }
    response.status(200).send(circle.toJSON());        
    log.event("Returning circle for circleID: ", request.circleID);
};

//List of all circles user is member, invited, requested (not sorted)
export const GET_userCircleList = async(request: IdentityRequest, response: Response, next: NextFunction) => {
    response.status(200).send(await DB_SELECT_USER_CIRCLES(request.userID));
};

//TODO Filter & Sort appropriately
export const GET_CircleList = async(request: IdentityRequest, response: Response, next: NextFunction) => {
    const search:string = request.params.search || ''; //Optional search parameter

    response.status(200).send(await DB_SELECT_ALL_CIRCLES());
};

export const POST_newCircle =  async(request: IdentityRequest, response: Response, next: NextFunction) => {
    const FIELD_LIST:InputField[] = request.userProfile.isRole(RoleEnum.ADMIN) ? CIRCLE_FIELDS_ADMIN : CIRCLE_FIELDS;

    const newCircle:CIRCLE|undefined = createModelFromJSON({currentModel: new CIRCLE(), jsonObj:request.body, fieldList: FIELD_LIST, next:next}) as CIRCLE;

    if(newCircle !== undefined) { //undefined handles next(Exception)
        const leaderID:number = (request.userProfile.isRole(RoleEnum.ADMIN) && request.body['leaderID'] !== undefined) ? request.body['leaderID'] : request.userID;
        newCircle.leaderID = leaderID;

        if(CIRCLE_TABLE_COLUMNS_REQUIRED.every((column) => newCircle[column] !== undefined) === false) 
            next(new Exception(400, `Create Circle Failed :: Missing Required Fields: ${JSON.stringify(CIRCLE_TABLE_COLUMNS_REQUIRED)}.`, 'Missing Details'));

        //Verify leaderID in body is leader role; could be ADMIN in header already verified
        else if(await DB_IS_USER_ROLE({userID: newCircle.leaderID, userRole: RoleEnum.CIRCLE_LEADER}) === false)
            next(new Exception(401, `Edit Circle Failed :: failed to verify leader status of userID: ${newCircle.leaderID}`, 'Leader status not verified.'));

        else if(await DB_INSERT_CIRCLE(newCircle.getValidProperties(CIRCLE_TABLE_COLUMNS, false)) === false) 
                next(new Exception(500, 'Create Circle  Failed :: Failed to save new user account.', 'Save Failed'));

        else {
            const circle:CIRCLE|undefined = await DB_SELECT_CIRCLE_DETAIL_BY_NAME(newCircle.name);

            if(circle !== undefined)
                response.status(201).send(circle.toJSON());
            else
                next(new Exception(404, 'Create Circle  Failed: Circle successfully created; but failed to retrieve circle.', 'Circle Saved'));
        }
    }
};

export const PATCH_circle =  async(request: IdentityCircleRequest, response: Response, next: NextFunction) => {
    if((request.userProfile.isRole(RoleEnum.CIRCLE_LEADER) && request.userID === request.circleProfile.leaderID) || request.userProfile.isRole(RoleEnum.ADMIN)){
        const FIELD_LIST:InputField[] = request.userProfile.isRole(RoleEnum.ADMIN) ? CIRCLE_FIELDS_ADMIN : CIRCLE_FIELDS;

        const editCircle:CIRCLE|undefined = createModelFromJSON({currentModel: request.circleProfile, jsonObj:request.body, fieldList: FIELD_LIST, next:next}) as CIRCLE;

        if(editCircle !== undefined) {  //undefined handles next(Exception)
            //Verify leaderID is leader role
            if(editCircle.leaderID !== request.circleProfile.leaderID 
                    && await DB_IS_USER_ROLE({userID: editCircle.leaderID, userRole: RoleEnum.CIRCLE_LEADER}) === false)
                next(new Exception(401, `Edit Circle Failed :: failed to verify leader status of userID: ${editCircle.leaderID}`, 'Leader status not verified.'));

            else if((editCircle.getUniqueDatabaseProperties(request.circleProfile).size > 0 )
                    && await DB_UPDATE_CIRCLE(request.circleID, editCircle.getUniqueDatabaseProperties(request.circleProfile))) 
                next(new Exception(500, `Edit Circle Failed :: Failed to update user ${request.circleID} account.`, 'Save Failed'));

            else {
                response.status(202).send(editCircle.toJSON());
            }
        }
    } else 
        next(new Exception(401, `User ${request.userID} is UNAUTHORIZED to edit the Circle: ${request.circleID}`));
};

export const DELETE_circle =  async(request: IdentityCircleRequest, response: Response, next: NextFunction) => {

    if(await DB_DELETE_CIRCLE_ANNOUNCEMENT({announcementID: undefined, circleID: request.circleID}) === false)
        next(new Exception(500, `Failed to delete all announcements for circle ${request.circleID}`, 'Deleting Announcements Failed'));

    if(await DB_DELETE_CIRCLE_USER_STATUS({userID: undefined, circleID: request.circleID}) === false)
        next(new Exception(500, `Failed to delete all user members for circle ${request.circleID}`, 'Removing members failed'));

    else if(await DB_DELETE_CIRCLE(request.circleID))
        response.status(204).send(`User ${request.circleID} deleted successfully`);
    else
        next(new Exception(404, `Circle Delete Failed :: Failed to delete circle ${request.circleID}.`, 'Delete Failed'));
};

/***********************
 *  CIRCLE ANNOUNCEMENT
 ***********************/

export const POST_circleAnnouncement =  async(request: CircleAnnouncementCreateRequest, response: Response, next: NextFunction) => {
    
    const newCircleAnnouncement:CIRCLE_ANNOUNCEMENT|undefined = createModelFromJSON({currentModel: new CIRCLE_ANNOUNCEMENT(), jsonObj:request.body, fieldList: CIRCLE_ANNOUNCEMENT_FIELDS, next:next}) as CIRCLE_ANNOUNCEMENT;

    if(newCircleAnnouncement !== undefined) {  //undefined handles next(Exception)
        newCircleAnnouncement.circleID = request.circleID;

        if(CIRCLE_ANNOUNCEMENT_TABLE_COLUMNS_REQUIRED.every((column) => newCircleAnnouncement[column] !== undefined) === false) 
            next(new Exception(400, `Create Circle Announcement Failed :: Missing Required Fields: ${JSON.stringify(CIRCLE_ANNOUNCEMENT_TABLE_COLUMNS_REQUIRED)}.`, 'Missing Details'));

        else if(await DB_INSERT_CIRCLE_ANNOUNCEMENT(newCircleAnnouncement.getUniqueDatabaseProperties()) === false) 
                next(new Exception(500, 'Create Circle Announcement Failed :: Failed to save new user account.', 'Save Failed'));

        else
            response.status(202).send(newCircleAnnouncement.toJSON());
    }
};

export const DELETE_circleAnnouncement =  async(request: IdentityCircleRequest, response: Response, next: NextFunction) => {
    //Verify Announcement Parameter Exist
    if(request.params.announcement === undefined || isNaN(parseInt(request.params.announcement))) 
        next(new Exception(400, `Circle Announcement Delete Failed :: missing announcement-id parameter :: ${request.params.circle}`, 'Missing Announcement'));

    else if(await DB_DELETE_CIRCLE_ANNOUNCEMENT({announcementID: parseInt(request.params.announcement), circleID: request.circleID}) === false)
        next(new Exception(404, `Circle Announcement Delete Failed :: Failed to delete announcement ${request.params.announcement} for circle ${request.params.circle}.`, 'Delete Failed'));
    else
        response.status(204).send(`Announcement ${request.params.announcement} successfully removed from circle ${request.params.circle}`);
};

/***************************************
 *  CIRCLE MEMBERSHIP | STUDENT ROUTES
 ***************************************/

//Circle Membership Invite Must Exist (Student Accepts)
export const POST_circleMemberAccept =  async(request: IdentityRequest, response: Response, next: NextFunction) => {

    //Verify Circle Parameter Exist
    if(request.params.circle === undefined || isNaN(parseInt(request.params.circle))) 
        next(new Exception(400, `Circle Membership Accept Invite :: missing circle-id parameter :: ${request.params.circle}`, 'Missing Circle'));

    else if(await DB_UPDATE_CIRCLE_USER_STATUS({userID: request.userID, circleID: parseInt(request.params.circle), currentStatus: DATABASE_CIRCLE_STATUS_ENUM.INVITE, status: DATABASE_CIRCLE_STATUS_ENUM.MEMBER}) === false)
        next(new Exception(404, `Circle Membership Accept Invite :: Failed to accept membership for user ${request.userID} to circle ${request.params.circle}.`, 'Acceptance Failed'));

    else {
        const circle:CIRCLE = await DB_SELECT_CIRCLE_DETAIL({userID: request.userID, circleID: parseInt(request.params.circle)});
        response.status(202).send(circle.toJSON());
    }
};

export const POST_circleMemberRequest =  async(request: IdentityRequest, response: Response, next: NextFunction) => {

    //Verify Circle Parameter Exist
    if(request.params.circle === undefined || isNaN(parseInt(request.params.circle))) 
        next(new Exception(400, `Circle Membership Join Admin Failed :: missing circle-id parameter :: ${request.params.circle}`, 'Missing Circle'));

    else {
        const circle:CIRCLE = await DB_SELECT_CIRCLE_DETAIL({userID: request.userID, circleID: parseInt(request.params.circle)});

        //Verify circle.inviteToken for automatic membership
        const status:DATABASE_CIRCLE_STATUS_ENUM = (request.body['inviteToken'] !== undefined && circle.inviteToken !== undefined && circle.inviteToken.length > 0 && request.body['inviteToken'] === circle.inviteToken) 
        ? DATABASE_CIRCLE_STATUS_ENUM.MEMBER
        : DATABASE_CIRCLE_STATUS_ENUM.REQUEST;

        circle.requestorID = request.userID;
        circle.requestorStatus = CircleStatus[status];

        if(await DB_INSERT_CIRCLE_USER_STATUS({userID: request.userID, circleID: parseInt(request.params.circle), status: status}) === false)
            next(new Exception(404, `Circle Membership Request Failed :: Failed to create membership request status for user ${request.userID} to circle ${request.params.circle}.`, 'Request Failed'));

        else if(status === DATABASE_CIRCLE_STATUS_ENUM.MEMBER)
            response.status(201).send(circle.toJSON());

        else 
            response.status(202).send(circle.toJSON());
    }
};

export const DELETE_circleMember =  async(request: IdentityRequest, response: Response, next: NextFunction) => {
    //Verify Circle Parameter Exist
    if(request.params.circle === undefined || isNaN(parseInt(request.params.circle))) 
        next(new Exception(400, `Circle Membership Join Admin Failed :: missing circle-id parameter :: ${request.params.circle}`, 'Missing Circle'));

    else if(await DB_DELETE_CIRCLE_USER_STATUS({userID: request.userID, circleID: parseInt(request.params.circle)}) === false)
        next(new Exception(404, `Circle Membership Delete Failed :: Failed to delete membership for user ${request.userID} to circle ${request.params.circle}.`, 'Delete Failed'));
    else
        response.status(204).send(`User ${request.userID} successfully removed from circle ${request.params.circle}`);
};

/*************************************
 *  CIRCLE MEMBERSHIP | LEADER ROUTES
 *************************************/
export const POST_circleLeaderMemberInvite =  async(request: IdentityCircleRequest, response: Response, next: NextFunction) => {
    //Verify Client Parameter Exist
    if(request.params.client === undefined || isNaN(parseInt(request.params.client))) 
        next(new Exception(400, `Circle Membership Leader Invite Failed :: missing client-id parameter :: ${request.params.client}`, 'Missing Client'));

    else if(await DB_INSERT_CIRCLE_USER_STATUS({userID: parseInt(request.params.client), circleID: request.circleID, status: DATABASE_CIRCLE_STATUS_ENUM.INVITE}) === false)
        next(new Exception(404, `Circle Membership Leader Invite Failed :: Failed to invite user ${request.params.client} to circle ${request.circleID}.`, 'Invite Failed'));
    else
        response.status(202).send(`User ${request.params.client} successfully invited to circle ${request.circleID}`);
};

//Circle Membership Request Must Exist (Leader Accepts)
export const POST_circleLeaderAccept =  async(request: IdentityCircleRequest, response: Response, next: NextFunction) => {
    //Verify Client Parameter Exist
    if(request.params.client === undefined || isNaN(parseInt(request.params.client))) 
        next(new Exception(400, `Circle Membership Leader Accept :: missing client-id parameter :: ${request.params.client}`, 'Missing Client'));

    else if(await DB_UPDATE_CIRCLE_USER_STATUS({userID: parseInt(request.params.client), circleID: request.circleID, status: DATABASE_CIRCLE_STATUS_ENUM.MEMBER}) === false)
        next(new Exception(404, `Circle Membership Leader Accept :: Failed to accept membership for user ${request.params.client} to circle ${request.circleID}.`, 'Accept Failed'));
    else
        response.status(202).send(`User ${request.params.client} successfully joined circle ${request.circleID}`);
};

//Admin overrides invite/request process
export const POST_circleMemberJoinAdmin =  async(request: IdentityRequest, response: Response, next: NextFunction) => {
    //Verify Circle Parameter Exist
    if(request.params.circle === undefined || isNaN(parseInt(request.params.circle))) 
        next(new Exception(400, `Circle Membership Join Admin Failed :: missing circle-id parameter :: ${request.params.circle}`, 'Missing Circle'));
    
    //Verify Client Parameter Exist
    else if(request.params.client === undefined || isNaN(parseInt(request.params.client))) 
        next(new Exception(400, `Circle Membership Join Admin Failed :: missing client-id parameter :: ${request.params.client}`, 'Missing Client'));

    else {
        //First attempt to remove existing invite/request status
        await DB_DELETE_CIRCLE_USER_STATUS({userID: parseInt(request.params.client), circleID: parseInt(request.params.circle)});
    
        if(await DB_INSERT_CIRCLE_USER_STATUS({userID: parseInt(request.params.client), circleID: parseInt(request.params.circle), status: DATABASE_CIRCLE_STATUS_ENUM.MEMBER}) === false)
            next(new Exception(404, `Circle Membership Accept Failed :: Failed to accept membership for user ${request.params.client} to circle ${request.params.circle}.`, 'Join Failed'));
        else {
            response.status(202).send(`User ${request.params.client} successfully joined circle ${request.params.circle}`);
            log.event(`Admin assigning user ${request.params.client} to circle ${request.params.circle}`);
        }
    }
};

export const DELETE_circleLeaderMember =  async(request: IdentityCircleRequest, response: Response, next: NextFunction) => {
    //Verify Client Parameter Exist
    if(request.params.client === undefined || isNaN(parseInt(request.params.client))) 
        next(new Exception(400, `Circle Membership Leader Delete Failed :: missing client-id parameter :: ${request.params.client}`, 'Missing Client'));

    else if(await DB_DELETE_CIRCLE_USER_STATUS({userID: parseInt(request.params.client), circleID: request.circleID}) === false)
        next(new Exception(404, `Circle Membership Leader Delete Failed :: Failed to delete membership for user ${request.params.client} to circle ${request.circleID}.`, 'Delete Failed'));
    else
        response.status(204).send(`User ${request.params.client} successfully removed from circle ${request.circleID}`);
};
