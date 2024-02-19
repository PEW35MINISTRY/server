import { ProfileListItem } from '../../../0-assets/field-sync/api-type-sync/profile-types.mjs';
import { RoleEnum, UserSearchFilterEnum } from '../../../0-assets/field-sync/input-config-sync/profile-field-config.mjs';
import { CredentialProfile } from '../../../1-api/3-profile/profile-types.mjs';
import USER from '../../1-models/userModel.mjs';
import * as log from '../../log.mjs';
import { CommandResponseType, DATABASE_CIRCLE_STATUS_ENUM, DATABASE_USER, DATABASE_USER_ROLE_ENUM, USER_TABLE_COLUMNS, USER_TABLE_COLUMNS_REQUIRED } from '../database-types.mjs';
import { command, execute, query, validateColumns } from '../database.mjs';
import { DB_SELECT_MEMBERS_OF_ALL_CIRCLES, DB_SELECT_USER_CIRCLES } from './circle-queries.mjs';
import { DB_SELECT_PRAYER_REQUEST, DB_SELECT_PRAYER_REQUEST_REQUESTOR_LIST } from './prayer-request-queries.mjs';


/**************************************************************************
/*       DEFINING AND HANDLING ALL QUERIES HERE 
/* TABLES: user, user_role, user_role_defined, partner, user_search_cache
***************************************************************************/

/* Prevent SQL Injection Protocol:
* 1) Use Prepared Statements, auto escape input strings
* 2) Validate Column Names
* - Use execute() for Prepared Statements (inputs)
* - Use query() for predefined Select Statements (static)
* - Use command() for database operation (inputs)
* - Use batch() for multiple prepared operations (input)
*/

/* REQUIRED VALIDATION ONLY WHEN COLUMNS ARE INPUTS */
const validateUserColumns = (inputMap:Map<string, any>, includesRequired:boolean = false):boolean => 
    validateColumns(inputMap, includesRequired, USER_TABLE_COLUMNS, USER_TABLE_COLUMNS_REQUIRED);

    
/*************************
 *  USER PROFILE QUERIES
 *************************/
export const DB_SELECT_USER = async(filterMap:Map<string, any>):Promise<USER> => {
    //Validate Columns prior to Query
    if(filterMap.size === 0 || !validateUserColumns(filterMap)) {
        log.db('Query Rejected: DB_SELECT_USER; invalid column names', JSON.stringify(Array.from(filterMap.keys())));
        return new USER();
    }

    //Assemble filterMap
    const preparedColumns:string = Array.from(filterMap.keys()).map((key, field)=> `user.${key} = ?`).join(' AND ');

    //Query User and max userRole
    const rows = await execute('SELECT user.*, user_role_defined.userRole ' + 'FROM user '
        + 'LEFT JOIN user_role ON user_role.userID = user.userID '
        + 'AND user_role.userRoleID = ( SELECT min( userRoleID ) FROM user_role WHERE user.userID = user_role.userID ) '
        + 'LEFT JOIN user_role_defined ON user_role_defined.userRoleID = user_role.userRoleID '
        + `WHERE ${preparedColumns};`, Array.from(filterMap.values()));
    
    if(rows.length === 1) return USER.constructByDatabase(rows[0] as DATABASE_USER);
    else {
        log.warn(`DB_SELECT_USER ${rows.length ? 'MULTIPLE' : 'NONE'} USERS IDENTIFIED`, JSON.stringify(filterMap), JSON.stringify(rows));
        return new USER();
    }
}

