import { CircleListItem } from '../../../0-assets/field-sync/api-type-sync/circle-types.mjs';
import { PrayerRequestCommentListItem, PrayerRequestListItem } from '../../../0-assets/field-sync/api-type-sync/prayer-request-types.mjs';
import { ProfileListItem } from '../../../0-assets/field-sync/api-type-sync/profile-types.mjs';
import PRAYER_REQUEST, { prayerRequestParseTags } from '../../1-models/prayerRequestModel.mjs';
import * as log from '../../log.mjs';
import { CommandResponseType, DATABASE_PRAYER_REQUEST, PRAYER_REQUEST_TABLE_COLUMNS, PRAYER_REQUEST_TABLE_COLUMNS_REQUIRED } from '../database-types.mjs';
import { batch, command, execute, query, validateColumns } from '../database.mjs';


/*****************************************************************************
/*    DEFINING AND HANDLING ALL QUERIES HERE 
/* TABLES: prayer_request, prayer_request_recipient, prayer_request_comment
******************************************************************************/

/* Prevent SQL Injection Protocol:
* 1) Use Prepared Statements, auto escape input strings
* 2) Validate Column Names
* - Use execute() for Prepared Statements (inputs)
* - Use query() for predefined Select Statements (static)
* - Use command() for database operation (inputs)
*/

/* REQUIRED VALIDATION ONLY WHEN COLUMNS ARE INPUTS */
const validatePrayerRequestColumns = (inputMap:Map<string, any>, includesRequired:boolean = false):boolean => 
    validateColumns(inputMap, includesRequired, PRAYER_REQUEST_TABLE_COLUMNS, PRAYER_REQUEST_TABLE_COLUMNS_REQUIRED);


/***************************
 *  PRAYER REQUEST QUERIES
 ***************************/

export const DB_SELECT_PRAYER_REQUEST = async(prayerRequestID:number):Promise<PRAYER_REQUEST> => {
    const rows = await execute(`SELECT * FROM prayer_request WHERE prayerRequestID = ?`, [prayerRequestID]); 

    if(rows.length !== 1) {
        log.error(`DB ${rows.length ? 'MULTIPLE' : 'NONE'} PRAYER REQUESTS IDENTIFIED`, prayerRequestID, JSON.stringify(rows));
        return new PRAYER_REQUEST(undefined);
    }
    
    return new PRAYER_REQUEST(rows[0] as DATABASE_PRAYER_REQUEST); 
}

//Includes: prayer_request, requestorProfile, commentList, userRecipientList, circleRecipientList
export const DB_SELECT_PRAYER_REQUEST_DETAIL = async(prayerRequestID:number, includeRecipientList:boolean = false):Promise<PRAYER_REQUEST> => {
    const rows = await execute('SELECT prayer_request.*, '
    + 'user.firstName as requestorFirstName, user.displayName as requestorDisplayName, user.image as requestorImage '
    + 'FROM prayer_request '
    + 'LEFT JOIN user ON user.userID = prayer_request.requestorID '
    + 'WHERE prayer_request.prayerRequestID = ?;', [prayerRequestID]); 

    if(rows.length !== 1) {
        log.error(`DB ${rows.length ? 'MULTIPLE' : 'NONE'} PRAYER REQUESTS  IDENTIFIED BY ID`, prayerRequestID, JSON.stringify(rows));
        return new PRAYER_REQUEST(undefined);
    }
    
    const prayerRequest = new PRAYER_REQUEST(rows[0] as DATABASE_PRAYER_REQUEST); 
    prayerRequest.requestorProfile = {userID: rows[0].requestorID, firstName: rows[0].requestorFirstName, displayName: rows[0].requestorDisplayName, image: rows[0].requestorImage};
    prayerRequest.commentList = await DB_SELECT_PRAYER_REQUEST_COMMENT_LIST(prayerRequestID);

    if(includeRecipientList) {
        prayerRequest.userRecipientList = await DB_SELECT_USER_RECIPIENT_PRAYER_REQUEST_LIST(prayerRequestID);
        prayerRequest.circleRecipientList = await DB_SELECT_CIRCLE_RECIPIENT_PRAYER_REQUEST_LIST(prayerRequestID);
    }  

    return prayerRequest;
}

