import express, { NextFunction, Request, Response, Router } from 'express';
import InputField from '../../0-assets/field-sync/input-config-sync/inputField.mjs';
import { CREATE_PRAYER_REQUEST_FIELDS, EDIT_PRAYER_REQUEST_FIELDS, PRAYER_REQUEST_COMMENT_FIELDS, PRAYER_REQUEST_FIELDS_ADMIN } from '../../0-assets/field-sync/input-config-sync/prayer-request-field-config.mjs';
import { RoleEnum } from '../../0-assets/field-sync/input-config-sync/profile-field-config.mjs';
import PRAYER_REQUEST from '../../2-services/1-models/prayerRequestModel.mjs';
import { PRAYER_REQUEST_TABLE_COLUMNS_REQUIRED } from '../../2-services/2-database/database-types.mjs';
import { DB_DELETE_PRAYER_REQUEST, DB_DELETE_PRAYER_REQUEST_COMMENT, DB_DELETE_RECIPIENT_PRAYER_REQUEST, DB_DELETE_RECIPIENT_PRAYER_REQUEST_BATCH, DB_INSERT_AND_SELECT_PRAYER_REQUEST, DB_INSERT_PRAYER_REQUEST_COMMENT, DB_INSERT_RECIPIENT_PRAYER_REQUEST_BATCH, DB_SELECT_CIRCLE_RECIPIENT_PRAYER_REQUEST_LIST, DB_SELECT_PRAYER_REQUEST_CIRCLE_LIST, DB_SELECT_PRAYER_REQUEST_COMMENT, DB_SELECT_PRAYER_REQUEST_DETAIL, DB_SELECT_PRAYER_REQUEST_REQUESTOR_LIST, DB_SELECT_PRAYER_REQUEST_USER_LIST, DB_SELECT_USER_RECIPIENT_PRAYER_REQUEST_LIST, DB_UPDATE_INCREMENT_PRAYER_COUNT, DB_UPDATE_INCREMENT_PRAYER_REQUEST_COMMENT_LIKE_COUNT, DB_UPDATE_PRAYER_REQUEST, DB_UPDATE_RESOLVE_PRAYER_REQUEST } from '../../2-services/2-database/queries/prayer-request-queries.mjs';
import * as log from '../../2-services/10-utilities/logging/log.mjs';
import { JwtCircleRequest, JwtClientRequest, JwtPrayerRequest, JwtRequest } from '../2-auth/auth-types.mjs';
import { Exception } from '../api-types.mjs';
import { PrayerRequestCommentRequest, PrayerRequestPatchRequest, PrayerRequestPostRequest } from './prayer-request-types.mjs';
import { DB_SELECT_CIRCLE_SEARCH, DB_SELECT_CIRCLE_USER_IDS } from '../../2-services/2-database/queries/circle-queries.mjs';
import { sendNotification, sendNotificationCircle} from '../8-notification/notification-utilities.mjs';
import { CircleNotificationType, NotificationType } from '../8-notification/notification-types.mjs';


/*************************************
 *  List PRAYER REQUEST ROUTES
 *************************************/
//List of prayer requests for which user is a recipient
export const GET_PrayerRequestUserList = async (request: JwtRequest, response: Response) => {
    response.status(200).send(await DB_SELECT_PRAYER_REQUEST_USER_LIST(request.jwtUserID));
    log.event(`Returning prayer request list for user ${request.jwtUserID}`);
};

export const GET_PrayerRequestCircleList = async (request: JwtCircleRequest, response: Response) => {
    response.status(200).send(await DB_SELECT_PRAYER_REQUEST_CIRCLE_LIST(request.circleID));
    log.event(`Returning prayer request list for circle ${request.circleID}`);
};

//List of prayer requests for which the user or client is the requestor
export const GET_PrayerRequestRequestorList = async(request: JwtClientRequest, response: Response) => {
    const userID = request.clientID || request.jwtUserID; 
    response.status(200).send(await DB_SELECT_PRAYER_REQUEST_REQUESTOR_LIST(userID, false));
    log.event('Returning active prayer requests for userID:', userID);
};

export const GET_PrayerRequestRequestorResolvedList = async(request: JwtClientRequest, response: Response) => {
    const userID = request.clientID || request.jwtUserID; 
    response.status(200).send(await DB_SELECT_PRAYER_REQUEST_REQUESTOR_LIST(userID, true));
    log.event('Returning resolved prayer requests for userID:', userID);
};



/*************************************
 *  INDIVIDUAL PRAYER REQUEST ROUTES
 *************************************/