//FULL USER PROFILE: including roleList, circleList, partnerList
export const DB_SELECT_USER_PROFILE = async(filterMap:Map<string, any>):Promise<USER> => {
    //Validate Columns prior to Query
    if(filterMap.size === 0 || !validateUserColumns(filterMap)) {
        log.db('Query Rejected: DB_SELECT_USER_PROFILE; invalid column names', JSON.stringify(Array.from(filterMap.keys())));
        return new USER();
    }

    const preparedColumns:string = Array.from(filterMap.keys()).map((key, value)=> `${key} = ?`).join(' AND ');

    const rows = await execute(`SELECT * FROM user WHERE ${preparedColumns};`, Array.from(filterMap.values())); 
    
    if(rows.length !== 1) {
        log.warn(`DB_SELECT_USER_PROFILE ${rows.length ? 'MULTIPLE' : 'NONE'} USERS IDENTIFIED`, JSON.stringify(filterMap), JSON.stringify(rows));
        return new USER();
    }
    
    //Append Full Profile 
    const user = USER.constructByDatabase(rows[0] as DATABASE_USER);
    user.userRoleList = await DB_SELECT_USER_ROLES(user.userID);
    user.circleList = await DB_SELECT_USER_CIRCLES(user.userID);  //Includes all statuses
    user.partnerList = await DB_SELECT_USER_PARTNERS(user.userID);
    user.prayerRequestList = await DB_SELECT_PRAYER_REQUEST_REQUESTOR_LIST(user.userID);
    user.contactList = await DB_SELECT_CONTACTS(user.userID);
    if(user.isRole(RoleEnum.CIRCLE_LEADER)) user.profileAccessList = await DB_SELECT_MEMBERS_OF_ALL_CIRCLES(user.userID);

    return user;
}

//Insert New Profile
export const DB_INSERT_USER = async(fieldMap:Map<string, any>):Promise<boolean> => {
    //Validate Columns prior to Query
    if(fieldMap.size === 0 || !validateUserColumns(fieldMap, true)) {
        log.db('Query Rejected: DB_INSERT_USER; invalid column names', JSON.stringify(Array.from(fieldMap.keys())));
        return false;
    }

    const preparedColumns:string = Array.from(fieldMap.keys()).map((key)=> `${key}`).join(', ');
    const preparedValues:string = Array.from(fieldMap.values()).map((value)=> `?`).join(', ');

    const response:CommandResponseType = await command(`INSERT INTO user ( ${preparedColumns} ) VALUES ( ${preparedValues} );`, Array.from(fieldMap.values())); 
    
    return ((response !== undefined) && (response.affectedRows === 1));
}

//Update Existing Profile
export const DB_UPDATE_USER = async(userID:number, fieldMap:Map<string, any>):Promise<boolean> => {
    //Validate Columns prior to Query
    if(fieldMap.size === 0 || !validateUserColumns(fieldMap)) {
        log.db('Query Rejected: DB_UPDATE_USER; invalid column names', JSON.stringify(Array.from(fieldMap.keys())));
        return false;
    }

    const preparedColumns:string = Array.from(fieldMap.keys()).map((key, field)=> `${key} = ?`).join(', ');

    const response:CommandResponseType = await command(`UPDATE user SET ${preparedColumns} WHERE userID = ?;`, [...Array.from(fieldMap.values()), userID]); 
    
    return ((response !== undefined) && (response.affectedRows === 1));
}

export const DB_DELETE_USER = async(userID:number):Promise<boolean> => { //Note: Database Reinforces Key constrains
    log.db(`DELETE USER attempted: userID:${userID}`);

    const response:CommandResponseType = await command('DELETE FROM user WHERE userID = ?;', [userID]);

    return ((response !== undefined) && (response.affectedRows === 1));
}