export const DB_IS_PRAYER_REQUEST_REQUESTOR = async({prayerRequestID, userID}:{prayerRequestID:number, userID:number}):Promise<boolean> => {
    const rows = await execute('SELECT prayerRequestID ' + 'FROM prayer_request '
        + 'WHERE prayerRequestID = ? AND requestorID = ?;', [prayerRequestID, userID]);

    return (rows.length === 1);
}

export const DB_INSERT_PRAYER_REQUEST = async(fieldMap:Map<string, any>):Promise<boolean> => {
    //Validate Columns prior to Query
    if(!validatePrayerRequestColumns(fieldMap)) {
        log.db('Query Rejected: DB_INSERT_PRAYER_REQUEST; invalid column names', JSON.stringify(Array.from(fieldMap.keys())));
        return false;
    }

    const preparedColumns:string = Array.from(fieldMap.keys()).map((key)=> `${key}`).join(', ');
    const preparedValues:string = Array.from(fieldMap.keys()).map((key)=> `?`).join(', ');

    const response:CommandResponseType = await command(`INSERT INTO prayer_request ( ${preparedColumns} ) VALUES ( ${preparedValues} );`, Array.from(fieldMap.values())); 
    
    return ((response !== undefined) && (response.affectedRows === 1));
}

//Dual operation for POST_prayerRequest; b/c can't add recipients without prayerRequestID
export const DB_INSERT_AND_SELECT_PRAYER_REQUEST = async(fieldMap:Map<string, any>):Promise<PRAYER_REQUEST> => {
    //First: Insert New prayer_request model
    if(await DB_INSERT_PRAYER_REQUEST(fieldMap) === false)
        return new PRAYER_REQUEST(undefined);

    //Second: Select newly inserted prayer_request model
    const preparedSelectColumns:string = Array.from(fieldMap.keys()).map((key)=> `${key} = ?`).join(' AND ');

    const rows = await execute('SELECT prayer_request.*, ' 
    + 'user.firstName as requestorFirstName, user.displayName as requestorDisplayName, user.image as requestorImage '
    + 'FROM prayer_request '
    + 'LEFT JOIN user ON user.userID = prayer_request.requestorID '
    +`WHERE prayer_request.requestorID = ? ORDER BY createdDT DESC LIMIT 1;`, [fieldMap.get('requestorID')]); 

    if(rows.length !== 1) {
        log.db(`DB_INSERT_AND_SELECT_PRAYER_REQUEST : Failed to identify recently created prayer request`, JSON.stringify(fieldMap.entries()), JSON.stringify(rows));
        return new PRAYER_REQUEST(undefined);
    }

    const prayerRequest = new PRAYER_REQUEST(rows[0] as DATABASE_PRAYER_REQUEST); 
    prayerRequest.requestorProfile = {userID: rows[0].requestorID, firstName: rows[0].requestorFirstName, displayName: rows[0].requestorDisplayName, image: rows[0].requestorImage};
    return prayerRequest; 
}

export const DB_UPDATE_PRAYER_REQUEST = async(prayerRequestID:number, fieldMap:Map<string, any>):Promise<boolean> => {
    //Validate Columns prior to Query
    if(!validatePrayerRequestColumns(fieldMap)) {
        log.db('Query Rejected: DB_UPDATE_PRAYER_REQUEST; invalid column names', JSON.stringify(Array.from(fieldMap.keys())));
        return false;
    }

    const preparedColumns:string = Array.from(fieldMap.keys()).map((key, field)=> `${key} = ?`).join(', ');

    const response:CommandResponseType = await command(`UPDATE prayer_request SET ${preparedColumns} WHERE prayerRequestID = ?;`, [...Array.from(fieldMap.values()), prayerRequestID]); 

    return ((response !== undefined) && (response.affectedRows === 1));
}

