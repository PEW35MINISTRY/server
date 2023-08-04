import * as log from '../../log.mjs';
import { CircleListItem } from "../../../api/circle/circle-types.mjs";
import { ProfileListItem } from "../../../api/profile/profile-types.mjs";
import { query, execute, command } from "../database.mjs";
import { CIRCLE_ANNOUNCEMENT_TABLE_COLUMNS, CIRCLE_ANNOUNCEMENT_TABLE_COLUMNS_REQUIRED, CIRCLE_TABLE_COLUMNS, CIRCLE_TABLE_COLUMNS_REQUIRED, CommandResponseType, DATABASE_CIRCLE, DATABASE_CIRCLE_ANNOUNCEMENT, DATABASE_CIRCLE_STATUS_ENUM } from "../database-types.mjs";
import CIRCLE from '../../models/circleModel.mjs';
import CIRCLE_ANNOUNCEMENT from '../../models/circleAnnouncementModel.mjs';
import { CircleStatus } from '../../models/Fields-Sync/circle-field-config.mjs';

/***********************************************
/*    DEFINING AND HANDLING ALL QUERIES HERE 
/* TABLES: circle, circle_announcement, user_circle 
************************************************/

/* Prevent SQL Injection Protocol:
* 1) Use Prepared Statements, auto escape input strings
* 2) Validate Column Names
* - Use execute() for Prepared Statements (inputs)
* - Use query() for predefined Select Statements (static)
* - Use command() for database operation (inputs)
*/

/* REQUIRED VALIDATION ONLY WHEN COLUMNS ARE INPUTS */
const validateCircleColumns = (inputMap:Map<string, any>, includesRequired:boolean = false):boolean => 
    validateColumns(inputMap, includesRequired, CIRCLE_TABLE_COLUMNS, CIRCLE_TABLE_COLUMNS_REQUIRED);

const validateCircleAnnouncementColumns = (inputMap:Map<string, any>):boolean => 
    validateColumns(inputMap, true, CIRCLE_ANNOUNCEMENT_TABLE_COLUMNS, CIRCLE_ANNOUNCEMENT_TABLE_COLUMNS_REQUIRED);

const validateColumns = (inputMap:Map<string, any>, includesRequired:boolean, columnList:string[], requiredColumnList:string[]):boolean => 
    Array.from(inputMap.entries()).every(([column, value]) => {
        return (columnList.includes(column)
            && (!requiredColumnList.includes(column) 
                || value !== undefined && value !== null && (value.toString().length > 0)));
    }) 
    && (!includesRequired || requiredColumnList.every((c)=>inputMap.has(c)));

/********************
 *  CIRCLE QUERIES
 ********************/
export const DB_SELECT_CIRCLE = async(circleID:number):Promise<CIRCLE> => {
    const rows = await execute(`SELECT * FROM circle WHERE circleID = ?`, [circleID]); 

    if(rows.length !== 1) {
        log.error(`DB ${rows.length ? 'MULTIPLE' : 'NONE'} CIRCLES IDENTIFIED`, circleID, JSON.stringify(rows));
        return new CIRCLE(undefined);
    }
    
    return new CIRCLE(rows[0] as DATABASE_CIRCLE); 
}

//Includes circle, leader profile, and requestor status
export const DB_SELECT_CIRCLE_DETAIL = async({userID, circleID}:{userID?:number, circleID:number}):Promise<CIRCLE> => {
    const rows = await execute('SELECT circle.*, circle_user.status, '
    + 'user.firstName as leaderFirstName, user.displayName as leaderDisplayName, user.image as leaderImage '
    + 'FROM circle '
    + 'LEFT JOIN circle_user ON circle.circleID = circle_user.circleID AND circle_user.userID = ? '
    + 'LEFT JOIN user ON user.userID = circle.leaderID '
    + 'WHERE circle.circleID = ?;', [userID || -1, circleID]); 

    if(rows.length !== 1) {
        log.error(`DB ${rows.length ? 'MULTIPLE' : 'NONE'} CIRCLES IDENTIFIED BY ID`, circleID, JSON.stringify(rows));
        return new CIRCLE(undefined);
    }
    
    const circle = new CIRCLE(rows[0] as DATABASE_CIRCLE); 
    circle.requestorID = userID;
    circle.requestorStatus = (userID === circle.leaderID) ? CircleStatus.LEADER : CircleStatus[rows[0].status];
    circle.leaderProfile = {userID: rows[0].leaderID, firstName: rows[0].leaderFirstName, displayName: rows[0].leaderDisplayName, image: rows[0].leaderImage};

    return circle;
}

