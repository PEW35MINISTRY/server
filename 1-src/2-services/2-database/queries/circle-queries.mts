import * as log from '../../10-utilities/logging/log.mjs';
import { command, execute, validateColumns } from '../database.mjs';
import { CIRCLE_ANNOUNCEMENT_TABLE_COLUMNS, CIRCLE_ANNOUNCEMENT_TABLE_COLUMNS_REQUIRED, CIRCLE_TABLE_COLUMNS, CIRCLE_TABLE_COLUMNS_REQUIRED, CommandResponseType, DATABASE_CIRCLE, DATABASE_CIRCLE_ANNOUNCEMENT, DATABASE_CIRCLE_STATUS_ENUM, DATABASE_MODEL_SOURCE_ENVIRONMENT_ENUM, DATABASE_USER_ROLE_ENUM } from '../database-types.mjs';
import CIRCLE from '../../1-models/circleModel.mjs';
import { CircleListItem } from '../../../0-assets/field-sync/api-type-sync/circle-types.mjs';
import { ProfileListItem } from '../../../0-assets/field-sync/api-type-sync/profile-types.mjs';
import { CircleSearchRefineEnum, CircleStatusEnum } from '../../../0-assets/field-sync/input-config-sync/circle-field-config.mjs';
import { LIST_LIMIT } from '../../../0-assets/field-sync/input-config-sync/search-config.mjs';
import CIRCLE_ANNOUNCEMENT from '../../1-models/circleAnnouncementModel.mjs';
import { getModelSourceEnvironment } from '../../10-utilities/utilities.mjs';
import { GENERAL_USER_ROLES } from '../../../0-assets/field-sync/input-config-sync/profile-field-config.mjs';


/***********************************************
/*    DEFINING AND HANDLING ALL QUERIES HERE 
/* TABLES: circle, circle_announcement, user_circle, circle_search_cache
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


/********************
 *  CIRCLE QUERIES
 ********************/
export const DB_SELECT_CIRCLE = async(circleID:number):Promise<CIRCLE> => {
    const rows = await execute(`SELECT * FROM circle WHERE circleID = ?`, [circleID]); 

    if(rows.length !== 1) {
        log.warn(`DB ${rows.length ? 'MULTIPLE' : 'NONE'} CIRCLES IDENTIFIED`, circleID, JSON.stringify(rows));
        return new CIRCLE(undefined);
    }
    
    return CIRCLE.constructByDatabase(rows[0] as DATABASE_CIRCLE); 
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
        log.warn(`DB ${rows.length ? 'MULTIPLE' : 'NONE'} CIRCLES IDENTIFIED BY ID`, circleID, JSON.stringify(rows));
        return new CIRCLE(undefined);
    }
    
    const circle = CIRCLE.constructByDatabase(rows[0] as DATABASE_CIRCLE); 
    circle.requestorID = userID;
    circle.requestorStatus = (userID === circle.leaderID) ? CircleStatusEnum.LEADER : CircleStatusEnum[rows[0].status];
    circle.leaderProfile = {userID: rows[0].leaderID, firstName: rows[0].leaderFirstName, displayName: rows[0].leaderDisplayName, image: rows[0].leaderImage};

    return circle;
}

//For New Circle Response: Includes circle and leader profile
export const DB_SELECT_CIRCLE_DETAIL_BY_NAME = async(leaderID:number, circleName:string):Promise<CIRCLE> => {
    const rows = await execute('SELECT circle.*, '
    + 'user.firstName as leaderFirstName, user.displayName as leaderDisplayName, user.image as leaderImage '
    + 'FROM circle '
    + 'LEFT JOIN user ON user.userID = circle.leaderID '
    + 'WHERE circle.leaderID = ? AND circle.name = ? '
    + 'ORDER BY createdDT DESC;', [leaderID, circleName]); 

    if(rows.length === 0) {
        log.warn(`DB DB_SELECT_CIRCLE_DETAIL_BY_NAME - New Circle not found by leaderID and Name`, leaderID, circleName, JSON.stringify(rows));
        return new CIRCLE(undefined);
    }
    
    const circle = CIRCLE.constructByDatabase(rows[0] as DATABASE_CIRCLE); 
    circle.leaderProfile = {userID: rows[0].leaderID, firstName: rows[0].leaderFirstName, displayName: rows[0].leaderDisplayName, image: rows[0].leaderImage};

    return circle;
}