export const DB_UPDATE_INCREMENT_PRAYER_COUNT = async(prayerRequestID:number):Promise<boolean> => {

    const response:CommandResponseType = await command(`UPDATE prayer_request SET prayerCount = (prayerCount + 1) WHERE prayerRequestID = ?;`, [prayerRequestID]); 

    return ((response !== undefined) && (response.affectedRows === 1));
}

export const DB_UPDATE_RESOLVE_PRAYER_REQUEST = async(prayerRequestID:number):Promise<boolean> => {

    const response:CommandResponseType = await command(`UPDATE prayer_request SET isResolved = true WHERE prayerRequestID = ?;`, [prayerRequestID]); 

    return ((response !== undefined) && (response.affectedRows === 1));
}

export const DB_DELETE_PRAYER_REQUEST = async(prayerRequestID:number):Promise<boolean> => { //Note: Database Reinforces Key constrains

    const response:CommandResponseType = await command('DELETE FROM prayer_request WHERE prayerRequestID = ?;', [prayerRequestID]);

    return ((response !== undefined) && (response.affectedRows === 1));
}

//Clear all prayer request records for user; used when completely deleting user from system
export const DB_DELETE_ALL_USER_PRAYER_REQUEST = async(userID:number):Promise<boolean> => {
    log.db(`DB_DELETE_ALL_USER_PRAYER_REQUEST | Attempting to delete all prayer request records for userID: ${userID}`);

    if(await command('DELETE FROM prayer_request_recipient WHERE userID = ? ;', [userID]) === undefined) {
        log.db(`DB_DELETE_ALL_USER_PRAYER_REQUEST | Failed to delete prayer_request_recipients for userID: ${userID}`);
        return false;

    } else if(await command('DELETE FROM prayer_request_comment WHERE commenter = ? ;', [userID]) === undefined) {
        log.db(`DB_DELETE_ALL_USER_PRAYER_REQUEST | Failed to delete comments for userID: ${userID}`);
        return false;

    } else if(await command('DELETE FROM prayer_request WHERE requestorID = ?;', [userID]) === undefined) {
        log.db(`DB_DELETE_ALL_USER_PRAYER_REQUEST | Failed to delete prayer_requests for userID: ${userID}`);
        return false;

    } else
        return true;
}


/******************************************
 *  PRAYER REQUEST LIST QUERIES
 ******************************************/

//List for user including circle members, and leader; of all prayer requests where they are the intended recipient
export const DB_SELECT_PRAYER_REQUEST_USER_LIST = async(userID:number):Promise<PrayerRequestListItem[]> => {
    const rows = await execute('SELECT DISTINCT prayer_request.prayerRequestID, topic, prayerCount, tagsStringified, requestorID, '
    + 'user.firstName as requestorFirstName, user.displayName as requestorDisplayName, user.image as requestorImage '
    + 'FROM prayer_request '
    + 'LEFT JOIN prayer_request_recipient ON prayer_request_recipient.prayerRequestID = prayer_request.prayerRequestID '
    + 'LEFT JOIN user ON user.userID = prayer_request.requestorID '
    + 'LEFT JOIN circle_user ON circle_user.circleID = prayer_request_recipient.circleID '
    + 'LEFT JOIN circle ON circle.circleID = prayer_request_recipient.circleID '
    + 'WHERE prayer_request_recipient.userID = ? OR circle_user.userID = ? OR circle.leaderID = ? '
    + 'ORDER BY prayer_request.modifiedDT ASC LIMIT 30;', [userID, userID, userID]); 
 
    return [...rows.map(row => ({prayerRequestID: row.prayerRequestID || -1, topic: row.topic || '', prayerCount: row.prayerCount || 0, tagList: prayerRequestParseTags(row.tagsStringified),
            requestorProfile: {userID: row.requestorID, firstName: row.requestorFirstName, displayName: row.requestorDisplayName, image: row.requestorImage}}))];
}