export const GET_PrayerRequest = async (request: JwtPrayerRequest, response: Response, next: NextFunction) => {

    const prayerRequest = await DB_SELECT_PRAYER_REQUEST_DETAIL(request.prayerRequestID, true); //Includes user and circle recipient list

    if(prayerRequest.isValid) {
        response.status(200).send(prayerRequest.toJSON());
        log.event('Returning specific Prayer Request:', request.prayerRequestID);

    } else 
        next(new Exception(404, `Prayer Request: ${request.prayerRequestID} unavailable from database.`, 'Prayer Request Not Found'));
};


//POST includes sharing to circle/partners/leaders recipients
export const POST_prayerRequest = async (request: PrayerRequestPostRequest, response: Response, next: NextFunction) => {
    const newPrayerRequest:PRAYER_REQUEST|Exception = await PRAYER_REQUEST.constructByJson({jsonObj:request.body, fieldList: CREATE_PRAYER_REQUEST_FIELDS});

    if(!(newPrayerRequest instanceof Exception)) {
        const requestorID:number = ((request.jwtUserRole === RoleEnum.ADMIN) && request.body['requestorID'] !== undefined) ? request.body['requestorID'] : request.jwtUserID;
        newPrayerRequest.requestorID = requestorID;

        if(PRAYER_REQUEST_TABLE_COLUMNS_REQUIRED.every((column) => newPrayerRequest[column] !== undefined) === false) 
            next(new Exception(400, `Create Prayer Request Failed :: Missing Required Fields: ${JSON.stringify(PRAYER_REQUEST_TABLE_COLUMNS_REQUIRED)}.`, 'Missing Details'));

        else { 
                const savedPrayerRequest:PRAYER_REQUEST = await DB_INSERT_AND_SELECT_PRAYER_REQUEST(newPrayerRequest.getDatabaseProperties());

                if(!savedPrayerRequest.isValid) 
                    next(new Exception(500, 'Create Prayer Request Failed :: Failed to save new prayer request to database.', 'Save Failed'));
                
                else if(await DB_INSERT_RECIPIENT_PRAYER_REQUEST_BATCH({prayerRequestID: savedPrayerRequest.prayerRequestID, userRecipientIDList: newPrayerRequest.addUserRecipientIDList || [], circleRecipientIDList: newPrayerRequest.addCircleRecipientIDList || []}) === false)
                    next(new Exception(500, 'Create Prayer Request Failed :: Failed to save batch recipient list.', 'Send Failed'));
                
                else {
                    // send notifications asynchronously
                    for (const circleID of (newPrayerRequest.addCircleRecipientIDList || [])) {
                        const userIDs = await DB_SELECT_CIRCLE_USER_IDS(circleID, undefined, false);
                        sendNotificationCircle(requestorID, userIDs, circleID, CircleNotificationType.PRAYER_REQUEST_RECIPIENT);
                    }
                    if (newPrayerRequest.addUserRecipientIDList !== undefined && newPrayerRequest.addUserRecipientIDList.length > 0) sendNotification(requestorID, newPrayerRequest.addUserRecipientIDList || [], NotificationType.PRAYER_REQUEST_RECIPIENT);

                    response.status(201).send(savedPrayerRequest.toJSON());
                    log.event('Created New Prayer Request:', savedPrayerRequest.prayerRequestID);
                }
        }
    } else
        next(newPrayerRequest);
};