export const DB_UNIQUE_USER_EXISTS = async(filterMap:Map<string, any>, validateAllFields:boolean = true):Promise<Boolean|undefined> => { //(ALL columns and values are case insensitive)
    //Validate Columns prior to Query | filter to only test valid columns
    const columnsLowerCase:string[] = USER_TABLE_COLUMNS.map(c => c.toLowerCase());
    const validFieldMap:Map<string, any> = new Map();  
    
    const userIDEntry:[string, any]|undefined = Array.from(filterMap.entries()).find(([k,v]) => k.toLowerCase() === 'userid');
    const userID:number = (userIDEntry !== undefined) ? userIDEntry[1] as number : -1;
    filterMap.delete((userIDEntry !== undefined) ? userIDEntry[0] : '');

    //Map keys to valid case columns and lowercase values
    Array.from(filterMap.entries()).filter(([k,v]) => (k.toLowerCase() !== 'userid')).forEach(([k,v]) => {
        const columnIndex:number = columnsLowerCase.indexOf(k.toLowerCase());
        if(columnIndex >= 0) validFieldMap.set(USER_TABLE_COLUMNS[columnIndex], v.toLowerCase());
    });

    //Invalid Request
    if(validFieldMap.size === 0 || (validateAllFields && filterMap.size !== validFieldMap.size)) return undefined;

    let preparedColumns:string = '( ' + Array.from(validFieldMap.keys()).map((key)=> `LOWER( ${key} ) = ?`).join(' OR ') + ' )';
    const valueList:any[] = Array.from(validFieldMap.values());

    //userID query excludes that profile for edit features | default is -1 above
    preparedColumns += ` AND ( userID != ? )`; 
    valueList.push(userID);

    const result:CommandResponseType = await command(`SELECT COUNT(*) FROM user WHERE ${preparedColumns};`, valueList); 
    
    if(result[0] !== undefined && result[0]['COUNT(*)'] !== undefined && result[0]['COUNT(*)'] as number > 1)
        log.error(`Multiple Accounts Detected with matching fields`, JSON.stringify(validFieldMap));

    return (result[0] !== undefined && result[0]['COUNT(*)'] !== undefined && result[0]['COUNT(*)'] as number > 0);
}

/**********************
 *  USER ROLE QUERIES
 **********************/
export const DB_IS_USER_ROLE = async({userID, userRole}:{userID:number, userRole:DATABASE_USER_ROLE_ENUM}):Promise<Boolean> => {   
    const rows = await execute('SELECT * ' + 'FROM user '
    + 'LEFT JOIN user_role ON user_role.userID = user.userID '
    + 'LEFT JOIN user_role_defined ON user_role_defined.userRoleID = user_role.userRoleID '
    + `WHERE user.userID = ? AND user_role_defined.userRole = ?;`, [userID, userRole]); 

    return (rows.length === 1);
}

export const DB_IS_ANY_USER_ROLE = async({userID, userRoleList}:{userID:number, userRoleList:DATABASE_USER_ROLE_ENUM[]}):Promise<Boolean> => {   

    if(userRoleList === undefined || userRoleList.length === 0) return false;

    const preparedColumns:string = '( ' + userRoleList.map((key)=> `user_role_defined.userRole = ?`).join(' OR ') + ' )';

    const rows = await execute('SELECT * ' + 'FROM user '
    + 'LEFT JOIN user_role ON user_role.userID = user.userID '
    + 'LEFT JOIN user_role_defined ON user_role_defined.userRoleID = user_role.userRoleID '
    + `WHERE user.userID = ? AND ${preparedColumns}`, [userID, ...userRoleList]); 

    return (rows.length >= 1);
}

export const DB_SELECT_USER_ROLES = async(userID:number):Promise<RoleEnum[]> => {
    const rows = await execute('SELECT user_role_defined.userRole ' 
        + 'FROM user_role, user_role_defined '
        + 'WHERE user_role.userRoleID = user_role_defined.userRoleID '
        + 'AND user_role.userID = ?;', [userID]);

    //Parse user roles; only pass on server supported roles
    const validRoles = [];
    rows.forEach((row) => {
        if(Object.values(RoleEnum).includes(row.userRole)) validRoles.push(RoleEnum[row.userRole]);
        else log.db('Invalid Role, Not in Server Types', userID, row, JSON.stringify(Object.values(RoleEnum)));        
    });
    return validRoles;
}

export const DB_INSERT_USER_ROLE = async({userID, email, userRoleList}:{userID?:number, email?:string, userRoleList:DATABASE_USER_ROLE_ENUM[]}):Promise<boolean> => {
    const response:CommandResponseType = await command('INSERT INTO user_role ( userID, userRoleID ) VALUES '
    + userRoleList.map(() => `( ${(userID === undefined) ? '(SELECT user.userID FROM user WHERE user.email = ? )' : '?'} , `
    + '(SELECT user_role_defined.userRoleID FROM user_role_defined WHERE user_role_defined.userRole = ? ))').join(', ')
    + ';', userRoleList.flatMap((role) => [userID || email, role]));

    return ((response !== undefined) && (response.affectedRows > 0));
}