//List for circle of all prayer requests where they are the intended recipient
export const DB_SELECT_PRAYER_REQUEST_CIRCLE_LIST = async(circleID:number):Promise<PrayerRequestListItem[]> => {
    const rows = await execute('SELECT DISTINCT prayer_request.prayerRequestID, topic, prayerCount, tagsStringified, requestorID, '
    + 'user.firstName as requestorFirstName, user.displayName as requestorDisplayName, user.image as requestorImage '
    + 'FROM prayer_request '
    + 'LEFT JOIN prayer_request_recipient ON prayer_request_recipient.prayerRequestID = prayer_request.prayerRequestID '
    + 'LEFT JOIN user ON user.userID = prayer_request.requestorID '
    + 'WHERE prayer_request_recipient.circleID = ? '
    + 'ORDER BY prayer_request.modifiedDT ASC LIMIT 30;', [circleID]); 
 
    return [...rows.map(row => ({prayerRequestID: row.prayerRequestID || -1, topic: row.topic || '', prayerCount: row.prayerCount || 0, tagList: prayerRequestParseTags(row.tagsStringified),
            requestorProfile: {userID: row.requestorID, firstName: row.requestorFirstName, displayName: row.requestorDisplayName, image: row.requestorImage}}))];
}

//List of all prayer request created by user | optional filters: isResolved
export const DB_SELECT_PRAYER_REQUEST_REQUESTOR_LIST = async(userID:number, isResolved?:boolean):Promise<PrayerRequestListItem[]> => {
    const rows = (isResolved !== undefined)
        ? await execute('SELECT prayer_request.prayerRequestID, topic, prayerCount, tagsStringified, requestorID, '
            + 'user.firstName as requestorFirstName, user.displayName as requestorDisplayName, user.image as requestorImage '
            + 'FROM prayer_request '
            + 'LEFT JOIN user ON user.userID = prayer_request.requestorID '
            + 'WHERE requestorID = ? AND isResolved = ? '
            + 'ORDER BY prayer_request.modifiedDT ASC LIMIT 30;', [userID, isResolved])
        
        : await execute('SELECT prayer_request.prayerRequestID, topic, prayerCount, tagsStringified, requestorID, '
            + 'user.firstName as requestorFirstName, user.displayName as requestorDisplayName, user.image as requestorImage '
            + 'FROM prayer_request '
            + 'LEFT JOIN user ON user.userID = prayer_request.requestorID '
            + 'WHERE requestorID = ? '
            + 'ORDER BY prayer_request.modifiedDT ASC LIMIT 30;', [userID]); 
 
    return [...rows.map(row => ({prayerRequestID: row.prayerRequestID || -1, topic: row.topic || '', prayerCount: row.prayerCount || 0, tagList: prayerRequestParseTags(row.tagsStringified),
            requestorProfile: {userID: row.requestorID, firstName: row.requestorFirstName, displayName: row.requestorDisplayName, image: row.requestorImage}}))];
}


/*************************************
 *  PRAYER REQUEST RECIPIENT QUERIES
 *************************************/

export const DB_SELECT_USER_RECIPIENT_PRAYER_REQUEST_LIST = async(prayerRequestID:number):Promise<ProfileListItem[]> => {
    const rows = await execute('SELECT user.userID, user.firstName, user.displayName, user.image '
    + 'FROM prayer_request_recipient '
    + 'LEFT JOIN user ON user.userID = prayer_request_recipient.userID  '
    + 'WHERE prayerRequestID = ? AND circleID IS NULL;', [prayerRequestID]); 
 
    return [...rows.map(row => ({userID: row.userID, firstName: row.firstName, displayName: row.displayName, image: row.image}))];
}

export const DB_SELECT_CIRCLE_RECIPIENT_PRAYER_REQUEST_LIST = async(prayerRequestID:number):Promise<CircleListItem[]> => {
    const rows = await execute('SELECT circle.circleID, circle.name, circle.image '
    + 'FROM prayer_request_recipient '
    + 'LEFT JOIN circle ON circle.circleID = prayer_request_recipient.circleID  '
    + 'WHERE prayerRequestID = ? AND userID IS NULL;', [prayerRequestID]); 
 
    return [...rows.map(row => ({circleID: row.circleID, name: row.name, image: row.image}))];
}

