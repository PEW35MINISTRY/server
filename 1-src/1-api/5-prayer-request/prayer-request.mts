import express, { NextFunction, Request, Response, Router } from 'express';
import InputField from '../../0-assets/field-sync/input-config-sync/inputField.mjs';
import { CREATE_PRAYER_REQUEST_FIELDS, DEFAULT_PRAYER_REQUEST_EXPIRATION_DAYS, EDIT_PRAYER_REQUEST_FIELDS, getDateDaysFuture, PRAYER_REQUEST_COMMENT_FIELDS, PRAYER_REQUEST_FIELDS_ADMIN } from '../../0-assets/field-sync/input-config-sync/prayer-request-field-config.mjs';
import { RoleEnum } from '../../0-assets/field-sync/input-config-sync/profile-field-config.mjs';
import PRAYER_REQUEST from '../../2-services/1-models/prayerRequestModel.mjs';
import { PRAYER_REQUEST_TABLE_COLUMNS_REQUIRED } from '../../2-services/2-database/database-types.mjs';
import { DB_DELETE_PRAYER_REQUEST, DB_DELETE_PRAYER_REQUEST_COMMENT, DB_DELETE_PRAYER_REQUEST_COMMENT_LIKE, DB_DELETE_RECIPIENT_PRAYER_REQUEST, DB_DELETE_RECIPIENT_PRAYER_REQUEST_BATCH, DB_INSERT_PRAYER_REQUEST, DB_INSERT_PRAYER_REQUEST_COMMENT, DB_INSERT_RECIPIENT_PRAYER_REQUEST_BATCH, DB_SELECT_CIRCLE_RECIPIENT_PRAYER_REQUEST_LIST, DB_SELECT_PRAYER_REQUEST_CIRCLE_LIST, DB_SELECT_PRAYER_REQUEST_COMMENT, DB_SELECT_PRAYER_REQUEST_DETAIL, DB_SELECT_PRAYER_REQUEST_REQUESTOR_LIST, DB_SELECT_PRAYER_REQUEST_USER_LIST, DB_SELECT_USER_RECIPIENT_PRAYER_REQUEST_LIST, DB_UPDATE_INCREMENT_PRAYER_COUNT, DB_UPDATE_INCREMENT_PRAYER_REQUEST_COMMENT_LIKE_COUNT, DB_UPDATE_PRAYER_REQUEST, DB_UPDATE_RESOLVE_PRAYER_REQUEST } from '../../2-services/2-database/queries/prayer-request-queries.mjs';
import * as log from '../../2-services/10-utilities/logging/log.mjs';
import { JwtCircleRequest, JwtClientRequest, JwtPrayerRequest, JwtRequest } from '../2-auth/auth-types.mjs';
import { Exception } from '../api-types.mjs';
import { PrayerRequestCommentRequest, PrayerRequestPatchRequest, PrayerRequestPostRequest } from './prayer-request-types.mjs';
import { DB_SELECT_CIRCLE_USER_IDS } from '../../2-services/2-database/queries/circle-queries.mjs';
import { sendTemplateNotification, sendNotificationCircle} from '../8-notification/notification-utilities.mjs';
import { CircleNotificationType, NotificationType } from '../8-notification/notification-types.mjs';
import { PrayerRequestCommentListItem } from '../../0-assets/field-sync/api-type-sync/prayer-request-types.mjs';


/*************************************
 *  List PRAYER REQUEST ROUTES
 *************************************/
//Combined owned & recipient (partner or circle) shared
export const GET_PrayerRequestUserList = async (request: JwtRequest, response: Response) => {
    response.status(200).send(await DB_SELECT_PRAYER_REQUEST_USER_LIST(request.jwtUserID, true));
};

export const GET_PrayerRequestCircleList = async (request: JwtCircleRequest, response: Response) => {
    response.status(200).send(await DB_SELECT_PRAYER_REQUEST_CIRCLE_LIST(request.circleID, request.jwtUserID));
};

//List of prayer requests for which user is a recipient
export const GET_PrayerRequestRecipientList = async (request: JwtClientRequest, response: Response) => {
    const userID = request.clientID || request.jwtUserID; 
    response.status(200).send(await DB_SELECT_PRAYER_REQUEST_USER_LIST(userID, false));
};

//List of prayer requests for which the user or client is the requestor
export const GET_PrayerRequestRequestorList = async(request: JwtClientRequest, response: Response) => {
    const userID = request.clientID || request.jwtUserID; 
    response.status(200).send(await DB_SELECT_PRAYER_REQUEST_REQUESTOR_LIST(userID, false));
};

