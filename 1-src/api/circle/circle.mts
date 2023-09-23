import { Response, NextFunction } from 'express';
import * as log from '../../services/log.mjs';
import {Exception, ImageTypeEnum} from '../api-types.mjs'
import { JwtCircleClientRequest, JwtCircleRequest, JwtRequest } from '../auth/auth-types.mjs';
import { DB_DELETE_CIRCLE, DB_DELETE_CIRCLE_ANNOUNCEMENT, DB_DELETE_CIRCLE_USER_STATUS, DB_INSERT_CIRCLE, DB_INSERT_CIRCLE_ANNOUNCEMENT, DB_INSERT_CIRCLE_USER_STATUS, DB_SELECT_ALL_CIRCLES, DB_SELECT_CIRCLE, DB_SELECT_CIRCLE_ANNOUNCEMENT_CURRENT, DB_SELECT_CIRCLE_DETAIL, DB_SELECT_CIRCLE_DETAIL_BY_NAME, DB_SELECT_CIRCLE_USER_LIST, DB_SELECT_USER_CIRCLES, DB_UPDATE_CIRCLE, DB_UPDATE_CIRCLE_USER_STATUS } from '../../services/database/queries/circle-queries.mjs';
import CIRCLE from '../../services/models/circleModel.mjs';
import { RoleEnum } from '../../services/models/Fields-Sync/profile-field-config.mjs';
import { CIRCLE_ANNOUNCEMENT_TABLE_COLUMNS_REQUIRED, CIRCLE_TABLE_COLUMNS, CIRCLE_TABLE_COLUMNS_REQUIRED, DATABASE_CIRCLE_STATUS_ENUM, DATABASE_USER_ROLE_ENUM } from '../../services/database/database-types.mjs';
import createModelFromJSON from '../../services/models/createModelFromJson.mjs';
import { DB_IS_USER_ROLE } from '../../services/database/queries/user-queries.mjs';
import InputField from '../../services/models/Fields-Sync/inputField.mjs';
import { CIRCLE_ANNOUNCEMENT_FIELDS, CIRCLE_FIELDS, CIRCLE_FIELDS_ADMIN, CircleStatus } from '../../services/models/Fields-Sync/circle-field-config.mjs';
import { CircleAnnouncementCreateRequest, CircleImageRequest } from './circle-types.mjs';
import CIRCLE_ANNOUNCEMENT from '../../services/models/circleAnnouncementModel.mjs';
import getCircleEventSampleList from './circle-event-samples.mjs';
import { DB_DELETE_RECIPIENT_PRAYER_REQUEST, DB_SELECT_PRAYER_REQUEST_CIRCLE_LIST } from '../../services/database/queries/prayer-request-queries.mjs';
import { clearImage, clearImageCombinations, uploadImage } from '../api-utilities.mjs';

/******************
 *  CIRCLE ROUTES
 ******************/
export const GET_publicCircle =  async(request: JwtCircleRequest, response: Response, next: NextFunction) => {
    const circle:CIRCLE = await DB_SELECT_CIRCLE_DETAIL({circleID: request.circleID, userID: request.jwtUserID});

    if(circle.isValid) {
        circle.eventList = getCircleEventSampleList(request.circleID); //TODO Define Circle Event once Implemented
        response.status(200).send(circle.toPublicJSON());        
        log.event("Returning public circle for circleID: ", request.circleID);
    } else //Necessary; otherwise no response waits for timeout | Ignored if next() already replied
        next(new Exception(404, `GET_publicCircle - circle ${request.circleID} Failed to parse from database and is invalid`));
};

export const GET_circle =  async(request: JwtCircleRequest, response: Response, next: NextFunction) => {
    const circle:CIRCLE = await DB_SELECT_CIRCLE_DETAIL({circleID: request.circleID, userID: request.jwtUserID});
    circle.announcementList = await DB_SELECT_CIRCLE_ANNOUNCEMENT_CURRENT(request.circleID);
    circle.eventList = getCircleEventSampleList(request.circleID); //TODO Define Circle Event once Implemented
    circle.prayerRequestList = await DB_SELECT_PRAYER_REQUEST_CIRCLE_LIST( circle.circleID);
    circle.memberList = await DB_SELECT_CIRCLE_USER_LIST(circle.circleID, DATABASE_CIRCLE_STATUS_ENUM.MEMBER);

    if(request.jwtUserID === circle.leaderID || request.jwtUserRole === RoleEnum.ADMIN) {
        circle.pendingInviteList = await DB_SELECT_CIRCLE_USER_LIST(circle.circleID, DATABASE_CIRCLE_STATUS_ENUM.INVITE);
        circle.pendingRequestList = await DB_SELECT_CIRCLE_USER_LIST(circle.circleID, DATABASE_CIRCLE_STATUS_ENUM.REQUEST);
    }
    if(request.jwtUserRole === RoleEnum.ADMIN)
        response.status(200).send(circle.toJSON()); 
    else if(request.jwtUserID === circle.leaderID)
        response.status(200).send(circle.toLeaderJSON()); 
    else
        response.status(200).send(circle.toMemberJSON());        
    log.event("Returning circle for circleID: ", request.circleID);
};