//Searches for userID match among: requestor, specified recipient, member or leader of circle which is an intended recipient
export const DB_IS_RECIPIENT_PRAYER_REQUEST = async({prayerRequestID, userID}:{prayerRequestID:number, userID:number}):Promise<boolean> => {
    const rows = await execute('SELECT prayer_request.prayerRequestID ' //search specified recipient
    + 'FROM prayer_request '
    + 'LEFT JOIN prayer_request_recipient ON prayer_request_recipient.prayerRequestID = prayer_request.prayerRequestID '
    + 'LEFT JOIN circle_user ON circle_user.circleID = prayer_request_recipient.circleID '
    + 'LEFT JOIN circle ON circle.circleID = prayer_request_recipient.circleID '
    + 'WHERE prayer_request.prayerRequestID = ? AND ( prayer_request.requestorID = ? OR prayer_request_recipient.userID = ? OR circle_user.userID = ? OR circle.leaderID = ? );',
    [ prayerRequestID, userID, userID, userID, userID ]);

    return (rows.length > 0);
}

//Insert recipient individually
export const DB_INSERT_USER_RECIPIENT_PRAYER_REQUEST = async({prayerRequestID, userID}:{prayerRequestID:number, userID:number}):Promise<boolean> => {
    const response:CommandResponseType = await command(`INSERT INTO prayer_request_recipient ( prayerRequestID, userID ) VALUES ( ?, ? );`, [prayerRequestID, userID]);

    return ((response !== undefined) && (response.affectedRows === 1));
}

//Batch Insert multiple recipients at once
export const DB_INSERT_USER_RECIPIENT_PRAYER_REQUEST_BATCH = async({prayerRequestID, userRecipientIDList=[]}:{prayerRequestID:number, userRecipientIDList:number[]}):Promise<boolean> => {
    const batchList = userRecipientIDList.map((userID:number) => ([prayerRequestID, userID]));

    const response:boolean|undefined = await batch(`INSERT INTO prayer_request_recipient ( prayerRequestID, userID ) VALUES ? ;`, batchList);

    return (response === true);
}

//Insert recipient individually
export const DB_INSERT_CIRCLE_RECIPIENT_PRAYER_REQUEST = async({prayerRequestID, circleID}:{prayerRequestID:number, circleID:number}):Promise<boolean> => {
    const response:CommandResponseType = await command(`INSERT INTO prayer_request_recipient ( prayerRequestID, circleID ) VALUES ( ?, ? );`, [prayerRequestID, circleID]);

    return ((response !== undefined) && (response.affectedRows === 1));
}

export const DB_INSERT_CIRCLE_RECIPIENT_PRAYER_REQUEST_BATCH = async({prayerRequestID, circleRecipientIDList=[]}:{prayerRequestID:number, circleRecipientIDList:number[]}):Promise<boolean> => {
    const batchList = circleRecipientIDList.map((circleID:number) => ([prayerRequestID, circleID]));

    const response:boolean|undefined = await batch(`INSERT INTO prayer_request_recipient ( prayerRequestID, circleID ) VALUES ? ;`, batchList);

    return (response === true);
}

export const DB_INSERT_RECIPIENT_PRAYER_REQUEST_BATCH = async({prayerRequestID, userRecipientIDList=[], circleRecipientIDList=[]}:{prayerRequestID:number, userRecipientIDList:number[], circleRecipientIDList:number[]}):Promise<boolean> => {
    const batchList = [];
    
    if(userRecipientIDList.length > 0) {
        batchList.push(...userRecipientIDList.map((userID:number) => ([prayerRequestID, userID, null])));
    }

    if(circleRecipientIDList.length > 0) {
        batchList.push(...circleRecipientIDList.map((circleID:number) => ([prayerRequestID, null, circleID])));
    }

    const response:boolean|undefined = await batch(`INSERT INTO prayer_request_recipient ( prayerRequestID, userID, circleID ) VALUES ? ;`, batchList);

    return (response === true);
}