export const GET_PrayerRequestRequestorResolvedList = async(request: JwtClientRequest, response: Response) => {
    const userID = request.clientID || request.jwtUserID; 
    response.status(200).send(await DB_SELECT_PRAYER_REQUEST_REQUESTOR_LIST(userID, true));
};



/*************************************
 *  INDIVIDUAL PRAYER REQUEST ROUTES
 *************************************/
export const GET_PrayerRequest = async (request: JwtPrayerRequest, response: Response, next: NextFunction) => {

    const prayerRequest = await DB_SELECT_PRAYER_REQUEST_DETAIL(request.prayerRequestID, request.jwtUserID, true); //Includes user and circle recipient list

    if(prayerRequest.isValid) {
        response.status(200).send(prayerRequest.toJSON());

    } else 
        next(new Exception(404, `Prayer Request: ${request.prayerRequestID} unavailable from database.`, 'Prayer Request Not Found'));
};


//POST includes sharing to circle/partners/leaders recipients
export const POST_prayerRequest = async (request: PrayerRequestPostRequest, response: Response, next: NextFunction) => {
    const newPrayerRequest:PRAYER_REQUEST|Exception = await PRAYER_REQUEST.constructByJson({jsonObj:request.body, fieldList: CREATE_PRAYER_REQUEST_FIELDS});

    if(!(newPrayerRequest instanceof Exception)) {
        const requestorID:number = ((request.jwtUserRole === RoleEnum.ADMIN) && request.body['requestorID'] !== undefined) ? request.body['requestorID'] : request.jwtUserID;
        newPrayerRequest.requestorID = requestorID;

        //Default Expiration Date if not provided
        if(!newPrayerRequest.expirationDate || isNaN(new Date(newPrayerRequest.expirationDate)?.getTime()))
            newPrayerRequest.expirationDate = getDateDaysFuture(DEFAULT_PRAYER_REQUEST_EXPIRATION_DAYS);

        if(PRAYER_REQUEST_TABLE_COLUMNS_REQUIRED.every((column) => newPrayerRequest[column] !== undefined) === false) 
            next(new Exception(400, `Create Prayer Request Failed :: Missing Required Fields: ${JSON.stringify(PRAYER_REQUEST_TABLE_COLUMNS_REQUIRED)}.`, 'Missing Details'));

        else { 
                const insertResponse:{success:boolean, prayerRequestID:number} = await DB_INSERT_PRAYER_REQUEST(newPrayerRequest.getDatabaseProperties());
                newPrayerRequest.prayerRequestID = insertResponse.prayerRequestID;

                if(!insertResponse.success || insertResponse.prayerRequestID <= 0) 
                    next(new Exception(500, 'Create Prayer Request Failed :: Failed to save new prayer request to database.', 'Save Failed'));
                
                else if(await DB_INSERT_RECIPIENT_PRAYER_REQUEST_BATCH({prayerRequestID: newPrayerRequest.prayerRequestID, userRecipientIDList: newPrayerRequest.addUserRecipientIDList || [], circleRecipientIDList: newPrayerRequest.addCircleRecipientIDList || []}) === false)
                    next(new Exception(500, 'Create Prayer Request Failed :: Failed to save batch recipient list.', 'Send Failed'));
                
                else {
                    // send notifications asynchronously
                    for (const circleID of (newPrayerRequest.addCircleRecipientIDList || [])) {
                        const userIDs = await DB_SELECT_CIRCLE_USER_IDS(circleID, undefined, false);
                        sendNotificationCircle(requestorID, userIDs, circleID, CircleNotificationType.PRAYER_REQUEST_RECIPIENT);
                    }
                    if(newPrayerRequest.addUserRecipientIDList !== undefined && newPrayerRequest.addUserRecipientIDList.length > 0)
                        sendTemplateNotification(requestorID, newPrayerRequest.addUserRecipientIDList || [], NotificationType.PRAYER_REQUEST_RECIPIENT);

                    response.status(201).send((await DB_SELECT_PRAYER_REQUEST_DETAIL(newPrayerRequest.prayerRequestID, request.jwtUserID, true)).toJSON());
                }
        }
    } else
        next(newPrayerRequest);
};

