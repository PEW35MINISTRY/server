import { NextFunction, Response } from 'express';
import { CircleEventListItem, CircleListItem } from '../../0-assets/field-sync/api-type-sync/circle-types.mjs';
import { CIRCLE_ANNOUNCEMENT_FIELDS, CIRCLE_FIELDS, CIRCLE_FIELDS_ADMIN, CircleSearchRefineEnum, CircleStatusEnum } from '../../0-assets/field-sync/input-config-sync/circle-field-config.mjs';
import InputField from '../../0-assets/field-sync/input-config-sync/inputField.mjs';
import { RoleEnum } from '../../0-assets/field-sync/input-config-sync/profile-field-config.mjs';
import CIRCLE_ANNOUNCEMENT from '../../2-services/1-models/circleAnnouncementModel.mjs';
import CIRCLE from '../../2-services/1-models/circleModel.mjs';
import { CIRCLE_ANNOUNCEMENT_TABLE_COLUMNS_REQUIRED, CIRCLE_TABLE_COLUMNS_REQUIRED, DATABASE_CIRCLE_STATUS_ENUM, DATABASE_USER_ROLE_ENUM } from '../../2-services/2-database/database-types.mjs';
import { DB_DELETE_CIRCLE, DB_DELETE_CIRCLE_ANNOUNCEMENT, DB_DELETE_CIRCLE_USER_STATUS, DB_FLUSH_CIRCLE_SEARCH_CACHE_ADMIN, DB_INSERT_CIRCLE, DB_INSERT_CIRCLE_ANNOUNCEMENT, DB_INSERT_CIRCLE_USER_STATUS, DB_SELECT_CIRCLE, DB_SELECT_CIRCLE_ANNOUNCEMENT_CURRENT, DB_SELECT_CIRCLE_DETAIL, DB_SELECT_CIRCLE_DETAIL_BY_NAME, DB_SELECT_CIRCLE_USER_LIST, DB_SELECT_USER_CIRCLES, DB_UPDATE_CIRCLE, DB_UPDATE_CIRCLE_USER_STATUS } from '../../2-services/2-database/queries/circle-queries.mjs';
import { DB_DELETE_RECIPIENT_PRAYER_REQUEST, DB_SELECT_PRAYER_REQUEST_CIRCLE_LIST } from '../../2-services/2-database/queries/prayer-request-queries.mjs';
import { DB_DELETE_CONTACT_CACHE_CIRCLE_MEMBERS, DB_IS_USER_ROLE } from '../../2-services/2-database/queries/user-queries.mjs';
import * as log from '../../2-services/10-utilities/logging/log.mjs';
import { JwtCircleRequest, JwtRequest } from '../2-auth/auth-types.mjs';
import { Exception, ImageTypeEnum } from '../api-types.mjs';
import { clearImage, clearImageCombinations, uploadImage } from '../../2-services/10-utilities/image-utilities.mjs';
import { CircleAnnouncementCreateRequest, CircleImageRequest, JwtCircleClientRequest } from './circle-types.mjs';
import getCircleEventSampleList from './circle-event-samples.mjs';
import { ProfileListItem } from '../../0-assets/field-sync/api-type-sync/profile-types.mjs';
import { CircleNotificationType } from '../8-notification/notification-types.mjs';
import { sendNotificationCircle} from '../8-notification/notification-utilities.mjs';


/******************
 *  CIRCLE ROUTES
 ******************/