//Delete recipient individually, all connections by recipientID, or all connections by prayerRequestID
export const DB_DELETE_RECIPIENT_PRAYER_REQUEST = async({prayerRequestID, userID, circleID}:{prayerRequestID?:number, userID?:number, circleID?:number}):Promise<boolean> => {

    const response:CommandResponseType = (prayerRequestID === undefined && userID !== undefined)
        ? await command(`DELETE FROM prayer_request_recipient WHERE userID = ? ;`, [userID])
        
        : (prayerRequestID === undefined && circleID !== undefined)
        ? await command('DELETE FROM prayer_request_recipient WHERE circleID = ? ;', [circleID])

        : (prayerRequestID !== undefined && userID !== undefined && circleID !== undefined)
        ? await command(`DELETE FROM prayer_request_recipient WHERE prayerRequestID = ? AND ( userID = ? OR circleID = ? );`, [prayerRequestID, userID || -1, circleID || -1])

        : await command('DELETE FROM prayer_request_recipient WHERE prayerRequestID = ? ;', [prayerRequestID]);

    return (response !== undefined);
}

//Batch Delete multiple recipients at once
export const DB_DELETE_RECIPIENT_PRAYER_REQUEST_BATCH = async({prayerRequestID, userRecipientIDList=[], circleRecipientIDList=[]}:{prayerRequestID:number, userRecipientIDList:number[], circleRecipientIDList:number[]}):Promise<boolean> => {

    const response:CommandResponseType = await command('DELETE FROM prayer_request_recipient WHERE prayerRequestID = ? AND '
                                                    + `( ${[...userRecipientIDList.map((id) => 'userID = ?'), ...circleRecipientIDList.map((id) => 'circleID = ?')].join(' OR ')} );`,
                                                    [prayerRequestID, ...userRecipientIDList, ...circleRecipientIDList]);

    return ((response !== undefined) && (response.affectedRows > 0));
}


/*************************************
 *  PRAYER REQUEST COMMENT QUERIES
 *************************************/
export const DB_SELECT_PRAYER_REQUEST_COMMENT_LIST = async(prayerRequestID:number):Promise<PrayerRequestCommentListItem[]> => {
    const rows = await execute('SELECT prayer_request_comment.*, '
    + 'user.firstName as commenterFirstName, user.displayName as commenterDisplayName, user.image as commenterImage '
    + 'FROM prayer_request_comment '
    + 'LEFT JOIN user ON user.userID = prayer_request_comment.commenterID '
    + 'WHERE prayerRequestID = ? '
    + 'ORDER BY createdDT ASC;', [prayerRequestID]); 
 
    return [...rows.map(row => ({commentID: row.commentID || -1, prayerRequestID: row.prayerRequestID || -1, message: row.message || '', likeCount: row.likeCount || 0,
            commenterProfile: {userID: row.commenterID, firstName: row.commenterFirstName, displayName: row.commenterDisplayName, image: row.commenterImage}}))];
}

export const DB_INSERT_PRAYER_REQUEST_COMMENT = async({prayerRequestID, commenterID, message}:{prayerRequestID:number, commenterID:number, message:string}):Promise<boolean> => {
    const response:CommandResponseType = await command(`INSERT INTO prayer_request_comment ( prayerRequestID, commenterID, message ) VALUES ( ?, ?, ? );`, [prayerRequestID, commenterID, message]);

    return ((response !== undefined) && (response.affectedRows === 1));
}

export const DB_UPDATE_INCREMENT_PRAYER_REQUEST_COMMENT_LIKE_COUNT = async(commentID:number):Promise<boolean> => {

    const response:CommandResponseType = await command(`UPDATE prayer_request_comment SET likeCount = (likeCount + 1) WHERE commentID = ?;`, [commentID]); 

    return ((response !== undefined) && (response.affectedRows === 1));
}

//Delete comment individually or all connections by prayerRequestID
export const DB_DELETE_PRAYER_REQUEST_COMMENT = async({commentID, prayerRequestID}:{commentID?:number, prayerRequestID:number}):Promise<boolean> => {

    const response:CommandResponseType = (commentID !== undefined) ?
     await command('DELETE FROM prayer_request_comment WHERE commentID = ? ;', [commentID])
     : await command('DELETE FROM prayer_request_comment WHERE prayerRequestID = ? ;', [prayerRequestID]);

    return (response !== undefined);
}