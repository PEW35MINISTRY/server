import * as log from '../../10-utilities/logging/log.mjs';
import { batch, command, execute, validateColumns } from '../database.mjs';
import { CommandResponseType, DATABASE_CIRCLE_STATUS_ENUM, DATABASE_MODEL_SOURCE_ENVIRONMENT_ENUM, DATABASE_PRAYER_REQUEST, DATABASE_PRAYER_REQUEST_COMMENT, DATABASE_PRAYER_REQUEST_EXTENDED, PRAYER_REQUEST_TABLE_COLUMNS, PRAYER_REQUEST_TABLE_COLUMNS_EDIT, PRAYER_REQUEST_TABLE_COLUMNS_REQUIRED } from '../database-types.mjs';
import PRAYER_REQUEST from '../../1-models/prayerRequestModel.mjs';
import { CircleListItem } from '../../../0-assets/field-sync/api-type-sync/circle-types.mjs';
import { PrayerRequestCommentListItem, PrayerRequestListItem } from '../../../0-assets/field-sync/api-type-sync/prayer-request-types.mjs';
import { ProfileListItem } from '../../../0-assets/field-sync/api-type-sync/profile-types.mjs';
import { LIST_LIMIT } from '../../../0-assets/field-sync/input-config-sync/search-config.mjs';
import { getModelSourceEnvironment } from '../../10-utilities/utilities.mjs';
import { ExpiredPrayerRequest } from '../../../1-api/5-prayer-request/prayer-request-types.mjs';


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
const validatePrayerRequestColumns = (inputMap:Map<string, any>, forEditing:boolean, includesRequired:boolean):boolean =>
    validateColumns(inputMap, includesRequired, forEditing ? PRAYER_REQUEST_TABLE_COLUMNS_EDIT : PRAYER_REQUEST_TABLE_COLUMNS, PRAYER_REQUEST_TABLE_COLUMNS_REQUIRED);


/***************************
 *  PRAYER REQUEST QUERIES
 ***************************/

export const DB_SELECT_PRAYER_REQUEST = async(prayerRequestID:number):Promise<PRAYER_REQUEST> => {
    const rows = await execute(`SELECT * FROM prayer_request WHERE prayerRequestID = ?`, [prayerRequestID]); 

    if(rows.length !== 1) {
        log.warn(`DB ${rows.length ? 'MULTIPLE' : 'NONE'} PRAYER REQUESTS IDENTIFIED`, prayerRequestID, JSON.stringify(rows));
        return new PRAYER_REQUEST(undefined);
    }
    
    return PRAYER_REQUEST.constructByDatabase(rows[0] as DATABASE_PRAYER_REQUEST); 
}