//Auto determines whether user circle status; returning only relevant details
export const GET_circle =  async(request: JwtCircleRequest, response: Response, next: NextFunction) => {
    const circle:CIRCLE = await DB_SELECT_CIRCLE_DETAIL({circleID: request.circleID, userID: request.jwtUserID});

    if(!circle.isValid) { //Necessary; otherwise no response waits for timeout | Ignored if next() already replied
        next(new Exception(404, `GET_circle - circle ${request.circleID} Failed to parse from database and is invalid`, 'Circle Not Found'));
        return;
    } 

    if(circle.requestorStatus === undefined)
        circle.requestorStatus = CircleStatusEnum.NON_MEMBER;  //Note: applies to ADMIN too

    //Additional Details for all circle statuses
    circle.memberList = await DB_SELECT_CIRCLE_USER_LIST(circle.circleID, DATABASE_CIRCLE_STATUS_ENUM.MEMBER);
    circle.eventList = getCircleEventSampleList(request.circleID); //TODO Define Circle Event once Implemented

    //Public Circle Details only
    if([CircleStatusEnum.NON_MEMBER, CircleStatusEnum.INVITE, CircleStatusEnum.REQUEST].includes(circle.requestorStatus) && (request.jwtUserRole !== RoleEnum.ADMIN)) { 
        response.status(200).send(circle.toPublicJSON());        
        log.event('Returning circle public details for circleID: ', request.circleID);
        return;

    //Additional MEMBER Detail Queries
    } else if([CircleStatusEnum.MEMBER, CircleStatusEnum.LEADER].includes(circle.requestorStatus) || (request.jwtUserRole === RoleEnum.ADMIN)) { 
        circle.announcementList = await DB_SELECT_CIRCLE_ANNOUNCEMENT_CURRENT(request.circleID);
        circle.prayerRequestList = await DB_SELECT_PRAYER_REQUEST_CIRCLE_LIST( circle.circleID);
    }
        
    if(circle.requestorStatus === CircleStatusEnum.MEMBER && (request.jwtUserRole !== RoleEnum.ADMIN)) {
        response.status(200).send(circle.toMemberJSON());        
        log.event('Returning circle member details for circleID: ', request.circleID);
        return;
    }

    //Additional LEADER Detail Queries
    else if((request.jwtUserID === circle.leaderID ) || (request.jwtUserRole === RoleEnum.ADMIN)) {
        circle.pendingInviteList = await DB_SELECT_CIRCLE_USER_LIST(circle.circleID, DATABASE_CIRCLE_STATUS_ENUM.INVITE);
        circle.pendingRequestList = await DB_SELECT_CIRCLE_USER_LIST(circle.circleID, DATABASE_CIRCLE_STATUS_ENUM.REQUEST);
    }

    if(request.jwtUserRole === RoleEnum.ADMIN)
        response.status(200).send(circle.toJSON()); 

    else if(request.jwtUserID === circle.leaderID)
        response.status(200).send(circle.toLeaderJSON());

    else //Never should reach
        next(new Exception(500, `GET_circle - circle ${request.circleID} Failed to identify requestor: ${circle.requestorID} with circle requestorStatus: ${circle.requestorStatus}`, 'Circle Missing'));
};


//List of all circles user is member, invited, requested (not sorted)
export const GET_userCircleList = async(request: JwtRequest, response: Response, next: NextFunction) => {
    response.status(200).send(await DB_SELECT_USER_CIRCLES(request.jwtUserID));
};