//Used as default circle Search; TODO replace with location based eventually
export const DB_SELECT_LATEST_CIRCLES = async(limit:number = LIST_LIMIT):Promise<CircleListItem[]> => {

    const rows = await execute('SELECT circle.circleID, circle.name, circle.image ' + 'FROM circle '
        + 'LEFT JOIN user on user.userID = circle.leaderID '
        + 'WHERE ( '
            + '        user.modelSourceEnvironment = ? '
            + '        OR ( '
            + '            CASE '
            + `                WHEN ? = '${DATABASE_MODEL_SOURCE_ENVIRONMENT_ENUM.DEVELOPMENT}' THEN user.modelSourceEnvironment IN ('${DATABASE_MODEL_SOURCE_ENVIRONMENT_ENUM.DEVELOPMENT}', '${DATABASE_MODEL_SOURCE_ENVIRONMENT_ENUM.MOCK}') `
            + `                WHEN ? = '${DATABASE_MODEL_SOURCE_ENVIRONMENT_ENUM.MOCK}' THEN user.modelSourceEnvironment IN ('${DATABASE_MODEL_SOURCE_ENVIRONMENT_ENUM.DEVELOPMENT}', '${DATABASE_MODEL_SOURCE_ENVIRONMENT_ENUM.INTERNAL}') `
            + `                WHEN ? = '${DATABASE_MODEL_SOURCE_ENVIRONMENT_ENUM.INTERNAL}' THEN user.modelSourceEnvironment = '${DATABASE_MODEL_SOURCE_ENVIRONMENT_ENUM.MOCK}' `
            + '                ELSE false '
            + '            END '
            + '        ) '
            + '    ) '
        + `ORDER BY circle.modifiedDT DESC LIMIT ${limit};`,

        [getModelSourceEnvironment(), getModelSourceEnvironment(), getModelSourceEnvironment(), getModelSourceEnvironment()]);
 
    return [...rows.map(row => ({circleID: row.circleID || -1, name: row.name || '', image: row.image || ''}))];
}

export const DB_SELECT_CIRCLE_IDS = async(fieldMap:Map<string, any>):Promise<number[]> => {
    //Validate Columns prior to Query
    if(!validateCircleColumns(fieldMap)) {
        log.db('Query Rejected: DB_SELECT_CIRCLE_IDS; invalid column names', JSON.stringify(Array.from(fieldMap.keys())));
        return [];
    }

    const preparedColumns:string = Array.from(fieldMap.keys()).map((column, value)=> `${column} = ?`).join(' AND ');

    const rows = await execute('SELECT DISTINCT circleID ' + 'FROM circle '
        + `WHERE ${preparedColumns} ORDER BY circle.modifiedDT DESC;`, Array.from(fieldMap.values()));

    return [...rows.reverse().map(row => row.circleID)];
}

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


/**********************************
 *  CIRCLE SEARCH & CACHE QUERIES
 **********************************/
//https://code-boxx.com/mysql-search-exact-like-fuzzy/
export const DB_SELECT_CIRCLE_SEARCH = async(searchTerm:string, columnList:string[], limit:number = LIST_LIMIT):Promise<CircleListItem[]> => {
    
    const rows = await execute('SELECT circle.circleID, circle.name, circle.image ' + 'FROM circle '
        + 'LEFT JOIN user on user.userID = circle.leaderID '
        + 'WHERE ( '
        + `        user.modelSourceEnvironment = '${getModelSourceEnvironment()}' `
        + '        OR ( '
        + '            CASE '
        + `                WHEN '${getModelSourceEnvironment()}' = '${DATABASE_MODEL_SOURCE_ENVIRONMENT_ENUM.DEVELOPMENT}' THEN user.modelSourceEnvironment IN ('${DATABASE_MODEL_SOURCE_ENVIRONMENT_ENUM.MOCK}') `
        + `                WHEN '${getModelSourceEnvironment()}' = '${DATABASE_MODEL_SOURCE_ENVIRONMENT_ENUM.MOCK}' THEN user.modelSourceEnvironment IN ('${DATABASE_MODEL_SOURCE_ENVIRONMENT_ENUM.DEVELOPMENT}', '${DATABASE_MODEL_SOURCE_ENVIRONMENT_ENUM.INTERNAL}') `
        + `                WHEN '${getModelSourceEnvironment()}' = '${DATABASE_MODEL_SOURCE_ENVIRONMENT_ENUM.INTERNAL}' THEN user.modelSourceEnvironment IN ('${DATABASE_MODEL_SOURCE_ENVIRONMENT_ENUM.MOCK}') `
        + '                ELSE false '
        + '            END '
        + '        ) '
        + '    ) '
        + 'AND ( '
            + columnList.map(column => `LOWER(circle.${column}) LIKE LOWER(CONCAT("%", ?, "%"))`).join(' OR ')
        + ' ) '
        + 'ORDER BY circle.modifiedDT DESC '
        + `LIMIT ${limit};`,    
    [...Array(columnList.length).fill(`${searchTerm}`)]);
 
    return [...rows.map(row => ({circleID: row.circleID || -1, name: row.name || '', image: row.image || ''}))];
}