//Includes: prayer_request, requestorProfile, commentList, userRecipientList, circleRecipientList
export const DB_SELECT_PRAYER_REQUEST_DETAIL = async(prayerRequestID:number, recipientID:number, includeRecipientList:boolean = false):Promise<PRAYER_REQUEST> => {
    const rows = await execute('SELECT prayer_request.*, '
    + 'COALESCE(prayer_request_like.prayerCount, 0) AS prayerCount, '
    + 'COALESCE(prayer_request_user_like.prayerCount, 0) AS prayerCountRecipient, '
    + 'user.firstName as requestorFirstName, user.displayName as requestorDisplayName, user.image as requestorImage '
    + 'FROM prayer_request '
    + 'LEFT JOIN prayer_request_like ON prayer_request_like.prayerRequestID = prayer_request.prayerRequestID '
    + 'LEFT JOIN prayer_request_user_like ON prayer_request_user_like.prayerRequestID = prayer_request.prayerRequestID AND prayer_request_user_like.userID = ? '
    + 'LEFT JOIN user ON user.userID = prayer_request.requestorID '
    + 'WHERE prayer_request.prayerRequestID = ?;', [recipientID, prayerRequestID]); 

    if(rows.length !== 1) {
        log.warn(`DB ${rows.length ? 'MULTIPLE' : 'NONE'} PRAYER REQUESTS  IDENTIFIED BY ID`, prayerRequestID, JSON.stringify(rows));
        return new PRAYER_REQUEST(undefined);
    }
    
    const prayerRequest = PRAYER_REQUEST.constructByDatabase(rows[0] as DATABASE_PRAYER_REQUEST_EXTENDED); 
    prayerRequest.requestorProfile = {userID: rows[0].requestorID, firstName: rows[0].requestorFirstName, displayName: rows[0].requestorDisplayName, image: rows[0].requestorImage};
    prayerRequest.commentList = await DB_SELECT_PRAYER_REQUEST_COMMENT_LIST(prayerRequestID, recipientID);
    prayerRequest.userLikedList = await DB_SELECT_USER_LIKED_PRAYER_REQUEST_LIST(prayerRequestID);

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

export const DB_INSERT_PRAYER_REQUEST = async(fieldMap:Map<string, any>):Promise<{success:boolean, prayerRequestID:number}> => {
    //Validate Columns prior to Query
    if(!validatePrayerRequestColumns(fieldMap, true, true)) {
        log.db('Query Rejected: DB_INSERT_PRAYER_REQUEST; invalid column names', JSON.stringify(Array.from(fieldMap.keys())));
        return {success:false, prayerRequestID:-1};
    }

    const preparedColumns:string = Array.from(fieldMap.keys()).map((key)=> `${key}`).join(', ');
    const preparedValues:string = Array.from(fieldMap.keys()).map((key)=> `?`).join(', ');

    const response:CommandResponseType = await command(`INSERT INTO prayer_request ( ${preparedColumns} ) VALUES ( ${preparedValues} );`, Array.from(fieldMap.values())); 
    
    return {success:((response !== undefined) && (response.affectedRows === 1)), prayerRequestID:response?.insertId || -1};
}


export const DB_UPDATE_PRAYER_REQUEST = async(prayerRequestID:number, fieldMap:Map<string, any>):Promise<boolean> => {
    //Validate Columns prior to Query
    if(!validatePrayerRequestColumns(fieldMap, true, false)) {
        log.db('Query Rejected: DB_UPDATE_PRAYER_REQUEST; invalid column names', JSON.stringify(Array.from(fieldMap.keys())));
        return false;
    }

    const preparedColumns:string = Array.from(fieldMap.keys()).map((key, field)=> `${key} = ?`).join(', ');

    const response:CommandResponseType = await command(`UPDATE prayer_request SET ${preparedColumns} WHERE prayerRequestID = ?;`, [...Array.from(fieldMap.values()), prayerRequestID]); 

    return ((response !== undefined) && (response.affectedRows === 1));
}

export const DB_UPDATE_INCREMENT_PRAYER_COUNT = async(prayerRequestID:number, userID:number):Promise<boolean> => {

    const totalResponse:CommandResponseType = await command(
        'INSERT INTO prayer_request_like (prayerRequestID, prayerCount) '
        + 'VALUES (?, 1) '
        + 'ON DUPLICATE KEY UPDATE prayerCount = prayerCount + 1;',
        [prayerRequestID]);

    if(!totalResponse || (totalResponse.affectedRows !== 1 && totalResponse.affectedRows !== 2))
        return false;

    //Track multiple prayerCount per user
    const userResponse:CommandResponseType = await command(
        'INSERT INTO prayer_request_user_like (prayerRequestID, userID, prayerCount) '
        + 'VALUES (?, ?, 1) '
        + 'ON DUPLICATE KEY UPDATE prayerCount = prayerCount + 1;',
        [prayerRequestID, userID]);

    return !!userResponse && (userResponse.affectedRows === 1 || userResponse.affectedRows === 2);
}

export const DB_SELECT_USER_LIKED_PRAYER_REQUEST_LIST = async (prayerRequestID:number):Promise<ProfileListItem[]> => {
    const rows = await execute(
        'SELECT user.userID, user.firstName, user.displayName, user.image '
        + 'FROM prayer_request_user_like '
        + 'LEFT JOIN user ON user.userID = prayer_request_user_like.userID '
        + 'WHERE prayer_request_user_like.prayerRequestID = ? '
        + 'ORDER BY prayer_request_user_like.prayerCount DESC;',
        [prayerRequestID]);

    return rows.map(row => ({ userID: row.userID, firstName: row.firstName, displayName: row.displayName, image: row.image }));
}

export const DB_UPDATE_RESOLVE_PRAYER_REQUEST = async(prayerRequestID:number):Promise<boolean> => {

    const response:CommandResponseType = await command(`UPDATE prayer_request SET isResolved = true WHERE prayerRequestID = ?;`, [prayerRequestID]); 

    return ((response !== undefined) && (response.affectedRows === 1));
}

export const DB_UPDATE_RESOLVE_PRAYER_REQUEST_BATCH = async(prayerRequestIDs:number[]):Promise<boolean> => {
    if(prayerRequestIDs.length === 0 || !Array.isArray(prayerRequestIDs) || !prayerRequestIDs.every(request => typeof request === 'number')) {
        log.db('DB_UPDATE_RESOLVE_PRAYER_REQUEST_BATCH Invalid prayerRequestIDList:', JSON.stringify(prayerRequestIDs));
        return false;
    }

    const placeholders = prayerRequestIDs.map(() => '?').join(',');

    const response = await command(`UPDATE prayer_request SET isResolved = 1 WHERE prayerRequestID IN (${placeholders})`, prayerRequestIDs); 

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

    } else if(await command('DELETE FROM prayer_request_comment WHERE commenterID = ? ;', [userID]) === undefined) {
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
export const DB_SELECT_PRAYER_REQUEST_USER_LIST = async(userID:number, includeOwned:boolean = false, limit:number = LIST_LIMIT):Promise<PrayerRequestListItem[]> => {
    const rows = await execute('SELECT prayer_request.*, '
        + 'COALESCE(prayer_request_like.prayerCount, 0) AS prayerCount, '
        + 'COALESCE(prayer_request_user_like.prayerCount, 0) AS prayerCountRecipient, '
        + 'user.firstName AS requestorFirstName, user.displayName AS requestorDisplayName, user.image AS requestorImage '
        + 'FROM prayer_request '
        + 'LEFT JOIN prayer_request_like ON prayer_request_like.prayerRequestID = prayer_request.prayerRequestID '
        + 'LEFT JOIN prayer_request_user_like ON prayer_request_user_like.prayerRequestID = prayer_request.prayerRequestID AND prayer_request_user_like.userID = ? '
        + 'INNER JOIN user ON user.userID = prayer_request.requestorID '
        + 'WHERE prayer_request.isResolved = FALSE ' //Active Requests Only
        + (includeOwned ? '' : 'AND prayer_request.requestorID != ? ')
        + 'AND ( '
            //Owned by User
            + (includeOwned ? 'prayer_request.requestorID = ? OR ' : '')
            //User Direct Recipient
            + 'EXISTS ( '
                + 'SELECT 1 FROM prayer_request_recipient '
                + 'WHERE prayer_request_recipient.prayerRequestID = prayer_request.prayerRequestID '
                + 'AND prayer_request_recipient.userID = ? '
            + ') '
            //Circle Member Recipient
            + 'OR EXISTS ( '
                + 'SELECT 1 FROM prayer_request_recipient '
                + 'INNER JOIN circle_user '
                + 'ON circle_user.circleID = prayer_request_recipient.circleID '
                + `AND circle_user.status = '${DATABASE_CIRCLE_STATUS_ENUM.MEMBER}' `
                + 'WHERE prayer_request_recipient.prayerRequestID = prayer_request.prayerRequestID '
                + 'AND circle_user.userID = ? '
            + ') '
        + ') '
        + `ORDER BY prayer_request.modifiedDT DESC LIMIT ${limit};`, [userID, userID, userID, userID]);

    if(rows.length === LIST_LIMIT) log.warn(`DB_SELECT_PRAYER_REQUEST_USER_LIST: Reached limit of ${LIST_LIMIT} returned prayer requests for user:`, userID);
 
    return [...rows.map(row => PRAYER_REQUEST.constructByDatabase(row as DATABASE_PRAYER_REQUEST_EXTENDED).toListItem())];
}

//List for circle of all prayer requests where they are the intended recipient
export const DB_SELECT_PRAYER_REQUEST_CIRCLE_LIST = async(circleID:number, recipientID:number, limit:number = LIST_LIMIT):Promise<PrayerRequestListItem[]> => {
    const rows = await execute('SELECT prayer_request.*, '
        + 'COALESCE(prayer_request_like.prayerCount, 0) AS prayerCount, '
        + 'COALESCE(prayer_request_user_like.prayerCount, 0) AS prayerCountRecipient, '
        + 'user.firstName AS requestorFirstName, user.displayName AS requestorDisplayName, user.image AS requestorImage '
        + 'FROM prayer_request_recipient '
        + 'INNER JOIN prayer_request '
        +     'ON prayer_request.prayerRequestID = prayer_request_recipient.prayerRequestID '
        + 'LEFT JOIN prayer_request_like '
        +     'ON prayer_request_like.prayerRequestID = prayer_request.prayerRequestID '
        + 'LEFT JOIN prayer_request_user_like '
        +     'ON prayer_request_user_like.prayerRequestID = prayer_request.prayerRequestID '
        +     'AND prayer_request_user_like.userID = ? '
        + 'INNER JOIN user ON user.userID = prayer_request.requestorID '
        + 'WHERE prayer_request_recipient.circleID = ? '
        +     'AND prayer_request.isResolved = FALSE '
        + `ORDER BY prayer_request.modifiedDT DESC LIMIT ${limit};`,
        [recipientID, circleID]);

    if(rows.length === LIST_LIMIT) log.warn(`DB_SELECT_PRAYER_REQUEST_CIRCLE_LIST: Reached limit of ${LIST_LIMIT} returned prayer requests for circle:`, circleID);
 
    return [...rows.map(row => PRAYER_REQUEST.constructByDatabase(row as DATABASE_PRAYER_REQUEST_EXTENDED).toListItem())];
}

//List of all prayer request created by user | optional filters: isResolved
export const DB_SELECT_PRAYER_REQUEST_REQUESTOR_LIST = async(userID:number, isResolved?:boolean, limit:number = LIST_LIMIT):Promise<PrayerRequestListItem[]> => {
    const rows = await execute('SELECT prayer_request.*, '
        + 'COALESCE(prayer_request_like.prayerCount, 0) AS prayerCount, '
        + 'COALESCE(prayer_request_user_like.prayerCount, 0) AS prayerCountRecipient, '
        + 'user.firstName AS requestorFirstName, user.displayName AS requestorDisplayName, user.image AS requestorImage '
        + 'FROM prayer_request '
        + 'LEFT JOIN prayer_request_like ON prayer_request_like.prayerRequestID = prayer_request.prayerRequestID '
        + 'LEFT JOIN prayer_request_user_like '
        +     'ON prayer_request_user_like.prayerRequestID = prayer_request.prayerRequestID '
        +     'AND prayer_request_user_like.userID = ? '
        + 'INNER JOIN user ON user.userID = prayer_request.requestorID '
        + 'WHERE prayer_request.requestorID = ? '
        + ((isResolved !== undefined) ? 'AND prayer_request.isResolved = ? ' : '')
        + `ORDER BY prayer_request.modifiedDT DESC LIMIT ${limit};`, 
    [userID, userID, ...((isResolved !== undefined) ? [isResolved] : [])]); 
 
    return [...rows.map(row => PRAYER_REQUEST.constructByDatabase(row as DATABASE_PRAYER_REQUEST_EXTENDED).toListItem())];
}

export const DB_SELECT_PRAYER_REQUEST_EXPIRED_REQUESTOR_LIST = async(userID:number, limit:number = LIST_LIMIT):Promise<PrayerRequestListItem[]> => {
    const rows = await execute('SELECT prayer_request.*, '
        + 'COALESCE(prayer_request_like.prayerCount, 0) AS prayerCount, '
        + 'COALESCE(prayer_request_user_like.prayerCount, 0) AS prayerCountRecipient, '
        + 'user.firstName AS requestorFirstName, user.displayName AS requestorDisplayName, user.image AS requestorImage '
        + 'FROM prayer_request '
        + 'LEFT JOIN prayer_request_like ON prayer_request_like.prayerRequestID = prayer_request.prayerRequestID '
        + 'LEFT JOIN prayer_request_user_like '
        +     'ON prayer_request_user_like.prayerRequestID = prayer_request.prayerRequestID '
        +     'AND prayer_request_user_like.userID = ? '
        + 'INNER JOIN user ON user.userID = prayer_request.requestorID '
        + 'WHERE prayer_request.requestorID = ? '
        +     'AND prayer_request.isOnGoing = 1 '
        +     'AND prayer_request.isResolved = 0 '
        +     'AND prayer_request.expirationDate < CURRENT_DATE() '
        + `ORDER BY prayer_request.modifiedDT ASC LIMIT ${limit};`, [userID, userID]);

    return [...rows.map(row => PRAYER_REQUEST.constructByDatabase(row as DATABASE_PRAYER_REQUEST_EXTENDED).toListItem())];
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
    const rows = await execute('SELECT circle.circleID, circle.name, circle.description, circle.image '
    + 'FROM prayer_request_recipient '
    + 'LEFT JOIN circle ON circle.circleID = prayer_request_recipient.circleID  '
    + 'WHERE prayerRequestID = ? AND userID IS NULL;', [prayerRequestID]); 
 
    return [...rows.map(row => ({circleID: row.circleID, name: row.name, description:row.description, image: row.image}))];
}

export const DB_SELECT_EXPIRED_PRAYER_REQUESTS_PAGINATED = async (isOngoing:number, limit:number, cursorIndex:number):Promise<ExpiredPrayerRequest[]> => {
    const rows = await execute('SELECT prayerRequestID, requestorID, topic '
       + 'FROM prayer_request '
       + 'WHERE isOnGoing = ? '
       + 'AND prayerRequestID > ? '
       + 'AND isResolved = 0 '
       + 'AND expirationDate < current_date() '
       + `LIMIT ${limit}`, [isOngoing, cursorIndex]
    );

    return [...rows.map((row) => ({prayerRequestID: row.prayerRequestID, requestorID: row.requestorID, topic: row.topic}))]
}

//Searches for userID match among: requestor, specified recipient, member or leader of circle which is an intended recipient
export const DB_IS_RECIPIENT_PRAYER_REQUEST = async({prayerRequestID, userID}:{prayerRequestID:number, userID:number}):Promise<boolean> => {
    const rows = await execute('SELECT prayer_request.prayerRequestID ' //search specified recipient
    + 'FROM prayer_request '
    + 'LEFT JOIN prayer_request_recipient ON prayer_request_recipient.prayerRequestID = prayer_request.prayerRequestID '
    + `LEFT JOIN circle_user ON (circle_user.circleID = prayer_request_recipient.circleID AND circle_user.status = 'MEMBER') `
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
    if(userRecipientIDList.length === 0) {
        log.warn('Batch INSERT INTO prayer_request_recipient: Empty List of Users');
        return false;
    }
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
    if(circleRecipientIDList.length === 0) {
        log.warn('Batch INSERT INTO prayer_request_recipient: Empty List of Circles');
        return false;
    }
    const batchList = circleRecipientIDList.map((circleID:number) => ([prayerRequestID, circleID]));

    const response:boolean|undefined = await batch(`INSERT INTO prayer_request_recipient ( prayerRequestID, circleID ) VALUES ? ;`, batchList);

    return (response === true);
}

export const DB_INSERT_RECIPIENT_PRAYER_REQUEST_BATCH = async({prayerRequestID, userRecipientIDList=[], circleRecipientIDList=[]}:{prayerRequestID:number, userRecipientIDList:number[], circleRecipientIDList:number[]}):Promise<boolean> => {
    if(userRecipientIDList.length === 0 && circleRecipientIDList.length === 0) {
        log.warn('Batch INSERT INTO prayer_request_recipient: Empty List of Users & Circles');
        return false;
    }
        
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
    if(userRecipientIDList.length === 0 && circleRecipientIDList.length === 0) {
        log.warn('Batch DELETE FROM prayer_request_recipient: Empty List of Users & Circles');
        return false;
    }

    const response:CommandResponseType = await command('DELETE FROM prayer_request_recipient WHERE prayerRequestID = ? AND '
                                                    + `( ${[...userRecipientIDList.map((id) => 'userID = ?'), ...circleRecipientIDList.map((id) => 'circleID = ?')].join(' OR ')} );`,
                                                    [prayerRequestID, ...userRecipientIDList, ...circleRecipientIDList]);

    return ((response !== undefined) && (response.affectedRows > 0));
}


/*************************************
 *  PRAYER REQUEST COMMENT QUERIES
 *************************************/
export const DB_SELECT_PRAYER_REQUEST_COMMENT_LIST = async(prayerRequestID:number, recipientID:number):Promise<PrayerRequestCommentListItem[]> => {
    const rows = await execute('SELECT prayer_request_comment.*, '
        + 'user.firstName as commenterFirstName, user.displayName as commenterDisplayName, user.image as commenterImage, '
        + 'EXISTS ( '
            + '  SELECT 1 '
            + '  FROM prayer_request_comment_like '
            + '  WHERE prayer_request_comment_like.commentID = prayer_request_comment.commentID '
            + '  AND prayer_request_comment_like.userID = ? '
            + ') AS isLikedByRecipient '
        + 'FROM prayer_request_comment '
        + 'LEFT JOIN user ON user.userID = prayer_request_comment.commenterID '
        + 'WHERE prayerRequestID = ? '
        + 'ORDER BY createdDT DESC;', [recipientID, prayerRequestID]); 
 
    return PRAYER_REQUEST.constructByDatabaseCommentList(rows as DATABASE_PRAYER_REQUEST_COMMENT[]);
}


export const DB_SELECT_PRAYER_REQUEST_COMMENT = async(commentID:number, recipientID:number):Promise<PrayerRequestCommentListItem|undefined> => {
    const rows = await execute('SELECT prayer_request_comment.*, '
        + 'user.firstName as commenterFirstName, user.displayName as commenterDisplayName, user.image as commenterImage, '
        + 'EXISTS ( '
            + '  SELECT 1 '
            + '  FROM prayer_request_comment_like '
            + '  WHERE prayer_request_comment_like.commentID = prayer_request_comment.commentID '
            + '  AND prayer_request_comment_like.userID = ? '
            + ') AS isLikedByRecipient '
        + 'FROM prayer_request_comment '
        + 'LEFT JOIN user ON user.userID = prayer_request_comment.commenterID '
        + 'WHERE commentID = ?;',
    [recipientID, commentID]); 

    if(rows.length === 1) 
       return PRAYER_REQUEST.constructByDatabaseCommentList(rows as DATABASE_PRAYER_REQUEST_COMMENT[])[0];

    else {
        log.warn(`DB_SELECT_PRAYER_REQUEST_COMMENT ${rows.length ? 'MULTIPLE' : 'NONE'} COMMENTS IDENTIFIED`, commentID, JSON.stringify(rows));
        return undefined;
    }
}

export const DB_INSERT_PRAYER_REQUEST_COMMENT = async({prayerRequestID, commenterID, message}:{prayerRequestID:number, commenterID:number, message:string}):Promise<{success:boolean, commentID:number}> => {
    const response:CommandResponseType = await command(`INSERT INTO prayer_request_comment ( prayerRequestID, commenterID, message ) VALUES ( ?, ?, ? );`, [prayerRequestID, commenterID, message]);

    return {success:((response !== undefined) && (response.affectedRows === 1)), commentID:response?.insertId || -1};
}

export const DB_UPDATE_INCREMENT_PRAYER_REQUEST_COMMENT_LIKE_COUNT = async(commentID:number, userID:number):Promise<boolean> => {

    const totalResponse:CommandResponseType = await command(
        'UPDATE prayer_request_comment '
        + 'SET prayer_request_comment.likeCount = prayer_request_comment.likeCount + 1 '
        + 'WHERE prayer_request_comment.commentID = ?;',
        [commentID]);

    if(!totalResponse || totalResponse.affectedRows !== 1)
        return false;

    const userResponse:CommandResponseType = await command(
        'INSERT INTO prayer_request_comment_like (commentID, userID) '
        + 'VALUES (?, ?) '
        + 'ON DUPLICATE KEY UPDATE userID = userID;',
        [commentID, userID]);

    return !!userResponse && (userResponse.affectedRows === 1);
}

//Unlike a comment; currently not decrementing prayer_request_comment.likeCount for efficiency
export const DB_DELETE_PRAYER_REQUEST_COMMENT_LIKE = async(commentID:number, userID:number):Promise<boolean> => {

  const response: CommandResponseType = await command(
        'DELETE FROM prayer_request_comment_like '
        + 'WHERE prayer_request_comment_like.commentID = ? '
        + 'AND prayer_request_comment_like.userID = ?;',
        [commentID, userID]);

  return (response !== undefined) && (response.affectedRows === 1);
};


//Delete comment individually or all connections by prayerRequestID
export const DB_DELETE_PRAYER_REQUEST_COMMENT = async({commentID, prayerRequestID}:{commentID?:number, prayerRequestID:number}):Promise<boolean> => {

    const response:CommandResponseType = (commentID !== undefined) ?
     await command('DELETE FROM prayer_request_comment WHERE commentID = ? ;', [commentID])
     : await command('DELETE FROM prayer_request_comment WHERE prayerRequestID = ? ;', [prayerRequestID]);

    return (response !== undefined);
}


/*****************************
 * MOCK USER UTILITY QUERIES *
 *****************************/
export const DB_SELECT_PRAYER_REQUEST_LIST_BY_USER_SOURCE_ENVIRONMENT = async(sourceEnvironment:DATABASE_MODEL_SOURCE_ENVIRONMENT_ENUM = getModelSourceEnvironment(), limit:number = LIST_LIMIT, maxUserShares:number = LIST_LIMIT, maxCircleShares:number = LIST_LIMIT):Promise<PrayerRequestListItem[]> => {   
    const rows = await execute('SELECT prayer_request.*, '
        + 'user.firstName as requestorFirstName, user.displayName as requestorDisplayName, user.image as requestorImage, '
        + 'COUNT(DISTINCT prayer_request_recipient.userID) AS userCount, '
        + 'COUNT(DISTINCT prayer_request_recipient.circleID) AS circleCount '
        + 'FROM prayer_request '
        + 'JOIN user on user.userID = prayer_request.requestorID '
        + 'LEFT JOIN prayer_request_recipient ON prayer_request_recipient.prayerRequestID = prayer_request.prayerRequestID '
        + 'WHERE user.modelSourceEnvironment = ? '
        + 'GROUP BY prayer_request.prayerRequestID '
        + 'HAVING userCount < ? '
        + '  AND circleCount < ? '
        + `ORDER BY ${(maxUserShares <= maxCircleShares) ? 'userCount' : 'circleCount'} ASC, `
        + `${(maxUserShares > maxCircleShares) ? 'userCount' : 'circleCount'} ASC, `
        + 'prayer_request.createdDT DESC '
        + `LIMIT ${limit};`,
    [sourceEnvironment, maxUserShares, maxCircleShares]); 

    return [...rows.map(row => PRAYER_REQUEST.constructByDatabase(row as DATABASE_PRAYER_REQUEST_EXTENDED).toListItem())];
}