export const POST_newCircle =  async(request: JwtRequest, response: Response, next: NextFunction) => {
    const FIELD_LIST:InputField[] = (request.jwtUserRole === RoleEnum.ADMIN) ? CIRCLE_FIELDS_ADMIN : CIRCLE_FIELDS;

    const newCircle:CIRCLE|Exception = await CIRCLE.constructByJson({jsonObj:request.body, fieldList: FIELD_LIST});

    if(!(newCircle instanceof Exception)) {
        const leaderID:number = ((request.jwtUserRole === RoleEnum.ADMIN) && request.body['leaderID'] !== undefined) ? request.body['leaderID'] : request.jwtUserID;
        newCircle.leaderID = leaderID;

        if(CIRCLE_TABLE_COLUMNS_REQUIRED.every((column) => newCircle[column] !== undefined) === false) 
            next(new Exception(400, `Create Circle Failed :: Missing Required Fields: ${JSON.stringify(CIRCLE_TABLE_COLUMNS_REQUIRED)}.`, 'Missing Details'));

        //Verify leaderID in body is leader role; could be ADMIN in header already verified
        else if(await DB_IS_USER_ROLE(newCircle.leaderID, DATABASE_USER_ROLE_ENUM.CIRCLE_LEADER) === false)
            next(new Exception(401, `Edit Circle Failed :: failed to verify leader status of userID: ${newCircle.leaderID}`, 'Leader status not verified.'));

        else if(await DB_INSERT_CIRCLE(newCircle.getDatabaseProperties()) === false) 
                next(new Exception(500, 'Create Circle  Failed :: Failed to save new circle to database.', 'Save Failed'));

        else {
            const circle:CIRCLE|undefined = await DB_SELECT_CIRCLE_DETAIL_BY_NAME(newCircle.leaderID, newCircle.name);

            if(circle !== undefined) {
                circle.requestorID = request.jwtUserID;
                circle.requestorStatus = CircleStatusEnum.LEADER;
                
                response.status(201).send(circle.toLeaderJSON());
                DB_FLUSH_CIRCLE_SEARCH_CACHE_ADMIN();
            } else
                next(new Exception(404, 'Create Circle  Failed: Circle successfully created; but failed to retrieve circle.', 'Circle Saved'));
        }
    } else
        next(newCircle);
};

export const PATCH_circle =  async(request: JwtCircleRequest, response: Response, next: NextFunction) => {

    const FIELD_LIST:InputField[] = (request.jwtUserRole === RoleEnum.ADMIN) ? CIRCLE_FIELDS_ADMIN : CIRCLE_FIELDS;

    const currentCircle:CIRCLE = await DB_SELECT_CIRCLE(request.circleID);

    const editCircle:CIRCLE|Exception = await CIRCLE.constructAndEvaluateByJson({currentModel: currentCircle, jsonObj:request.body, fieldList: FIELD_LIST});

    if(currentCircle.isValid && !(editCircle instanceof Exception) && editCircle.isValid) { 
        //Verify leaderID is leader role
        if(editCircle.leaderID !== undefined && editCircle.leaderID !== currentCircle.leaderID 
                && await DB_IS_USER_ROLE(editCircle.leaderID, DATABASE_USER_ROLE_ENUM.CIRCLE_LEADER) === false)
            next(new Exception(401, `Edit Circle Failed :: failed to verify leader status of userID: ${editCircle.leaderID}`, 'Leader status not verified.'));

        else if((editCircle.getUniqueDatabaseProperties(currentCircle).size > 0 )
                && await DB_UPDATE_CIRCLE(request.circleID, editCircle.getUniqueDatabaseProperties(currentCircle)) === false) 
            next(new Exception(500, `Edit Circle Failed :: Failed to update circle ${request.circleID}.`, 'Save Failed'));

        else {
            editCircle.requestorID = request.jwtUserID;
            editCircle.requestorStatus = CircleStatusEnum.LEADER;

            response.status(202).send(editCircle.toLeaderJSON());
        }
    } else //Necessary; otherwise no response waits for timeout | Ignored if next() already replied
        next((editCircle instanceof Exception) ? editCircle
            : new Exception(500, `PATCH_circle - circle ${request.circleID} Failed to parse from database and is invalid`)); 
};

export const DELETE_circle =  async(request: JwtCircleRequest, response: Response, next: NextFunction) => {

    //Flush cache for contacts of current circle members
    await DB_DELETE_CONTACT_CACHE_CIRCLE_MEMBERS(request.circleID);

    if(await DB_DELETE_CIRCLE_ANNOUNCEMENT({announcementID: undefined, circleID: request.circleID}) === false)
        next(new Exception(500, `Failed to delete all announcements for circle ${request.circleID}`, 'Deleting Announcements Failed'));

    else if(await DB_DELETE_RECIPIENT_PRAYER_REQUEST({circleID: request.circleID}) === false)
        next(new Exception(500, `Failed to delete all prayer request recipient records for circle ${request.circleID}`, 'Deleting Circle Prayer Requests Failed'));
    
    else if(await DB_DELETE_CIRCLE_USER_STATUS({userID: undefined, circleID: request.circleID}) === false)
        next(new Exception(500, `Failed to delete all user members for circle ${request.circleID}`, 'Removing Members Failed'));
        
    else if(await clearImageCombinations({id: request.circleID, imageType: ImageTypeEnum.CIRCLE_PROFILE}) === false)
        next(new Exception(500, `Failed to delete circle profile image for circle ${request.circleID}`, 'Profile Image Exists'));

    else if(await DB_DELETE_CIRCLE(request.circleID)) {
        response.status(204).send(`User ${request.circleID} deleted successfully`);
        DB_FLUSH_CIRCLE_SEARCH_CACHE_ADMIN();
    } else
        next(new Exception(404, `Circle Delete Failed :: Failed to delete circle ${request.circleID}.`, 'Delete Failed'));
};