export const PATCH_prayerRequest = async (request: PrayerRequestPatchRequest, response: Response, next: NextFunction) => {

    const FIELD_LIST:InputField[] = (request.jwtUserRole === RoleEnum.ADMIN) ? PRAYER_REQUEST_FIELDS_ADMIN : EDIT_PRAYER_REQUEST_FIELDS;

    const currentPrayerRequest:PRAYER_REQUEST = await DB_SELECT_PRAYER_REQUEST_DETAIL(request.prayerRequestID, true);

    const editPrayerRequest:PRAYER_REQUEST|Exception = await PRAYER_REQUEST.constructAndEvaluateByJson({currentModel: currentPrayerRequest, jsonObj:request.body, fieldList: FIELD_LIST});

    if(currentPrayerRequest.isValid && !(editPrayerRequest instanceof Exception) && editPrayerRequest.isValid) {  //undefined handles next(Exception)
        
        if((PRAYER_REQUEST.getUniqueDatabaseProperties(editPrayerRequest, currentPrayerRequest).size > 0 )
                && await DB_UPDATE_PRAYER_REQUEST(request.prayerRequestID, PRAYER_REQUEST.getUniqueDatabaseProperties(editPrayerRequest, currentPrayerRequest)) === false) 
            next(new Exception(500, `Edit Prayer Request Failed :: Failed to update prayer request ${request.prayerRequestID}.`, 'Save Failed'));

        else { //Handle changes in user recipient lists
            const userRecipientCurrentList:number[] = currentPrayerRequest.userRecipientList.map((profile) => profile.userID);
            const userRecipientToDeleteList:number[] = editPrayerRequest.removeUserRecipientIDList?.filter((id) => userRecipientCurrentList.includes(id)) || [];
            const userRecipientToInsertList:number[] = editPrayerRequest.addUserRecipientIDList?.filter((id) => !userRecipientCurrentList.includes(id) && !userRecipientToDeleteList.includes(id)) || [];
            //Handle changes in circle recipient lists
            const circleRecipientCurrentList:number[] = currentPrayerRequest.circleRecipientList.map((circle) => circle.circleID);
            const circleRecipientToDeleteList:number[] = editPrayerRequest.removeCircleRecipientIDList?.filter((id) => circleRecipientCurrentList.includes(id)) || [];
            const circleRecipientToInsertList:number[] = editPrayerRequest.addCircleRecipientIDList?.filter((id) => !circleRecipientCurrentList.includes(id) && !circleRecipientToDeleteList.includes(id)) || [];
                
            if((userRecipientToDeleteList.length > 0 || circleRecipientToDeleteList.length > 0) 
                && await DB_DELETE_RECIPIENT_PRAYER_REQUEST_BATCH({prayerRequestID: request.prayerRequestID, userRecipientIDList: userRecipientToDeleteList, circleRecipientIDList: circleRecipientToDeleteList}) === false)
                next(new Exception(500, 'Edit Prayer Request Failed :: Failed to delete batch remove recipients.', 'Remove Recipients Failed'));

            else if((userRecipientToInsertList.length > 0 || circleRecipientToInsertList.length > 0) 
                && await DB_INSERT_RECIPIENT_PRAYER_REQUEST_BATCH({prayerRequestID: request.prayerRequestID, userRecipientIDList: userRecipientToInsertList, circleRecipientIDList: circleRecipientToInsertList}) === false)
                next(new Exception(500, 'Edit Prayer Request Failed :: Failed to insert batch add recipients.', 'Add Recipients Failed'));

            else {
                editPrayerRequest.userRecipientList = await DB_SELECT_USER_RECIPIENT_PRAYER_REQUEST_LIST(request.prayerRequestID);
                editPrayerRequest.circleRecipientList = await DB_SELECT_CIRCLE_RECIPIENT_PRAYER_REQUEST_LIST(request.prayerRequestID);
                editPrayerRequest.commentList = currentPrayerRequest.commentList;

                // send notifications asynchronously
                for (const circleID of (editPrayerRequest.addCircleRecipientIDList || [])) {
                    const userIDs = await DB_SELECT_CIRCLE_USER_IDS(circleID, undefined, false);
                    sendNotificationCircle(editPrayerRequest.requestorID, userIDs, circleID, CircleNotificationType.PRAYER_REQUEST_RECIPIENT, currentPrayerRequest.requestorProfile.displayName);
                }
                if (editPrayerRequest.addUserRecipientIDList !== undefined && editPrayerRequest.addUserRecipientIDList.length > 0) sendNotification(editPrayerRequest.requestorID, editPrayerRequest.addUserRecipientIDList, NotificationType.PRAYER_REQUEST_RECIPIENT, currentPrayerRequest.requestorProfile.displayName);

                response.status(202).send(editPrayerRequest.toJSON());
                log.event('Edit Prayer Request successfully saved:', editPrayerRequest.prayerRequestID);
            }
        }
    } else //Necessary; otherwise no response waits for timeout | Ignored if next() already replied
        next((editPrayerRequest instanceof Exception) ? editPrayerRequest
            : new Exception(500, `PATCH_prayerRequest - prayer request ${request.prayerRequestID} failed to parse from database and is invalid.`, 'Invalid Prayer Request'));
};


export const POST_prayerRequestIncrementPrayerCount = async (request: JwtPrayerRequest, response: Response, next: NextFunction) => {
    
    if(await DB_UPDATE_INCREMENT_PRAYER_COUNT(request.prayerRequestID) === false)
        next(new Exception(500, `Failed to Incremented Prayer Count for prayer request ${request.prayerRequestID}`, 'Failed to Save'));

    else {
        response.status(200).send(`Prayer Count Incremented for prayer request ${request.prayerRequestID}`);
        log.event(`Incremented prayer count for prayer request ${request.prayerRequestID}`);
    }
};