//For New Circle Response: Includes circle and leader profile
export const DB_SELECT_CIRCLE_DETAIL_BY_NAME = async(circleName:string):Promise<CIRCLE> => {
    const rows = await execute('SELECT circle.*, '
    + 'user.firstName as leaderFirstName, user.displayName as leaderDisplayName, user.image as leaderImage '
    + 'FROM circle '
    + 'LEFT JOIN user ON user.userID = circle.leaderID '
    + 'WHERE circle.name = ?;', [circleName]); 

    if(rows.length !== 1) {
        log.error(`DB ${rows.length ? 'MULTIPLE' : 'NONE'} CIRCLES IDENTIFIED BY NAME`, circleName, JSON.stringify(rows));
        return new CIRCLE(undefined);
    }
    
    const circle = new CIRCLE(rows[0] as DATABASE_CIRCLE); 
    circle.leaderProfile = {userID: rows[0].leaderID, firstName: rows[0].leaderFirstName, displayName: rows[0].leaderDisplayName, image: rows[0].leaderImage};

    return circle;
}

export const DB_SELECT_ALL_CIRCLES = async():Promise<CircleListItem[]> => {
    const rows = await query('SELECT circle.circleID, circle.name, circle.image ' + 'FROM circle '
    + 'ORDER BY circle.modifiedDT DESC;');
 
    return [...rows.map(row => ({circleID: row.circleID || -1, name: row.name || '', image: row.image || ''}))];
}

//Insert New Profile
export const DB_INSERT_CIRCLE = async(fieldMap:Map<string, any>):Promise<boolean> => {
    //Validate Columns prior to Query
    if(!validateCircleColumns(fieldMap)) {
        log.db('Query Rejected: DB_INSERT_CIRCLE; invalid column names', JSON.stringify(Array.from(fieldMap.keys())));
        return false;
    }

    const preparedColumns:string = Array.from(fieldMap.keys()).map((key, field)=> `${key}`).join(', ');
    const preparedValues:string = Array.from(fieldMap.keys()).map((key, field)=> `?`).join(', ');

    const response:CommandResponseType = await command(`INSERT INTO circle ( ${preparedColumns} ) VALUES ( ${preparedValues} );`, Array.from(fieldMap.values())); 
    
    return ((response !== undefined) && (response.affectedRows === 1));
}

//Update Existing Profile
export const DB_UPDATE_CIRCLE = async(circleID:number, fieldMap:Map<string, any>):Promise<boolean> => {
    //Validate Columns prior to Query
    if(!validateCircleColumns(fieldMap)) {
        log.db('Query Rejected: DB_UPDATE_CIRCLE; invalid column names', JSON.stringify(Array.from(fieldMap.keys())));
        return false;
    }

    const preparedColumns:string = Array.from(fieldMap.keys()).map((key, field)=> `${key} = ?`).join(', ');

    const response:CommandResponseType = await command(`UPDATE circle SET ${preparedColumns} WHERE circleID = ?;`, [...Array.from(fieldMap.values()), circleID]); 
    
    return ((response !== undefined) && (response.affectedRows === 1));
}

export const DB_DELETE_CIRCLE = async(circleID:number):Promise<boolean> => { //Note: Database Reinforces Key constrains
    log.db(`DELETE CIRCLE attempted: circleID:${circleID}`);

    const response:CommandResponseType = await command('DELETE FROM circle WHERE circleID = ?;', [circleID]);

    return ((response !== undefined) && (response.affectedRows === 1));
}

/*******************************
 *  CIRCLE Announcement QUERIES
 *******************************/
export const DB_SELECT_CIRCLE_ANNOUNCEMENT_CURRENT = async(circleID:number):Promise<CIRCLE_ANNOUNCEMENT[]> => {
    const currentDate:Date = new Date();
    const rows = await execute('SELECT * ' + 'FROM circle_announcement '
        + 'WHERE circleID = ? '                                              //TODO: Filter for current: " AND startDate < ? AND endDate > ? "
        + 'ORDER BY startDate ASC;', [circleID]);

    return [...rows.map(row => (new CIRCLE_ANNOUNCEMENT(row as DATABASE_CIRCLE_ANNOUNCEMENT)))];
}

export const DB_INSERT_CIRCLE_ANNOUNCEMENT = async(fieldMap:Map<string, any>):Promise<boolean> => {
    //Validate Columns prior to Query
    if(!validateCircleAnnouncementColumns(fieldMap)) {
        log.db('Query Rejected: DB_INSERT_CIRCLE_ANNOUNCEMENT; invalid column names', JSON.stringify(Array.from(fieldMap.keys())));
        return false;
    }

    const preparedColumns:string = Array.from(fieldMap.keys()).map((key, field)=> `${key}`).join(', ');
    const preparedValues:string = Array.from(fieldMap.keys()).map((key, field)=> `?`).join(', ');

    const response:CommandResponseType = await command(`INSERT INTO circle_announcement ( ${preparedColumns} ) VALUES ( ${preparedValues} );`, Array.from(fieldMap.values())); 
    
    return ((response !== undefined) && (response.affectedRows === 1));
}