/* Circle Profile Images */
export const GET_circleImage = async(request: JwtCircleRequest, response: Response, next: NextFunction) => {
    const filePath:string|undefined = (await DB_SELECT_CIRCLE(request.circleID)).image || undefined;
    if(filePath !== undefined) 
        response.status(200).send(filePath);
    else
        next(new Exception(404, `Circle ${request.circleID} doesn't have a saved profile image`, 'No Image'));
}

export const POST_circleImage = async(request: CircleImageRequest, response: Response, next: NextFunction) => {
    const fileName:string = request.params.file || 'invalid'; //Necessary to parse file extension
    const fileExtension:string = fileName.split('.').pop();
    let filePath:string|undefined = undefined;

    const existingFilePath:string|undefined = (await DB_SELECT_CIRCLE(request.circleID)).image || undefined;
    const existingFileName:string = (existingFilePath || '').split('/').pop();
    const existingFileExtension:string = (existingFilePath || '').split('.').pop();

    if(fileExtension !== existingFileExtension && existingFilePath !== undefined && await clearImage(existingFileName) === false)
        next(new Exception(500, `Circle Profile image deletion failed for ${request.circleID} : ${existingFilePath}`, 'Existing Image'));

    else if((filePath = await uploadImage({id:request.circleID, fileName, imageBlob: request.body, imageType: ImageTypeEnum.CIRCLE_PROFILE})) === undefined)
        next(new Exception(500, `Circle Profile image upload failed for fileName: ${fileName}`, 'Upload Failed'));

    else if(await DB_UPDATE_CIRCLE(request.circleID, new Map([['image', filePath]])) === false)
        next(new Exception(500, `Circle Profile image upload failed to save: ${filePath}`, 'Save Failed'));

    else
        response.status(202).send(filePath);
}

export const DELETE_circleImage = async(request: JwtCircleRequest, response: Response, next: NextFunction) => {
    if(await clearImageCombinations({id:request.circleID, imageType: ImageTypeEnum.CIRCLE_PROFILE}) && await DB_UPDATE_CIRCLE(request.circleID, new Map([['image', null]])))
        response.status(202).send(`Successfully deleted circle image for ${request.circleID}`);
    else
        next(new Exception(500, `Circle image deletion failed for ${request.circleID}`, 'Delete Failed'));
}


/***********************
 *  CIRCLE SEARCH
 ***********************/
export const DELETE_flushCircleSearchCache = async (request:JwtRequest, response:Response, next: NextFunction) => {

    if(await DB_FLUSH_CIRCLE_SEARCH_CACHE_ADMIN()) {
        response.status(202).send(`Successfully flushed circle search cache`);
        log.auth(`User ${request.jwtUserID} has reset the server's circle search cache`);

    } else
        next(new Exception(500, 'Failed to flush circle search cache.', 'Flush failed'));
}

/***********************
 *  CIRCLE ANNOUNCEMENT
 ***********************/