export const DB_DELETE_USER_ROLE = async({userID, userRoleList}:{userID:number, userRoleList:DATABASE_USER_ROLE_ENUM[]}):Promise<boolean> => {    
    log.db(`DELETE USER ROLE attempted: userID:${userID}, userRoleList:${userRoleList}`);

    const response:CommandResponseType = (userRoleList === undefined) ? //Delete All Roles
    await command('DELETE FROM user_role WHERE user_role.userID = ? ;', [userID])

    : await command('DELETE FROM user_role '
    + 'WHERE user_role.userID = ? AND ( '
    +  userRoleList.map(() => `( user_role.userRoleID IN (SELECT userRoleID FROM user_role_defined WHERE user_role_defined.userRole = ? ))`).join(' OR ')
    + ' );', [userID, ...userRoleList]);

    return ((response !== undefined) && (response.affectedRows > 0));
}


/********************
 *  PARTNER QUERIES
 ********************/

export const DB_SELECT_USER_PARTNERS = async(userID:number):Promise<ProfileListItem[]> => { //TODO Query partner table
    const rows = await execute('SELECT user.userID, user.firstName, user.displayName, user.image ' + 'FROM user ORDER BY modifiedDT DESC LIMIT 3;', []);

    return [...rows.map(row => ({userID: row.userID || -1, firstName: row.firstName || '', displayName: row.displayName || '', image: row.image || ''}))];
}


/* SELECT ALL USERS */
export const DB_SELECT_CONTACTS = async(userID:number):Promise<ProfileListItem[]> => { //TODO Query: Filter accordingly to include: Partners, members of circles, circle leader of circles, all admin
    const rows = await execute('SELECT DISTINCT user.userID, user.firstName, user.displayName, user.image ' + 'FROM user ORDER BY userID < 10 DESC, modifiedDT DESC LIMIT 15;', []);

    return [...rows.map(row => ({userID: row.userID || -1, firstName: row.firstName || '', displayName: row.displayName || '', image: row.image || ''}))];
}


//TODO TEMPORARY FOR FRONT-END DEBUGGING
export const DB_SELECT_CREDENTIALS = async():Promise<CredentialProfile[]> => {
    //Query User and max userRole
    const rows = await query('SELECT tbl.userID, tbl.displayName, tbl.email, tbl.passwordHash, userRole ' + 'FROM ( '
        + '( SELECT user.userID, user.displayName, user.email, user.passwordHash ' + 'FROM user '
        + 'WHERE user.userID < 10 ) '
        + 'UNION ALL '
        + '( SELECT user.userID, user.displayName, user.email, user.passwordHash ' + 'FROM user '
        + 'WHERE user.userID > 10 ' + 'ORDER BY modifiedDT DESC ' + 'LIMIT 10 ) '
        + ') as tbl '
        + 'LEFT JOIN user_role ON user_role.userID = tbl.userID '
        + 'AND user_role.userRoleID = ( SELECT min( userRoleID ) FROM user_role WHERE tbl.userID = user_role.userID ) '
        + 'LEFT JOIN user_role_defined ON user_role_defined.userRoleID = user_role.userRoleID;');

    return [...rows.map(row => ({userID: row.userID || -1, 
            displayName: row.displayName || '', 
            userRole: row.userRole || RoleEnum.STUDENT,
            email: row.email || '',
            passwordHash: row.passwordHash || '',
        }))];
}



/**********************************
 *  USER SEARCH & CACHE QUERIES
 **********************************/