export const DB_SELECT_CIRCLE_SEARCH_CACHE = async(searchTerm:string, searchRefine:CircleSearchRefineEnum):Promise<CircleListItem[]|undefined> => {

    const rows = await execute('SELECT stringifiedCircleItemList ' + 'FROM circle_search_cache '
        + 'WHERE searchTerm = ? AND searchRefine = ? AND modelSourceEnvironment = ?;', [searchTerm, searchRefine, getModelSourceEnvironment()]);

    if(rows.length === 0) return undefined;

    try {
        const stringifiedList:string = rows[0].stringifiedCircleItemList;    
        return JSON.parse(stringifiedList);
        
    } catch(error) {
        log.db('DB_SELECT_CIRCLE_SEARCH_CACHE :: Failed to Parse JSON List', rows[0]);
        return undefined;
    }
}

//Updates on Duplicate
export const DB_INSERT_CIRCLE_SEARCH_CACHE = async({searchTerm, searchRefine, circleList}:{searchTerm:string, searchRefine:CircleSearchRefineEnum, circleList:CircleListItem[]}):Promise<boolean> => {

    const response:CommandResponseType = await command(`INSERT INTO circle_search_cache ( searchTerm, searchRefine, modelSourceEnvironment, stringifiedCircleItemList ) `
    + `VALUES ( ?, ?, ?, ? ) ON DUPLICATE KEY UPDATE searchTerm=VALUES(searchTerm) , searchRefine=VALUES(searchRefine), modelSourceEnvironment=VALUES(modelSourceEnvironment), stringifiedCircleItemList=VALUES(stringifiedCircleItemList);`,
     [searchTerm, searchRefine, getModelSourceEnvironment(), JSON.stringify(circleList)]); 
    
    return ((response !== undefined) && (response.affectedRows > 0));
}

export const DB_DELETE_CIRCLE_SEARCH_CACHE = async(searchTerm:string, searchRefine:CircleSearchRefineEnum):Promise<boolean> => {
    log.event(`Deleting Search Circle Cache for searchTerm: ${searchTerm}`);

    const response:CommandResponseType = await command('DELETE FROM circle_search_cache WHERE searchTerm = ? AND searchRefine = ? AND modelSourceEnvironment = ?;', [searchTerm, searchRefine, getModelSourceEnvironment()]);

    return ((response !== undefined) && (response.affectedRows > 0));
}

export const DB_FLUSH_CIRCLE_SEARCH_CACHE_ADMIN = async():Promise<boolean> => {
    log.db('Flushing circle_search_cache Table');

    const response:CommandResponseType = await command('DELETE FROM circle_search_cache;', []);

    return ((response !== undefined) && (response.affectedRows > 0));
}

//TODO reverse search ???
export const DB_DELETE_CIRCLE_SEARCH_REVERSE_CACHE = async(filterList:CircleSearchRefineEnum[], valueList:string[]):Promise<boolean> => {


    const response:CommandResponseType = await command('DELETE FROM circle_search_cache '
    + 'WHERE ' + `${`CONCAT_WS( ${valueList.join(`, ' ', `)} )`} LIKE ? `, 
    []);
 
    return ((response !== undefined) && (response.affectedRows > 0));
}


/*******************************
 *  CIRCLE Announcement QUERIES
 *******************************/
export const DB_SELECT_CIRCLE_ANNOUNCEMENT_CURRENT = async(circleID:number):Promise<CIRCLE_ANNOUNCEMENT[]> => {
    const currentDate:Date = new Date();
    const rows = await execute('SELECT circle_announcement.* ' + 'FROM circle_announcement '
        + 'WHERE circleID = ? '
        + 'AND circle_announcement.startDate < ? '
        // + 'AND circle_announcement.endDate > ? ' //TODO enable once we have auto delete routines
        + 'ORDER BY startDate ASC;', [circleID, currentDate]);

    return [...rows.map(row => (CIRCLE_ANNOUNCEMENT.constructByDatabase(row as DATABASE_CIRCLE_ANNOUNCEMENT)))];
}