export const POST_circleAnnouncement =  async(request: CircleAnnouncementCreateRequest, response: Response, next: NextFunction) => {
    
    const newCircleAnnouncement:CIRCLE_ANNOUNCEMENT|Exception = await CIRCLE_ANNOUNCEMENT.constructByJson({jsonObj:request.body, fieldList: CIRCLE_ANNOUNCEMENT_FIELDS});

    if(!(newCircleAnnouncement instanceof Exception)) {
        newCircleAnnouncement.circleID = request.circleID;
        
        if(CIRCLE_ANNOUNCEMENT_TABLE_COLUMNS_REQUIRED.every((column) => newCircleAnnouncement[column] !== undefined) === false) 
            next(new Exception(400, `Create Circle Announcement Failed :: Missing Required Fields: ${JSON.stringify(CIRCLE_ANNOUNCEMENT_TABLE_COLUMNS_REQUIRED)}.`, 'Missing Details'));

        else if(await DB_INSERT_CIRCLE_ANNOUNCEMENT(newCircleAnnouncement.getDatabaseProperties()) === false) 
                next(new Exception(500, 'Create Circle Announcement Failed :: Failed to save new circle announcement.', 'Save Failed'));

        else
            response.status(202).send(newCircleAnnouncement.toJSON());
    } else
        next(newCircleAnnouncement);
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
 *  CIRCLE MEMBERSHIP | USER ROUTES
 ***************************************/

//Circle Membership Invite Must Exist (User Accepts)
export const POST_circleMemberAccept =  async(request: JwtCircleRequest, response: Response, next: NextFunction) => {

    if(await DB_UPDATE_CIRCLE_USER_STATUS({userID: request.jwtUserID, circleID: request.circleID, currentStatus: DATABASE_CIRCLE_STATUS_ENUM.INVITE, status: DATABASE_CIRCLE_STATUS_ENUM.MEMBER}) === false)
        next(new Exception(404, `Circle Membership Accept Invite :: Failed to accept membership for user ${request.jwtUserID} to circle ${request.params.circle}.`, 'Acceptance Failed'));

    else {
        await DB_DELETE_CONTACT_CACHE_CIRCLE_MEMBERS(request.circleID);
        const circleItem:CircleListItem = (await DB_SELECT_CIRCLE(request.circleID)).toListItem();
        circleItem.status = CircleStatusEnum.INVITE;
        response.status(202).send(circleItem);
    }
};

export const POST_circleMemberRequest =  async(request: JwtCircleRequest, response: Response, next: NextFunction) => {

    const circle:CIRCLE = await DB_SELECT_CIRCLE_DETAIL({userID: request.jwtUserID, circleID: request.circleID});

    //Verify circle.inviteToken for automatic membership
    const status:DATABASE_CIRCLE_STATUS_ENUM = (request.body['inviteToken'] !== undefined && circle.inviteToken !== undefined && circle.inviteToken.length > 0 && request.body['inviteToken'] === circle.inviteToken) 
    ? DATABASE_CIRCLE_STATUS_ENUM.MEMBER
    : DATABASE_CIRCLE_STATUS_ENUM.REQUEST;

    circle.requestorID = request.jwtUserID;
    circle.requestorStatus = CircleStatusEnum[status];

    if(await DB_INSERT_CIRCLE_USER_STATUS({userID: request.jwtUserID, circleID: request.circleID, status: status}) === false)
        next(new Exception(404, `Circle Membership Request Failed :: Failed to create membership request status for user ${request.jwtUserID} to circle ${request.circleID}.`, 'Request Failed'));

    else {
        if(status === DATABASE_CIRCLE_STATUS_ENUM.MEMBER) await DB_DELETE_CONTACT_CACHE_CIRCLE_MEMBERS(request.circleID);

        const circleItem:CircleListItem = circle.toListItem();
        circleItem.status = CircleStatusEnum[status];
        response.status(202).send(circleItem);
    }
};

export const DELETE_circleMember =  async(request: JwtCircleRequest, response: Response, next: NextFunction) => {

    if(await DB_DELETE_CIRCLE_USER_STATUS({userID: request.jwtUserID, circleID: request.circleID}) === false)
        next(new Exception(404, `Circle Membership Delete Failed :: Failed to delete membership for user ${request.jwtUserID} to circle ${request.circleID}.`, 'Delete Failed'));
    
    else {
        await DB_DELETE_CONTACT_CACHE_CIRCLE_MEMBERS(request.circleID);
        response.status(204).send(`User ${request.jwtUserID} successfully removed from circle ${request.circleID}`);
    }
};

/*************************************
 *  CIRCLE MEMBERSHIP | LEADER ROUTES
 *************************************/
export const POST_circleLeaderMemberInvite =  async(request: JwtCircleClientRequest, response: Response, next: NextFunction) => {
    
    if(await DB_INSERT_CIRCLE_USER_STATUS({userID: request.clientID, circleID: request.circleID, status: DATABASE_CIRCLE_STATUS_ENUM.INVITE}) === false)
        next(new Exception(404, `Circle Membership Leader Invite Failed :: Failed to invite user ${request.clientID} to circle ${request.circleID}.`, 'Invite Failed'));
    else {
        const circleItem:CircleListItem = (await DB_SELECT_CIRCLE(request.circleID)).toListItem();
        circleItem.status = CircleStatusEnum.INVITE;

        sendNotificationCircle(request.jwtUserID, [request.clientID], circleItem.circleID, CircleNotificationType.CIRCLE_INVITE);
        response.status(202).send(circleItem);
    }
};

//Circle Membership Request Must Exist (Leader Accepts)
export const POST_circleLeaderAccept =  async(request: JwtCircleClientRequest, response: Response, next: NextFunction) => {
    
    if(await DB_UPDATE_CIRCLE_USER_STATUS({userID: request.clientID, circleID: request.circleID, status: DATABASE_CIRCLE_STATUS_ENUM.MEMBER}) === false)
        next(new Exception(404, `Circle Membership Leader Accept :: Failed to accept membership for user ${request.params.client} to circle ${request.circleID}.`, 'Accept Failed'));

    else {
        await DB_DELETE_CONTACT_CACHE_CIRCLE_MEMBERS(request.circleID);
        const circleItem:CircleListItem = (await DB_SELECT_CIRCLE(request.circleID)).toListItem();
        circleItem.status = CircleStatusEnum.INVITE;
        response.status(202).send(circleItem);
    }
};

//Admin overrides invite/request process
export const POST_circleMemberJoinAdmin =  async(request: JwtCircleClientRequest, response: Response, next: NextFunction) => {

    if(await DB_INSERT_CIRCLE_USER_STATUS({userID: request.clientID, circleID: request.circleID, status: DATABASE_CIRCLE_STATUS_ENUM.MEMBER}) === false)
        next(new Exception(404, `Circle Membership Accept Failed :: Failed to accept membership for user ${request.params.client} to circle ${request.params.circle}.`, 'Join Failed'));

    else {
        await DB_DELETE_CONTACT_CACHE_CIRCLE_MEMBERS(request.circleID);
        const circle:CircleListItem = (await DB_SELECT_CIRCLE(request.circleID)).toListItem();
        circle.status = CircleStatusEnum.MEMBER;

        sendNotificationCircle(request.jwtUserID, [request.clientID], circle.circleID, CircleNotificationType.CIRCLE_INVITE);
        
        response.status(202).send(circle);
        log.event(`Admin assigning user ${request.clientID} to circle ${request.circleID}`);
    }
};

export const DELETE_circleLeaderMember =  async(request: JwtCircleClientRequest, response: Response, next: NextFunction) => {
    
    if(await DB_DELETE_CIRCLE_USER_STATUS({userID: request.clientID, circleID: request.circleID}) === false)
        next(new Exception(404, `Circle Membership Leader Delete Failed :: Failed to delete membership for user ${request.params.client} to circle ${request.circleID}.`, 'Circle Delete Failed'));
    else {
        await DB_DELETE_CONTACT_CACHE_CIRCLE_MEMBERS(request.circleID);
        response.status(204).send(`User ${request.params.client} successfully removed from circle ${request.circleID}`);
    }
};