//https://code-boxx.com/mysql-search-exact-like-fuzzy/
export const DB_SELECT_USER_SEARCH = async({searchTerm, columnList, excludeStudent = false, searchInactive = false}:{searchTerm:string, columnList:string[], excludeStudent?:boolean, searchInactive?:boolean}):Promise<ProfileListItem[]> => {
    const rows = excludeStudent ?
        await execute('SELECT user.userID, user.firstName, user.displayName, user.image ' + 'FROM user '
            + 'LEFT JOIN user_role ON user_role.userID = user.userID AND user_role.userRoleID = ( SELECT min( userRoleID ) FROM user_role WHERE user.userID = user_role.userID ) '
            + `WHERE ${searchInactive ? 'userInfo.isActive = false AND' : ''} `
            + `user_role.userRoleID < ( SELECT userRoleID FROM user_role_defined WHERE userRole = 'STUDENT' ) AND `
            + `${(columnList.length == 1) ? columnList[0] : `CONCAT_WS( ${columnList.join(`, ' ', `)} )`} LIKE ? `
            + 'LIMIT 30;', [`%${searchTerm}%`])
            
        : await execute('SELECT user.userID, user.firstName, user.displayName, user.image ' + 'FROM user '
            + `WHERE ${searchInactive ? 'userInfo.isActive = false AND' : ''} `
            + `${(columnList.length == 1) ? columnList[0] : `CONCAT_WS( ${columnList.join(`, ' ', `)} )`} LIKE ? `
            + 'LIMIT 30;', [`%${searchTerm}%`]);
 
    return [...rows.map(row => ({userID: row.userID || -1, firstName: row.firstName || '', displayName: row.displayName || '', image: row.image || ''}))];
}

export const DB_SELECT_USER_SEARCH_CACHE = async(searchTerm:string, searchFilter:UserSearchFilterEnum):Promise<ProfileListItem[]> => {

    const rows = await execute('SELECT stringifiedProfileItemList ' + 'FROM user_search_cache '
        + 'WHERE searchTerm = ? AND searchFilter = ?;', [searchTerm, searchFilter]);

    try {
        const stringifiedList:string = rows[0].stringifiedProfileItemList;    
        return JSON.parse(stringifiedList);
        
    } catch(error) {
        log.db('DB_SELECT_USER_SEARCH_CACHE :: Failed to Parse JSON List', rows[0]);
        return [];
    }
}

//Updates on Duplicate | Only caches searches including students
export const DB_INSERT_USER_SEARCH_CACHE = async({searchTerm, searchFilter, userList}:{searchTerm:string, searchFilter:UserSearchFilterEnum, userList:ProfileListItem[]}):Promise<boolean> => {

    const response:CommandResponseType = await command(`INSERT INTO user_search_cache ( searchTerm, searchFilter, stringifiedProfileItemList ) `
    + `VALUES ( ?, ?, ? ) ON DUPLICATE KEY UPDATE searchTerm=VALUES(searchTerm) , searchFilter=VALUES(searchFilter), stringifiedProfileItemList=VALUES(stringifiedProfileItemList);`,
     [searchTerm, searchFilter, JSON.stringify(userList)]); 
    
    return ((response !== undefined) && (response.affectedRows === 1));
}

export const DB_DELETE_USER_SEARCH_CACHE = async(searchTerm:string, searchFilter:UserSearchFilterEnum):Promise<boolean> => {

    const response:CommandResponseType = await command('DELETE FROM user_search_cache WHERE searchTerm = ? AND searchFilter = ?;', [searchTerm, searchFilter]);

    return ((response !== undefined) && (response.affectedRows === 1));
}

export const DB_FLUSH_USER_SEARCH_CACHE_ADMIN = async():Promise<boolean> => {
    log.db('Flushing user_search_cache Table');

    const response:CommandResponseType = await command('DELETE FROM user_search_cache;', []);

    return ((response !== undefined) && (response.affectedRows > 0));
}

//TODO reverse search ???
export const DB_DELETE_USER_SEARCH_REVERSE_CACHE = async(filterList:UserSearchFilterEnum[], valueList:string[]):Promise<boolean> => {


    const response:CommandResponseType = await command('DELETE FROM user_search_cache '
    + 'WHERE ' + `${`CONCAT_WS( ${valueList.join(`, ' ', `)} )`} LIKE ? `, 
    []);
 
    return ((response !== undefined) && (response.affectedRows > 0));
}