//List of all circles user is member, invited, requested (not sorted)
export const GET_userCircleList = async(request: JwtRequest, response: Response, next: NextFunction) => {
    response.status(200).send(await DB_SELECT_USER_CIRCLES(request.jwtUserID));
};

//TODO Filter & Sort appropriately
export const GET_CircleList = async(request: JwtCircleRequest, response: Response, next: NextFunction) => {
    const search:string = request.params.search || ''; //Optional search parameter

    response.status(200).send(await DB_SELECT_ALL_CIRCLES());
};

export const POST_newCircle =  async(request: JwtRequest, response: Response, next: NextFunction) => {
    const FIELD_LIST:InputField[] = (request.jwtUserRole === RoleEnum.ADMIN) ? CIRCLE_FIELDS_ADMIN : CIRCLE_FIELDS;

    const newCircle:CIRCLE|undefined = createModelFromJSON({currentModel: new CIRCLE(), jsonObj:request.body, fieldList: FIELD_LIST, next:next}) as CIRCLE;

    if(newCircle !== undefined) { //undefined handles next(Exception)
        const leaderID:number = ((request.jwtUserRole === RoleEnum.ADMIN) && request.body['leaderID'] !== undefined) ? request.body['leaderID'] : request.jwtUserID;
        newCircle.leaderID = leaderID;

        if(CIRCLE_TABLE_COLUMNS_REQUIRED.every((column) => newCircle[column] !== undefined) === false) 
            next(new Exception(400, `Create Circle Failed :: Missing Required Fields: ${JSON.stringify(CIRCLE_TABLE_COLUMNS_REQUIRED)}.`, 'Missing Details'));

        //Verify leaderID in body is leader role; could be ADMIN in header already verified
        else if(await DB_IS_USER_ROLE({userID: newCircle.leaderID, userRole: DATABASE_USER_ROLE_ENUM.CIRCLE_LEADER}) === false)
            next(new Exception(401, `Edit Circle Failed :: failed to verify leader status of userID: ${newCircle.leaderID}`, 'Leader status not verified.'));

        else if(await DB_INSERT_CIRCLE(newCircle.getValidProperties(CIRCLE_TABLE_COLUMNS, false)) === false) 
                next(new Exception(500, 'Create Circle  Failed :: Failed to save new circle to database.', 'Save Failed'));

        else {
            const circle:CIRCLE|undefined = await DB_SELECT_CIRCLE_DETAIL_BY_NAME(newCircle.name);

            if(circle !== undefined)
                response.status(201).send(circle.toLeaderJSON());
            else
                next(new Exception(404, 'Create Circle  Failed: Circle successfully created; but failed to retrieve circle.', 'Circle Saved'));
        }
    } else //Necessary; otherwise no response waits for timeout | Ignored if next() already replied
        next(new Exception(500, `POST_newCircle - circle Failed to parse new circle and is invalid`)); 
};

export const PATCH_circle =  async(request: JwtCircleRequest, response: Response, next: NextFunction) => {

    const FIELD_LIST:InputField[] = (request.jwtUserRole === RoleEnum.ADMIN) ? CIRCLE_FIELDS_ADMIN : CIRCLE_FIELDS;

    const currentCircle:CIRCLE = await DB_SELECT_CIRCLE(request.circleID);

    const editCircle:CIRCLE|undefined = createModelFromJSON({currentModel: currentCircle, jsonObj:request.body, fieldList: FIELD_LIST, next:next}) as CIRCLE;

    if(currentCircle.isValid && editCircle !== undefined && editCircle.isValid) {  //undefined handles next(Exception)
        //Verify leaderID is leader role
        if(editCircle.leaderID !== undefined && editCircle.leaderID !== currentCircle.leaderID 
                && await DB_IS_USER_ROLE({userID: editCircle.leaderID, userRole: DATABASE_USER_ROLE_ENUM.CIRCLE_LEADER}) === false)
            next(new Exception(401, `Edit Circle Failed :: failed to verify leader status of userID: ${editCircle.leaderID}`, 'Leader status not verified.'));

        else if((editCircle.getUniqueDatabaseProperties(currentCircle).size > 0 )
                && await DB_UPDATE_CIRCLE(request.circleID, editCircle.getUniqueDatabaseProperties(currentCircle)) === false) 
            next(new Exception(500, `Edit Circle Failed :: Failed to update circle ${request.circleID}.`, 'Save Failed'));

        else {
            response.status(202).send(editCircle.toLeaderJSON());
        }
    } else //Necessary; otherwise no response waits for timeout | Ignored if next() already replied
        next(new Exception(500, `PATCH_circle - circle ${request.circleID} Failed to parse from database and is invalid`)); 
};