export const POST_prayerRequestResolved = async (request: JwtPrayerRequest, response: Response, next: NextFunction) => {
    
    if(await DB_UPDATE_RESOLVE_PRAYER_REQUEST(request.prayerRequestID) === false)
        next(new Exception(500, `Failed to Resolve Prayer Request ${request.prayerRequestID}`));
        
    //Clear Recipient List; but keep comments
    else if(await DB_DELETE_RECIPIENT_PRAYER_REQUEST({prayerRequestID: request.prayerRequestID}) === false)
        next(new Exception(500, `Failed to Delete Recipients for prayer request ${request.prayerRequestID}`, 'Failed to clear recipients'));

    else {
        response.status(200).send(`Prayer Request ${request.prayerRequestID} resolved.`);
        log.event(`Resolved prayer request ${request.prayerRequestID}`);
    }
};

export const DELETE_prayerRequest = async (request: JwtPrayerRequest, response: Response, next: NextFunction) => {
    //Authorization handled in: authenticatePrayerRequestRequestorMiddleware
    log.event(`User ${request.jwtUserID} is deleting prayer request ${request.prayerRequestID}`);

    if(await DB_DELETE_RECIPIENT_PRAYER_REQUEST({prayerRequestID: request.prayerRequestID}) === false)
        next(new Exception(500, `Delete Prayer Request | Failed to Delete Recipients for prayer request ${request.prayerRequestID}`, 'Linked recipients exist'));
    
    else if(await DB_DELETE_PRAYER_REQUEST_COMMENT({prayerRequestID: request.prayerRequestID}) === false)
        next(new Exception(500, `Delete Prayer Request | Failed to Delete Comments for prayer request ${request.prayerRequestID}`, 'Linked comments exist'));
    
    else if(await DB_DELETE_PRAYER_REQUEST(request.prayerRequestID) === false)
        next(new Exception(500, `Delete Prayer Request | Failed to Delete prayer request ${request.prayerRequestID}`, 'Failed to delete'));

    else
        response.status(200).send('Prayer Request has been deleted.');
};



/**********************************
 *  COMMENT PRAYER REQUEST ROUTES
 **********************************/
//No Model: Prayer Request Comment is parsed here
export const POST_prayerRequestComment = async (request: PrayerRequestCommentRequest, response: Response, next: NextFunction) => {
    const validationRegex:RegExp = PRAYER_REQUEST_COMMENT_FIELDS.find((input) => input.field === 'message')?.validationRegex || new RegExp(/.{1,200}/);
    const message:string = request.body.message;
    
    if((message !== undefined) && new RegExp(validationRegex).test(message)
        &&  await DB_INSERT_PRAYER_REQUEST_COMMENT({prayerRequestID: request.prayerRequestID, commenterID: request.jwtUserID, message: message}))

        response.status(200).send(
            await DB_SELECT_PRAYER_REQUEST_COMMENT({prayerRequestID: request.prayerRequestID, commenterID: request.jwtUserID, message})); //Returns undefined in error
    else {
        next(new Exception(500, `Comment failed validation for prayer request ${request.prayerRequestID}`, 'Failed Validation'));
    }
};


export const POST_prayerRequestCommentIncrementLikeCount = async (request: JwtPrayerRequest, response: Response, next: NextFunction) => {
    
    if(request.params.comment === undefined || isNaN(parseInt(request.params.comment))) 
        next(new Exception(400, `Failed to parse commentID :: missing comment-id parameter :: ${request.params.comment}`, 'Missing Prayer Request'));

    else if(await DB_UPDATE_INCREMENT_PRAYER_REQUEST_COMMENT_LIKE_COUNT(parseInt(request.params.comment)) === false)
        next(new Exception(500, `Failed to Incremented Like Count for prayer request ${request.prayerRequestID} in comment ${request.params.comment}`, 'Failed to Save'));

    else {
        response.status(200).send(`Like Count Incremented for prayer request ${request.prayerRequestID} in comment ${request.params.comment}`);
        log.event(`Incremented like count for comment ${request.params.comment} of prayer request ${request.prayerRequestID}`);
    }
};

export const DELETE_prayerRequestComment = async (request: JwtPrayerRequest, response: Response, next: NextFunction) => {
    
    if(request.params.comment === undefined || isNaN(parseInt(request.params.comment))) 
        next(new Exception(400, `Failed to parse commentID :: missing comment-id parameter :: ${request.params.comment}`, 'Missing Prayer Request'));

    else if(await DB_DELETE_PRAYER_REQUEST_COMMENT({prayerRequestID: request.prayerRequestID, commentID: parseInt(request.params.comment)}) === false)
        next(new Exception(500, `Failed to Delete comment for prayer request ${request.prayerRequestID} in comment ${request.params.comment}`, 'Failed to Delete'));

    else {
        response.status(200).send(`Comment ${request.params.comment} deleted for prayer request ${request.prayerRequestID}.`);
        log.event(`Deleted comment ${request.params.comment} of prayer request ${request.prayerRequestID}`);
    }
};