export const DB_SELECT_CIRCLE_ANNOUNCEMENT_ALL_CIRCLES = async(userID:number):Promise<CIRCLE_ANNOUNCEMENT[]> => {
    const currentDate:Date = new Date();
    const rows = await execute('SELECT DISTINCT circle_announcement.* ' + 'FROM circle_announcement '
        + 'LEFT JOIN circle ON circle_announcement.circleID = circle.circleID '
        + 'LEFT JOIN circle_user ON circle_announcement.circleID = circle_user.circleID '
        + 'WHERE (( circle_user.userID = ? AND circle_user.status = ? ) OR circle.leaderID = ? ) '
        + 'AND circle_announcement.startDate < ? '
        + 'AND circle_announcement.endDate > ? '  //TODO create an auto delete routines
        + 'ORDER BY startDate ASC;', [userID, DATABASE_CIRCLE_STATUS_ENUM.MEMBER, userID, currentDate, currentDate]);

    return [...rows.map(row => (CIRCLE_ANNOUNCEMENT.constructByDatabase(row as DATABASE_CIRCLE_ANNOUNCEMENT)))];
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
export const DB_SELECT_USER_CIRCLE_IDS = async(userID:number, status?:DATABASE_CIRCLE_STATUS_ENUM):Promise<number[]> => {

    const rows = (status === undefined) ?
        await execute('SELECT circle_user.circleID ' + 'FROM circle_user '
            + 'WHERE circle_user.userID = ? '
            + 'ORDER BY circle.modifiedDT DESC;', [userID])

        : await execute('SELECT circle_user.circleID ' + 'FROM circle_user '
            + 'WHERE circle_user.userID = ? AND circle_user.status = ? '
            + 'ORDER BY circle_user.modifiedDT DESC;', [userID, status]);

    return [...rows.reverse().map(row => row.circleID)];
}

export const DB_SELECT_USER_CIRCLES = async(userID:number, status?:DATABASE_CIRCLE_STATUS_ENUM):Promise<CircleListItem[]> => {
    //undefined status ignores field
    const rows = (status === undefined) ?
    await execute('SELECT DISTINCT circle.circleID, circle.name, circle.image, circle.leaderID, ( SELECT circle_user.status WHERE circle_user.userID = ? ) as status ' 
        + 'FROM circle '
        + 'LEFT JOIN circle_user ON circle.circleID = circle_user.circleID '
        + 'WHERE circle_user.userID = ? OR ( circle.leaderID = ? ) '
        + 'GROUP BY circle.circleID '
        + 'ORDER BY ( circle.leaderID = ? ) DESC, circle_user.modifiedDT DESC;', [userID, userID, userID, userID])

    //Leader included in MEMBER search
    : (status === DATABASE_CIRCLE_STATUS_ENUM.MEMBER) ?
    await execute('SELECT DISTINCT circle.circleID, circle.leaderID, circle.name, circle.image, ( SELECT circle_user.status WHERE circle_user.userID = ? ) as status ' 
        + 'FROM circle '
        + 'LEFT JOIN circle_user ON circle.circleID = circle_user.circleID '
        + 'WHERE ( circle_user.userID = ? AND circle_user.status = ? ) '
        + 'OR ( circle.leaderID = ? ) '
        + 'GROUP BY circle.circleID '
        + 'ORDER BY ( circle.leaderID = ? ) DESC, circle_user.modifiedDT DESC;', [userID, userID, status, userID, userID])

    : await execute('SELECT DISTINCT circle.circleID, circle.name, circle.image, circle.leaderID, circle_user.status ' 
        + 'FROM circle '
        + 'LEFT JOIN circle_user ON circle.circleID = circle_user.circleID '
        + 'WHERE (circle_user.userID = ?  AND circle_user.status = ? ) '
        + 'GROUP BY circle.circleID '
        + 'ORDER BY circle_user.modifiedDT DESC;', [userID, status]);
 
    return [...rows.map(row => ({circleID: row.circleID || -1, name: row.name || '', image: row.image || '', status: (row.leaderID === userID) ? CircleStatusEnum.LEADER : (row.status === undefined) ? undefined : CircleStatusEnum[row.status]}))];
}

//Select list of leader IDs where 'user' is a member of their circle | (Circle manager has access to 'user' profile)
export const DB_SELECT_CIRCLE_MANAGER_IDS = async(userID:number):Promise<number[]> => {
    const rows = await execute(
        'SELECT DISTINCT circle.leaderID '
        + 'FROM circle '
        + 'JOIN circle_user ON circle.circleID = circle_user.circleID '
        + 'JOIN user_role AS leader_role ON leader_role.userID = circle.leaderID '
        + 'JOIN user_role_defined AS leader_role_defined ON leader_role_defined.userRoleID = leader_role.userRoleID '
        + 'WHERE circle_user.userID = ? '
            + 'AND circle_user.status = ? '
            + 'AND leader_role_defined.userRole = ? '
        + 'ORDER BY circle_user.modifiedDT DESC;',
        [userID, DATABASE_CIRCLE_STATUS_ENUM.MEMBER, DATABASE_USER_ROLE_ENUM.CIRCLE_MANAGER]);

    return [...rows.reverse().map(row => row.leaderID)];
}

//Circle Manager access to User Profile | Searches if userID is a current member of any of leaderID circles and verifies leaderID is a CIRCLE_MANAGER' role
export const DB_IS_USER_MEMBER_OF_ANY_LEADER_CIRCLES = async({leaderID, userID}:{leaderID:number, userID:number}):Promise<boolean> => {
    //undefined status ignores field
    const rows = await execute('SELECT circle_user.circleID ' + 'FROM circle_user '
    + 'LEFT JOIN circle ON circle.circleID = circle_user.circleID '
    + 'LEFT JOIN user_role ON user_role.userID = circle.leaderID '
    + 'LEFT JOIN user_role_defined ON user_role_defined.userRoleID = user_role.userRoleID '
    + 'WHERE user_role_defined.userRole = ? AND circle.leaderID = ? AND circle_user.userID = ? AND circle_user.STATUS = ?;', 
    [DATABASE_USER_ROLE_ENUM.CIRCLE_MANAGER, leaderID, userID, DATABASE_CIRCLE_STATUS_ENUM.MEMBER]);

    return (rows.length > 0);
}

//USER profile access for CIRCLE_MANAGER and leaderID
export const DB_SELECT_MEMBERS_OF_ALL_LEADER_MANAGED_CIRCLES = async(leaderID:number, onlyGeneralUsers = true, limit = LIST_LIMIT):Promise<ProfileListItem[]> => {
    const rows = onlyGeneralUsers ? 
        await execute('SELECT DISTINCT circle.circleID, circle.name, user.userID, user.firstName, user.displayName, user.image ' 
            + 'FROM user '
            + 'LEFT JOIN circle_user ON circle_user.userID = user.userID '
                + 'LEFT JOIN circle ON circle.circleID = circle_user.circleID '
            + 'JOIN user_role AS leader_role ON leader_role.userID = circle.leaderID '
                + 'JOIN user_role_defined AS leader_role_defined ON leader_role_defined.userRoleID = leader_role.userRoleID '
            + 'LEFT JOIN user_role ON user_role.userID = user.userID '
                + 'LEFT JOIN user_role_defined ON user_role_defined.userRoleID = user_role.userRoleID '
            + 'WHERE circle_user.status = ? '
                + 'AND circle.leaderID = ? '
                + 'AND leader_role_defined.userRole = ? '
                + `AND (user_role_defined.userRole IN (${GENERAL_USER_ROLES.map(r => `'${r}'`).join(', ')}) OR user_role_defined.userRole IS NULL) `
            + 'ORDER BY user.modifiedDT DESC '
            + `LIMIT ${limit};`, 
            [DATABASE_CIRCLE_STATUS_ENUM.MEMBER, leaderID, DATABASE_USER_ROLE_ENUM.CIRCLE_MANAGER])

        : await execute('SELECT DISTINCT circle.circleID, circle.name, user.userID, user.firstName, user.displayName, user.image ' 
            + 'FROM user '
            + 'JOIN circle_user ON circle_user.userID = user.userID '
                + 'JOIN circle ON circle.circleID = circle_user.circleID '
            + 'JOIN user_role AS leader_role ON leader_role.userID = circle.leaderID '
                + 'JOIN user_role_defined AS leader_role_defined ON leader_role_defined.userRoleID = leader_role.userRoleID '
            + 'WHERE circle_user.status = ? '
                + 'AND circle.leaderID = ? '
                + 'AND leader_role_defined.userRole = ? '
            + 'ORDER BY user.modifiedDT DESC '
            + `LIMIT ${limit};`, [DATABASE_CIRCLE_STATUS_ENUM.MEMBER, leaderID, DATABASE_USER_ROLE_ENUM.CIRCLE_MANAGER]);

    return [...rows.reverse().map(row => ({userID: row.userID || -1, firstName: row.firstName || '', displayName: row.displayName || '', image: row.image || ''}))];
}


//Selects list of Circle Member ID's
export const DB_SELECT_CIRCLE_USER_IDS = async(circleID:number, status?:DATABASE_CIRCLE_STATUS_ENUM, includeLeader:boolean = true):Promise<number[]> => {
    const rows = await execute(
        'SELECT user.userID, user.firstName, user.displayName, user.image, circle_user.status '
        + 'FROM user '
        + 'JOIN circle_user ON user.userID = circle_user.userID '
        + 'LEFT JOIN circle ON circle_user.circleID = circle.circleID '
        + 'WHERE circle_user.circleID = ? '
        + (includeLeader ? 'OR (circle.leaderID = user.userID AND circle.circleID = ? ) ' : '')
        + (status !== undefined ? 'AND circle_user.status = ? ' : '')
        + 'ORDER BY user.userID ASC;',
        [
            circleID,
            ...(includeLeader ? [circleID] : []),
            ...(status !== undefined ? [status] : [])
        ]
    );

    return [...rows.reverse().map(row => row.userID)];
}


//Selects list Circle members by status (excludes leader)
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

//Verify Circle Leader and still hold Leader Role
export const DB_IS_CIRCLE_LEADER = async({leaderID, circleID}:{leaderID:number, circleID:number}):Promise<boolean> => {
    //undefined status ignores field
    const rows = await execute('SELECT leaderID ' + 'FROM circle '
    + 'LEFT JOIN user_role ON user_role.userID = leaderID '
    + 'LEFT JOIN user_role_defined ON user_role_defined.userRoleID = user_role.userRoleID '
    + 'WHERE leaderID = ? '
    + 'AND circleID = ? '
    + 'AND user_role_defined.userRole IN (?, ?) ;',
    [leaderID, circleID, DATABASE_USER_ROLE_ENUM.CIRCLE_LEADER, DATABASE_USER_ROLE_ENUM.CIRCLE_MANAGER]);

    return (rows.length > 0);
}


//Create New request or invite; should fail if either exists
export const DB_INSERT_CIRCLE_USER_STATUS = async({userID, circleID, status}:{userID:number, circleID:number, status:DATABASE_CIRCLE_STATUS_ENUM}):Promise<boolean> => {
    const response:CommandResponseType = await command('INSERT INTO circle_user ( circleID, userID, status ) VALUES ( ?, ?, ? ) '
    + 'ON DUPLICATE KEY UPDATE status = ?;', [circleID, userID, status, status]);

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

    return (response !== undefined);  //Success on non-error
}


/*****************************
 * MOCK USER UTILITY QUERIES *
 *****************************/
export const DB_SELECT_CIRCLE_LIST_BY_USER_SOURCE_ENVIRONMENT = async(sourceEnvironment:DATABASE_MODEL_SOURCE_ENVIRONMENT_ENUM = getModelSourceEnvironment(), limit:number = LIST_LIMIT, maxMembers:number = LIST_LIMIT, maxSharedPrayerRequest = LIST_LIMIT):Promise<CircleListItem[]> => {   

    const rows = await execute('SELECT circle.*, ' 
        + 'COUNT(DISTINCT circle_user.userID) AS memberCount, '
        + 'COUNT(DISTINCT prayer_request_recipient.prayerRequestID) AS requestCount '
        + 'FROM circle '
        + 'JOIN user on user.userID = circle.leaderID '
        + 'LEFT JOIN circle_user ON circle.circleID = circle_user.circleID '
        + 'LEFT JOIN prayer_request_recipient ON circle.circleID = prayer_request_recipient.circleID '
        + 'WHERE user.modelSourceEnvironment = ? '
        + 'GROUP BY circle.circleID '
        + 'HAVING memberCount < ? '
        + '  AND requestCount < ? '
        + 'ORDER BY memberCount ASC, requestCount ASC, circle.createdDT DESC '
        + `LIMIT ${limit};`,
    [sourceEnvironment, maxMembers, maxSharedPrayerRequest]); 

    return [...rows.map(row => ({circleID: row.circleID || -1, name: row.name || '', image: row.image || ''}))];
}