export const DELETE_circle =  async(request: JwtCircleRequest, response: Response, next: NextFunction) => {

    if(await DB_DELETE_CIRCLE_ANNOUNCEMENT({announcementID: undefined, circleID: request.circleID}) === false)
        next(new Exception(500, `Failed to delete all announcements for circle ${request.circleID}`, 'Deleting Announcements Failed'));

    else if(await DB_DELETE_RECIPIENT_PRAYER_REQUEST({circleID: request.circleID}) === false)
        next(new Exception(500, `Failed to delete all prayer request recipient records for circle ${request.circleID}`, 'Deleting Circle Prayer Requests Failed'));
    
    else if(await DB_DELETE_CIRCLE_USER_STATUS({userID: undefined, circleID: request.circleID}) === false)
        next(new Exception(500, `Failed to delete all user members for circle ${request.circleID}`, 'Removing Members Failed'));
        
    else if(await clearImageCombinations({id: request.circleID, imageType: ImageTypeEnum.CIRCLE_PROFILE}) === false)
        next(new Exception(500, `Failed to delete circle profile image for circle ${request.circleID}`, 'Profile Image Exists'));

    else if(await DB_DELETE_CIRCLE(request.circleID))
        response.status(204).send(`User ${request.circleID} deleted successfully`);
    else
        next(new Exception(404, `Circle Delete Failed :: Failed to delete circle ${request.circleID}.`, 'Delete Failed'));
};

/* Circle Profile Images */
export const GET_circleImage = async(request: JwtCircleRequest, response: Response, next: NextFunction) => {
    const filePath:string|undefined = (await DB_SELECT_CIRCLE(request.circleID)).image || undefined;
    if(filePath !== undefined)
        response.status(200).redirect(filePath);
    else
        next(new Exception(404, `Circle ${request.circleID} doesn't have a saved profile image`, 'No Image'));
}

export const POST_circleImage = async(request: CircleImageRequest, response: Response, next: NextFunction) => {
    const fileName:string = request.params.file || 'invalid';
    const savedFileName:string|undefined = await uploadImage({id:request.circleID, fileName, imageBlob: request.body, imageType: ImageTypeEnum.USER_PROFILE});
    if(savedFileName !== undefined && await DB_UPDATE_CIRCLE(request.circleID, new Map([['image', savedFileName]])))
        response.status(202).send(`Successfully saved profile image: ${savedFileName}`);
    else
        next(new Exception(500, `Profile image upload failed: ${savedFileName}`, 'Upload Failed'));
}

export const DELETE_circleImage = async(request: JwtCircleRequest, response: Response, next: NextFunction) => {
    if(await clearImageCombinations({id:request.circleID, imageType: ImageTypeEnum.CIRCLE_PROFILE}) && await DB_UPDATE_CIRCLE(request.circleID, new Map([['image', null]])))
        response.status(202).send(`Successfully deleted circle image for ${request.circleID}`);
    else
        next(new Exception(500, `Circle image deletion failed for ${request.circleID}`, 'Delete Failed'));
}


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