export const PATCH_prayerRequest = async (request: PrayerRequestPatchRequest, response: Response, next: NextFunction) => {

    const FIELD_LIST:InputField[] = (request.jwtUserRole === RoleEnum.ADMIN) ? PRAYER_REQUEST_FIELDS_ADMIN : EDIT_PRAYER_REQUEST_FIELDS;

    const currentPrayerRequest:PRAYER_REQUEST = await DB_SELECT_PRAYER_REQUEST_DETAIL(request.prayerRequestID, request.jwtUserID, true);

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
                const savedPrayerRequest:PRAYER_REQUEST = await DB_SELECT_PRAYER_REQUEST_DETAIL(request.prayerRequestID, request.jwtUserID, true);

                // send notifications asynchronously
                for (const circleID of (editPrayerRequest.addCircleRecipientIDList || [])) {
                    const userIDs = await DB_SELECT_CIRCLE_USER_IDS(circleID, undefined, false);
                    sendNotificationCircle(editPrayerRequest.requestorID, userIDs, circleID, CircleNotificationType.PRAYER_REQUEST_RECIPIENT, currentPrayerRequest.requestorProfile.displayName);
                }
                if(editPrayerRequest.addUserRecipientIDList !== undefined && editPrayerRequest.addUserRecipientIDList.length > 0)
                    sendTemplateNotification(editPrayerRequest.requestorID, editPrayerRequest.addUserRecipientIDList, NotificationType.PRAYER_REQUEST_RECIPIENT, currentPrayerRequest.requestorProfile.displayName);

                response.status(202).send(savedPrayerRequest.toJSON());
            }
        }
    } else //Necessary; otherwise no response waits for timeout | Ignored if next() already replied
        next((editPrayerRequest instanceof Exception) ? editPrayerRequest
            : new Exception(500, `PATCH_prayerRequest - prayer request ${request.prayerRequestID} failed to parse from database and is invalid.`, 'Invalid Prayer Request'));
};


export const POST_prayerRequestIncrementPrayerCount = async (request: JwtPrayerRequest, response: Response, next: NextFunction) => {
    
    if(await DB_UPDATE_INCREMENT_PRAYER_COUNT(request.prayerRequestID, request.jwtUserID) === false)
        next(new Exception(500, `Failed to Incremented Prayer Count for prayer request ${request.prayerRequestID}`, 'Failed to Save'));

    else {
        response.status(200).send(`Prayer Count Incremented for prayer request ${request.prayerRequestID}`);
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
    
    if((message !== undefined) && new RegExp(validationRegex).test(message)) {
        const insertResponse:{success:boolean, commentID:number} = await DB_INSERT_PRAYER_REQUEST_COMMENT({prayerRequestID: request.prayerRequestID, commenterID: request.jwtUserID, message});

        if(insertResponse.success && insertResponse.commentID > 0) {
            const comment:PrayerRequestCommentListItem | undefined = await DB_SELECT_PRAYER_REQUEST_COMMENT(insertResponse.commentID, request.jwtUserID); 
            return response.status(200).send(comment);
        }
    }

    next(new Exception(500, `Comment failed validation for prayer request ${request.prayerRequestID}`, 'Failed Validation'));
};


export const POST_prayerRequestCommentIncrementLikeCount = async (request: JwtPrayerRequest, response: Response, next: NextFunction) => {
    
    if(request.params.comment === undefined || isNaN(parseInt(request.params.comment))) 
        next(new Exception(400, `Failed to parse commentID :: missing comment-id parameter :: ${request.params.comment}`, 'Missing Prayer Request'));

    else if(await DB_UPDATE_INCREMENT_PRAYER_REQUEST_COMMENT_LIKE_COUNT(parseInt(request.params.comment), request.jwtUserID) === false)
        next(new Exception(500, `Failed to Incremented Like Count for prayer request ${request.prayerRequestID} in comment ${request.params.comment}`, 'Failed to Save'));

    else {
        response.status(200).send(`Like Count Incremented for prayer request ${request.prayerRequestID} in comment ${request.params.comment}`);
    }
};

export const POST_prayerRequestCommentUnlike = async (request:JwtPrayerRequest, response:Response, next:NextFunction) => {
    
    if(request.params.comment === undefined || isNaN(parseInt(request.params.comment))) 
        next(new Exception(400, `Failed to parse commentID :: missing comment-id parameter :: ${request.params.comment}`, 'Missing Prayer Request'));

    else if(await DB_DELETE_PRAYER_REQUEST_COMMENT_LIKE(parseInt(request.params.comment), request.jwtUserID) === false)
        next(new Exception(500, `Failed to unlike Count for prayer request ${request.prayerRequestID} in comment ${request.params.comment}`, 'Failed to Save'));

    else {
        response.status(200).send(`Unliked prayer request ${request.prayerRequestID} in comment ${request.params.comment}`);
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