export const DB_DELETE_CIRCLE_ANNOUNCEMENT = async({announcementID, circleID}:{announcementID?:number, circleID:number}):Promise<boolean> => {

    const response:CommandResponseType = (announcementID === undefined)
        ? await command('DELETE FROM circle_announcement WHERE circleID = ? ;', [circleID])

        : await command('DELETE FROM circle_announcement WHERE announcementID = ? AND circleID = ? ;', [announcementID, circleID]);

    return ((response !== undefined) && ((announcementID === undefined) || (response.affectedRows === 1)));
}

/**************************
 *  CIRCLE MEMBER QUERIES
 **************************/

export const DB_SELECT_USER_CIRCLES = async(userID:number, status?:DATABASE_CIRCLE_STATUS_ENUM):Promise<CircleListItem[]> => {
    //undefined status ignores field
    const rows = (status === undefined) ?
    await execute('SELECT DISTINCT circle.circleID, circle.name, circle.image, ( SELECT circle_user.status WHERE circle_user.userID = ? ) as status ' 
        + 'FROM circle '
        + 'LEFT JOIN circle_user ON circle.circleID = circle_user.circleID '
        + 'WHERE circle_user.userID = ? OR ( circle.leaderID = ? AND ( circle_user.userID = ? ) '
        + '= ( SELECT MAX(c_u.userID = ? ) FROM circle_user as c_u WHERE c_u.circleID = circle.circleID )) '
        + 'ORDER BY ( circle.leaderID = ? ) DESC, circle_user.modifiedDT DESC;', [userID, userID, userID, userID, userID, userID])

    //Leader included in MEMBER search
    : (status === DATABASE_CIRCLE_STATUS_ENUM.MEMBER) ?
    await execute('SELECT DISTINCT circle.circleID, circle.leaderID, circle.name, circle.image, ( SELECT circle_user.status WHERE circle_user.userID = ? ) as status ' 
        + 'FROM circle '
        + 'LEFT JOIN circle_user ON circle.circleID = circle_user.circleID '
        + 'WHERE ( circle_user.userID = ? AND circle_user.status = ? ) '
        + 'OR ( circle.leaderID = ? AND ( circle_user.userID = ? ) '
        + '= ( SELECT MAX(c_u.userID = ? ) FROM circle_user as c_u WHERE c_u.circleID = circle.circleID )) '
        + 'ORDER BY ( circle.leaderID = ? ) DESC, circle_user.modifiedDT DESC;', [userID, userID, status, userID, userID, userID, userID])

    : await execute('SELECT DISTINCT circle.circleID, circle.name, circle.image, circle_user.status ' 
        + 'FROM circle '
        + 'LEFT JOIN circle_user ON circle.circleID = circle_user.circleID '
        + 'WHERE (circle_user.userID = ?  AND circle_user.status = ? ) '
        + 'ORDER BY circle_user.modifiedDT DESC;', [userID, status]);
 
    return [...rows.map(row => ({circleID: row.circleID || -1, name: row.name || '', image: row.image || '', status: (row.leaderID === userID) ? CircleStatus.LEADER : (row.status === undefined) ? undefined : CircleStatus[row.status]}))];
}

export const DB_SELECT_CIRCLE_LEADER_IDS = async(userID:number):Promise<number[]> => {
    const rows = await execute('SELECT circle.leaderID ' + 'FROM circle, circle_user '
        + 'WHERE circle.circleID = circle_user.circleID AND circle_user.userID = ? AND circle_user.status = ? '
        + 'ORDER BY circle_user.modifiedDT DESC;', [userID, DATABASE_CIRCLE_STATUS_ENUM.MEMBER]);

    return [...rows.reverse().map(row => row.leaderID)];
}

export const DB_SELECT_MEMBERS_OF_ALL_CIRCLES = async(leaderID:number):Promise<ProfileListItem[]> => {
    const rows = await execute('SELECT circle.circleID, circle.name, user.userID, user.firstName, user.displayName, user.image ' 
        + 'FROM user, circle, circle_user '
        + 'WHERE circle.circleID = circle_user.circleID AND circle_user.userID = user.userID AND circle_user.status = ? '
        + 'AND circle.leaderID = ? '
        + 'ORDER BY user.userID < 10 DESC, user.modifiedDT DESC LIMIT 15;', [DATABASE_CIRCLE_STATUS_ENUM.MEMBER, leaderID]);

    return [...rows.reverse().map(row => ({userID: row.userID || -1, firstName: row.firstName || '', displayName: row.displayName || '', image: row.image || ''}))];
}