export const DELETE_circleAnnouncement =  async(request: JwtCircleRequest, response: Response, next: NextFunction) => {
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
export const POST_circleMemberAccept =  async(request: JwtCircleRequest, response: Response, next: NextFunction) => {

    if(await DB_UPDATE_CIRCLE_USER_STATUS({userID: request.jwtUserID, circleID: request.circleID, currentStatus: DATABASE_CIRCLE_STATUS_ENUM.INVITE, status: DATABASE_CIRCLE_STATUS_ENUM.MEMBER}) === false)
        next(new Exception(404, `Circle Membership Accept Invite :: Failed to accept membership for user ${request.jwtUserID} to circle ${request.params.circle}.`, 'Acceptance Failed'));

    else {
        const circle:CIRCLE = await DB_SELECT_CIRCLE_DETAIL({userID: request.jwtUserID, circleID: request.circleID});
        response.status(202).send(circle.toJSON());
    }
};

export const POST_circleMemberRequest =  async(request: JwtCircleRequest, response: Response, next: NextFunction) => {

    const circle:CIRCLE = await DB_SELECT_CIRCLE_DETAIL({userID: request.jwtUserID, circleID: request.circleID});

    //Verify circle.inviteToken for automatic membership
    const status:DATABASE_CIRCLE_STATUS_ENUM = (request.body['inviteToken'] !== undefined && circle.inviteToken !== undefined && circle.inviteToken.length > 0 && request.body['inviteToken'] === circle.inviteToken) 
    ? DATABASE_CIRCLE_STATUS_ENUM.MEMBER
    : DATABASE_CIRCLE_STATUS_ENUM.REQUEST;

    circle.requestorID = request.jwtUserID;
    circle.requestorStatus = CircleStatus[status];

    if(await DB_INSERT_CIRCLE_USER_STATUS({userID: request.jwtUserID, circleID: request.circleID, status: status}) === false)
        next(new Exception(404, `Circle Membership Request Failed :: Failed to create membership request status for user ${request.jwtUserID} to circle ${request.circleID}.`, 'Request Failed'));

    else if(status === DATABASE_CIRCLE_STATUS_ENUM.MEMBER)
        response.status(201).send(circle.toJSON());

    else 
        response.status(202).send(circle.toJSON());
};

export const DELETE_circleMember =  async(request: JwtCircleRequest, response: Response, next: NextFunction) => {

    if(await DB_DELETE_CIRCLE_USER_STATUS({userID: request.jwtUserID, circleID: request.circleID}) === false)
        next(new Exception(404, `Circle Membership Delete Failed :: Failed to delete membership for user ${request.jwtUserID} to circle ${request.circleID}.`, 'Delete Failed'));
    else
        response.status(204).send(`User ${request.jwtUserID} successfully removed from circle ${request.circleID}`);
};

/*************************************
 *  CIRCLE MEMBERSHIP | LEADER ROUTES
 *************************************/
export const POST_circleLeaderMemberInvite =  async(request: JwtCircleClientRequest, response: Response, next: NextFunction) => {
    
    if(await DB_INSERT_CIRCLE_USER_STATUS({userID: request.clientID, circleID: request.circleID, status: DATABASE_CIRCLE_STATUS_ENUM.INVITE}) === false)
        next(new Exception(404, `Circle Membership Leader Invite Failed :: Failed to invite user ${request.params.client} to circle ${request.circleID}.`, 'Invite Failed'));
    else
        response.status(202).send(`User ${request.params.client} successfully invited to circle ${request.circleID}`);
};

//Circle Membership Request Must Exist (Leader Accepts)
export const POST_circleLeaderAccept =  async(request: JwtCircleClientRequest, response: Response, next: NextFunction) => {
    
    if(await DB_UPDATE_CIRCLE_USER_STATUS({userID: request.clientID, circleID: request.circleID, status: DATABASE_CIRCLE_STATUS_ENUM.MEMBER}) === false)
        next(new Exception(404, `Circle Membership Leader Accept :: Failed to accept membership for user ${request.params.client} to circle ${request.circleID}.`, 'Accept Failed'));
    else
        response.status(202).send(`User ${request.params.client} successfully joined circle ${request.circleID}`);
};

//Admin overrides invite/request process
export const POST_circleMemberJoinAdmin =  async(request: JwtCircleClientRequest, response: Response, next: NextFunction) => {
    //First attempt to remove existing invite/request status
    await DB_DELETE_CIRCLE_USER_STATUS({userID: request.clientID, circleID: request.circleID});

    if(await DB_INSERT_CIRCLE_USER_STATUS({userID: request.clientID, circleID: request.circleID, status: DATABASE_CIRCLE_STATUS_ENUM.MEMBER}) === false)
        next(new Exception(404, `Circle Membership Accept Failed :: Failed to accept membership for user ${request.params.client} to circle ${request.params.circle}.`, 'Join Failed'));

    else {
        response.status(202).send(`User ${request.params.client} successfully joined circle ${request.params.circle}`);
        log.event(`Admin assigning user ${request.params.client} to circle ${request.params.circle}`);
    }
};

export const DELETE_circleLeaderMember =  async(request: JwtCircleClientRequest, response: Response, next: NextFunction) => {
    
    if(await DB_DELETE_CIRCLE_USER_STATUS({userID: request.clientID, circleID: request.circleID}) === false)
        next(new Exception(404, `Circle Membership Leader Delete Failed :: Failed to delete membership for user ${request.params.client} to circle ${request.circleID}.`, 'Delete Failed'));
    else
        response.status(204).send(`User ${request.params.client} successfully removed from circle ${request.circleID}`);
};