export const DB_SELECT_CIRCLE_USER_LIST = async(circleID:number, status?:DATABASE_CIRCLE_STATUS_ENUM):Promise<ProfileListItem[]> => {
    //undefined status ignores field
    const rows = (status === undefined) ?
    await execute('SELECT user.userID, user.firstName, user.displayName, user.image, circle_user.status ' + 'FROM user '
        + 'JOIN circle_user ON user.userID = circle_user.userID '
        + 'WHERE circle_user.circleID = ? '
        + 'ORDER BY circle_user.modifiedDT DESC;', [circleID])

    : await execute('SELECT user.userID, user.firstName, user.displayName, user.image, circle_user.status ' + 'FROM user '
        + 'JOIN circle_user ON user.userID = circle_user.userID '
        + 'WHERE circle_user.circleID = ? AND circle_user.status = ? '
        + 'ORDER BY circle_user.modifiedDT DESC;', [circleID, status])

    return [...rows.reverse().map(row => ({userID: row.userID || -1, firstName: row.firstName || '', displayName: row.displayName || '', image: row.image || ''}))];
}

export const DB_IS_CIRCLE_USER_OR_LEADER = async({userID, circleID, status}:{userID:number, circleID:number, status?:DATABASE_CIRCLE_STATUS_ENUM}):Promise<boolean> => {
    //undefined status ignores field
    const rows = (status === undefined) ?
    await execute('SELECT userID ' + 'FROM circle_user '
        + 'WHERE userID = ? AND circleID = ? '
        + 'UNION ALL '
        + 'SELECT leaderID as userID ' + 'FROM circle '
        + 'WHERE leaderID = ? AND circleID = ?;', [userID, circleID, userID, circleID])

    //Leader included in MEMBER search
    : (status === DATABASE_CIRCLE_STATUS_ENUM.MEMBER) ?
    await execute('SELECT userID ' + 'FROM circle_user '
        + 'WHERE userID = ? AND circleID = ? AND status = ? '
        + 'UNION ALL '
        + 'SELECT leaderID as userID ' + 'FROM circle '
        + 'WHERE leaderID = ? AND circleID = ?;', [userID, circleID, DATABASE_CIRCLE_STATUS_ENUM.MEMBER, userID, circleID])

    : await execute('SELECT userID ' + 'FROM circle_user '
        + 'WHERE userID = ? AND circleID = ? AND status = ?;', [userID, circleID, status])

    return (rows.length > 0);
}

//Create New request or invite; should fail if either exists
export const DB_INSERT_CIRCLE_USER_STATUS = async({userID, circleID, status}:{userID:number, circleID:number, status:DATABASE_CIRCLE_STATUS_ENUM}):Promise<boolean> => {
    const response:CommandResponseType = await command(`INSERT INTO circle_user ( circleID, userID, status ) VALUES ( ?, ?, ? );`, [circleID, userID, status]);

    return ((response !== undefined) && (response.affectedRows === 1));
}

//Operation following acceptance of invite or request to join | currentStatus act as permission test
export const DB_UPDATE_CIRCLE_USER_STATUS = async({userID, circleID, status, currentStatus}:{userID:number, circleID:number, status:DATABASE_CIRCLE_STATUS_ENUM, currentStatus?:DATABASE_CIRCLE_STATUS_ENUM}):Promise<boolean> => {
    const response:CommandResponseType = (currentStatus === undefined)
        ? await command('UPDATE circle_user SET status = ? WHERE userID = ? AND circleID = ?;', [status, userID, circleID])

        : await command('UPDATE circle_user SET status = ? WHERE userID = ? AND circleID = ? AND status = ?;', [status, userID, circleID, currentStatus])

    return ((response !== undefined) && (response.affectedRows === 1));
}

export const DB_DELETE_CIRCLE_USER_STATUS = async({userID, circleID}:{userID:number, circleID:number}):Promise<boolean> => {
    log.db(`DELETE CIRCLE MEMBER attempted: userID:${userID}, circleID:${circleID}`);

    const response:CommandResponseType = (circleID === undefined) //Delete Membership from All circles
        ? await command('DELETE FROM circle_user WHERE userID = ? ;', [userID])

        : (userID === undefined) //Delete All circle Members
        ? await command('DELETE FROM circle_user WHERE circleID = ? ;', [circleID])

        : await command('DELETE FROM circle_user WHERE userID = ? AND circleID = ?;', [userID, circleID]);

    return ((response !== undefined) && ((userID === undefined) || (response.affectedRows === 1)));
}
