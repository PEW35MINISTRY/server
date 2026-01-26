import * as log from '../../10-utilities/logging/log.mjs';
import USER from '../../1-models/userModel.mjs';
import { generateJWTRequest, JwtSearchRequest } from '../../../1-api/api-types.mjs';
import { LIST_LIMIT, SearchType } from '../../../0-assets/field-sync/input-config-sync/search-config.mjs';
import { searchList } from '../../../1-api/api-search-utilities.mjs';
import { CircleListItem } from '../../../0-assets/field-sync/api-type-sync/circle-types.mjs';
import { PartnerListItem, ProfileListItem } from '../../../0-assets/field-sync/api-type-sync/profile-types.mjs';
import { CircleStatusEnum } from '../../../0-assets/field-sync/input-config-sync/circle-field-config.mjs';
import { GENERAL_USER_ROLES, PartnerStatusEnum, RoleEnum, UserSearchRefineEnum } from '../../../0-assets/field-sync/input-config-sync/profile-field-config.mjs';
import { CommandResponseType, DATABASE_CIRCLE_STATUS_ENUM, DATABASE_MODEL_SOURCE_ENVIRONMENT_ENUM, DATABASE_PARTNER_STATUS_ENUM, DATABASE_USER, DATABASE_USER_ROLE_ENUM, USER_TABLE_COLUMNS, USER_TABLE_COLUMNS_EDIT, USER_TABLE_COLUMNS_REQUIRED } from '../database-types.mjs';
import { batch, command, execute, validateColumns } from '../database.mjs';
import { DB_SELECT_CIRCLE_ANNOUNCEMENT_ALL_CIRCLES, DB_SELECT_CIRCLE_USER_IDS, DB_SELECT_MEMBERS_OF_ALL_LEADER_MANAGED_CIRCLES, DB_SELECT_USER_CIRCLES } from './circle-queries.mjs';
import { DB_SELECT_USER_CONTENT_LIST } from './content-queries.mjs';
import { DB_SELECT_PARTNER_LIST } from './partner-queries.mjs';
import { DB_SELECT_PRAYER_REQUEST_EXPIRED_REQUESTOR_LIST, DB_SELECT_PRAYER_REQUEST_REQUESTOR_LIST, DB_SELECT_PRAYER_REQUEST_USER_LIST } from './prayer-request-queries.mjs';
import { getModelSourceEnvironment } from '../../10-utilities/utilities.mjs';
import CIRCLE_ANNOUNCEMENT from '../../1-models/circleAnnouncementModel.mjs';


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
const validateUserColumns = (inputMap:Map<string, any>, forEditing:boolean, includesRequired:boolean):boolean => 
    validateColumns(inputMap, includesRequired, forEditing ? USER_TABLE_COLUMNS_EDIT : USER_TABLE_COLUMNS, USER_TABLE_COLUMNS_REQUIRED);

    
/*************************
 *  USER PROFILE QUERIES
 *************************/
export const DB_SELECT_USER = async(filterMap:Map<string, any>, includeUserRole:boolean = true):Promise<USER> => {
    //Validate Columns prior to Query
    if(filterMap.size === 0 || !validateUserColumns(filterMap, false, false)) {
        log.db('Query Rejected: DB_SELECT_USER; invalid column names', JSON.stringify(Array.from(filterMap.keys())));
        return new USER();
    }

    //Assemble filterMap
    const preparedColumns:string = Array.from(filterMap.keys()).map((key, field)=> `user.${key} = ?`).join(' AND ');

    //Query User and max userRole
    const rows = includeUserRole ?
        await execute('SELECT user.*, user_role_defined.userRole ' + 'FROM user '
            + 'LEFT JOIN user_role ON user_role.userID = user.userID '
            + 'AND user_role.userRoleID = ( SELECT min( userRoleID ) FROM user_role WHERE user.userID = user_role.userID ) '
            + 'LEFT JOIN user_role_defined ON user_role_defined.userRoleID = user_role.userRoleID '
            + `WHERE ${preparedColumns};`, Array.from(filterMap.values()))
        
        : await execute('SELECT user.* ' + 'FROM user '
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
    if(filterMap.size === 0 || !validateUserColumns(filterMap, false, false)) {
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
    return await DB_POPULATE_USER_PROFILE(USER.constructByDatabase(rows[0] as DATABASE_USER));
}

//Assembles recipientMap for sending emails
export const DB_SELECT_USER_BATCH_EMAIL_MAP = async(userIDList:number[]):Promise<Map<number, string>> => {
    if(userIDList.length === 0 || !Array.isArray(userIDList) || !userIDList.every(id => typeof id === 'number')) {
        log.db('DB_SELECT_USER_BATCH_EMAIL_MAP Invalid userIDList:', JSON.stringify(userIDList));
        return new Map();
    }

    const placeholders = userIDList.map(() => '?').join(',');
    const rows = await execute(`SELECT userID, email FROM user WHERE userID IN (${placeholders})`, userIDList);
    return rows.reduce((map, row) => map.set(row.userID ?? -1, row.email ?? ''), new Map<number, string>());
}


//POPULATE FULL USER PROFILE: including roleList, circleList, partnerList, prayerRequestList, contactList
export const DB_POPULATE_USER_PROFILE = async(user:USER):Promise<USER> => {
    if(!user.isValid || user.userID <= 0)
        return user;

    /* Role List */
    user.userRoleList = await DB_SELECT_USER_ROLES(user.userID);

    /* Circle Memberships */
    const allCircleList:CircleListItem[] = await DB_SELECT_USER_CIRCLES(user.userID);  //Includes all statuses
    user.circleList = allCircleList.filter(circle => circle.status === CircleStatusEnum.MEMBER || circle.status === CircleStatusEnum.LEADER);
    user.circleRequestList = allCircleList.filter(circle => circle.status === CircleStatusEnum.REQUEST);
    user.circleInviteList = allCircleList.filter(circle => circle.status === CircleStatusEnum.INVITE);
    user.circleAnnouncementList = await DB_SELECT_CIRCLE_ANNOUNCEMENT_ALL_CIRCLES(user.userID);

    //TEMPORARY Welcome Message
    if(user.createdDT && (new Date().getTime() < (user.createdDT.getTime() + (1000 * 60 * 60 * 24 * 3)))) {
        const welcome:CIRCLE_ANNOUNCEMENT = new CIRCLE_ANNOUNCEMENT();
        welcome.message = 'WELCOME TO EP!\nHelp? -> support@encouragingprayer.org';
        welcome.startDate = new Date();
        welcome.endDate = new Date(Date.now() + (1000 * 60 * 60 * 24));
        user.circleAnnouncementList.unshift(welcome);
    }

    /* Partnerships */
    const allPartnerList:PartnerListItem[] = await DB_SELECT_PARTNER_LIST(user.userID);
    user.partnerList = allPartnerList.filter(partner => (partner.status === PartnerStatusEnum.PARTNER));
    user.partnerPendingUserList = allPartnerList.filter(partner => (partner.status === PartnerStatusEnum.PENDING_CONTRACT_USER || partner.status === PartnerStatusEnum.PENDING_CONTRACT_BOTH));
    user.partnerPendingPartnerList = allPartnerList.filter(partner => (partner.status === PartnerStatusEnum.PENDING_CONTRACT_PARTNER));

    /* Prayer Requests */
    user.newPrayerRequestList = await DB_SELECT_PRAYER_REQUEST_USER_LIST(user.userID, 15); //recipient, dashboard preview
    user.ownedPrayerRequestList = await DB_SELECT_PRAYER_REQUEST_REQUESTOR_LIST(user.userID, false, 15); //Not resolved (pending) for which user is the Requestor
    user.expiringPrayerRequestList = await DB_SELECT_PRAYER_REQUEST_EXPIRED_REQUESTOR_LIST(user.userID, 5); // Owned prayer requests that are long term but past their set expiration date
    user.recommendedContentList = await DB_SELECT_USER_CONTENT_LIST(user.userID, 5);

    //Query via Search to use cached list
    // user.contactList = await searchList(SearchType.CONTACT, generateJWTRequest(user.userID, user.getHighestRole()) as JwtSearchRequest) as ProfileListItem[];
    user.contactList = await DB_SELECT_PARTNER_LIST(user.userID, DATABASE_PARTNER_STATUS_ENUM.PARTNER);
    if(user.isRole(RoleEnum.CIRCLE_LEADER)) user.profileAccessList = await DB_SELECT_MEMBERS_OF_ALL_LEADER_MANAGED_CIRCLES(user.userID, true);

    return user;
}


//Insert New Profile
export const DB_INSERT_USER = async(fieldMap:Map<string, any>):Promise<{success:boolean, userID:number}> => {
    //Validate Columns prior to Query
    if(fieldMap.size === 0 || !validateUserColumns(fieldMap, true, true)) {
        log.db('Query Rejected: DB_INSERT_USER; invalid column names', JSON.stringify(Array.from(fieldMap.keys())));
        return {success:false, userID:-1};
    }

    const preparedColumns:string = Array.from(fieldMap.keys()).map((key)=> `${key}`).join(', ');
    const preparedValues:string = Array.from(fieldMap.values()).map((value)=> `?`).join(', ');

    const response:CommandResponseType = await command(`INSERT INTO user ( ${preparedColumns} ) VALUES ( ${preparedValues} );`, Array.from(fieldMap.values())); 
    
    return {success:((response !== undefined) && (response.affectedRows === 1)), userID:response?.insertId || -1};
}

//Update Existing Profile
export const DB_UPDATE_USER = async(userID:number, fieldMap:Map<string, any>):Promise<boolean> => {
    //Validate Columns prior to Query
    if(fieldMap.size === 0 || !validateUserColumns(fieldMap, true, false)) {
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


//Checks all users in database, regardless of user.modelSourceEnvironment
export const DB_UNIQUE_USER_EXISTS = async(filterMap:Map<string, any>, validateAllFields:boolean = true):Promise<boolean|undefined> => { //(ALL columns and values are case insensitive)
    //Validate Columns prior to Query | filter to only test valid columns
    const columnsLowerCase:string[] = USER_TABLE_COLUMNS_REQUIRED.map(c => c.toLowerCase());
    const validFieldMap:Map<string, any> = new Map();  
    
    const userIDEntry:[string, any]|undefined = Array.from(filterMap.entries()).find(([k,v]) => k.toLowerCase() === 'userid');
    const userID:number = (userIDEntry !== undefined) ? userIDEntry[1] as number : -1;
    filterMap.delete((userIDEntry !== undefined) ? userIDEntry[0] : '');

    //Map keys to valid case columns and lowercase values
    Array.from(filterMap.entries()).filter(([k,v]) => (k.toLowerCase() !== 'userid')).forEach(([k,v]) => {
        const columnIndex:number = columnsLowerCase.indexOf(k.toLowerCase());
        if(columnIndex >= 0) validFieldMap.set(USER_TABLE_COLUMNS_REQUIRED[columnIndex], v.toLowerCase());
    });

    //Invalid Request
    if(validFieldMap.size === 0 || (validateAllFields && filterMap.size !== validFieldMap.size)) return undefined;

    let preparedColumns:string = '( ' + Array.from(validFieldMap.keys()).map((key)=> `LOWER( ${key} ) = ?`).join(' OR ') + ' )';
    const valueList:any[] = Array.from(validFieldMap.values());

    //userID query excludes that profile for edit features | default is -1 above
    preparedColumns += ` AND ( userID != ? )`; 
    valueList.push(userID);

    const result:CommandResponseType = await command(`SELECT COUNT(*) FROM user WHERE ${preparedColumns};`, valueList); 

    if(result === undefined) return true;    
    else if(result[0] !== undefined && result[0]['COUNT(*)'] !== undefined && result[0]['COUNT(*)'] as number > 1)
        log.warn(`Multiple Accounts Detected with matching fields`, JSON.stringify(validFieldMap));

    return (result[0] !== undefined && result[0]['COUNT(*)'] !== undefined && result[0]['COUNT(*)'] as number > 0);
}

/**********************
 *  USER ROLE QUERIES
 **********************/
export const DB_IS_USER_ROLE = async(userID:number, userRole:DATABASE_USER_ROLE_ENUM, useDefaultUser:boolean = false):Promise<boolean> => {   
    const rows = await execute('SELECT * ' + 'FROM user '
    + 'LEFT JOIN user_role ON user_role.userID = user.userID '
    + 'LEFT JOIN user_role_defined ON user_role_defined.userRoleID = user_role.userRoleID '
    + 'WHERE user.userID = ? '
    + `AND (user_role_defined.userRole = ? OR (user_role.userRoleID IS NULL AND ? = TRUE AND ? = 'USER'));`, 
        [userID, userRole, useDefaultUser, userRole]); 

    return (rows.length === 1);
}

export const DB_IS_ANY_USER_ROLE = async(userID:number, userRoleList:DATABASE_USER_ROLE_ENUM[], useDefaultUser:boolean = true):Promise<boolean> => {   

    if(userRoleList === undefined || userRoleList.length === 0) return false;

    const preparedColumns:string = '( ' + userRoleList.map((key)=> `user_role_defined.userRole = ?`).join(' OR ') + ' )';

    const rows = await execute('SELECT * ' + 'FROM user '
    + 'LEFT JOIN user_role ON user_role.userID = user.userID '
    + 'LEFT JOIN user_role_defined ON user_role_defined.userRoleID = user_role.userRoleID '
    + 'WHERE user.userID = ? '
    + `AND (${preparedColumns} OR (user_role.userRoleID IS NULL AND ? = TRUE));`,
        [userID, ...userRoleList, useDefaultUser]); 

    return (rows.length >= 1);
}

export const DB_SELECT_USER_ROLES = async(userID:number, defaultUserRole:boolean = true):Promise<RoleEnum[]> => {
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
    return ((validRoles.length === 0) && defaultUserRole) ? [RoleEnum.USER] : validRoles;
}

export const DB_INSERT_USER_ROLE = async({userID, email, userRoleList}:{userID?:number, email?:string, userRoleList:DATABASE_USER_ROLE_ENUM[]}):Promise<boolean> => {
    const response:CommandResponseType = await command('INSERT INTO user_role ( userID, userRoleID ) VALUES '
    + userRoleList.map(() => `( ${(userID === undefined) ? '(SELECT user.userID FROM user WHERE user.email = ? )' : '?'} , `
    + '(SELECT user_role_defined.userRoleID FROM user_role_defined WHERE user_role_defined.userRole = ? ))').join(', ')
    + ' ON DUPLICATE KEY UPDATE userRoleID = VALUES(userRoleID);',
    userRoleList.flatMap((role) => [userID || email, role]));

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

    return (response !== undefined);  //Success on non-error
}


/**********************************
 *  USER SEARCH & CACHE QUERIES
 **********************************/
const INACTIVE_USERS: RoleEnum[] = [RoleEnum.INACTIVE, RoleEnum.REPORTED];
//https://code-boxx.com/mysql-search-exact-like-fuzzy/
export const DB_SELECT_USER_SEARCH = async({searchTerm, columnList, excludeGeneralUsers = false, searchInactive = false, allSourceEnvironments = false, limit = LIST_LIMIT}:{searchTerm:string, columnList:string[], excludeGeneralUsers?:boolean, searchInactive?:boolean, allSourceEnvironments?:boolean, limit?:number}):Promise<ProfileListItem[]> => {
    //Validate Columns prior to Query
    if(!validateUserColumns(new Map(columnList.map(column => [column, -1])), false, false)) {
        log.error('DB_SELECT_USER_SEARCH rejected for invalid columns', columnList);
        return [];
    }

    const rows = await execute('SELECT user.userID, user.firstName, user.displayName, user.image ' + 'FROM user '
        + 'LEFT JOIN user_role ON user_role.userID = user.userID AND user_role.userRoleID = ( SELECT min( userRoleID ) FROM user_role WHERE user.userID = user_role.userID ) '
        + 'WHERE '
        + (searchInactive
            ? 'user_role.userRoleID IN ( '
            + '    SELECT userRoleID FROM user_role_defined '
            + `    WHERE userRole IN (${INACTIVE_USERS.map(r => `'${r}'`).join(', ')}) `
            + ') AND '
            : ''
        )
        + (!allSourceEnvironments
            ? '( '
                + `user.modelSourceEnvironment = '${getModelSourceEnvironment()}' `
                    + 'OR ( '
                        + 'CASE '
                            + `WHEN user.modelSourceEnvironment = '${DATABASE_MODEL_SOURCE_ENVIRONMENT_ENUM.DEVELOPMENT}' THEN user.modelSourceEnvironment IN ('${DATABASE_MODEL_SOURCE_ENVIRONMENT_ENUM.MOCK}') `
                            + `WHEN user.modelSourceEnvironment = '${DATABASE_MODEL_SOURCE_ENVIRONMENT_ENUM.MOCK}' THEN user.modelSourceEnvironment IN ('${DATABASE_MODEL_SOURCE_ENVIRONMENT_ENUM.DEVELOPMENT}', '${DATABASE_MODEL_SOURCE_ENVIRONMENT_ENUM.INTERNAL}') `
                            + `WHEN user.modelSourceEnvironment = '${DATABASE_MODEL_SOURCE_ENVIRONMENT_ENUM.INTERNAL}' THEN user.modelSourceEnvironment IN ('${DATABASE_MODEL_SOURCE_ENVIRONMENT_ENUM.MOCK}') `
                            + 'ELSE FALSE '
                        + 'END '
                    + ') '
                + ') AND '
            : '')
        + (excludeGeneralUsers
            ? 'EXISTS ( '
                + 'SELECT 1 FROM user_role '
                + 'JOIN user_role_defined ON user_role.userRoleID = user_role_defined.userRoleID '
                + 'WHERE user_role.userID = user.userID '
                + `AND user_role_defined.userRole NOT IN (${GENERAL_USER_ROLES.map(r => `'${r}'`).join(', ')}) `
                + ') AND '
            : '')
        + '('
            + columnList.map(column => `LOWER(user.${column}) LIKE LOWER(CONCAT("%", ?, "%"))`).join(' OR ')
        + ') '
        + `ORDER BY FIELD( user.modelSourceEnvironment, '${DATABASE_MODEL_SOURCE_ENVIRONMENT_ENUM.PRODUCTION}', '${DATABASE_MODEL_SOURCE_ENVIRONMENT_ENUM.INTERNAL}', '${DATABASE_MODEL_SOURCE_ENVIRONMENT_ENUM.DEVELOPMENT}', '${DATABASE_MODEL_SOURCE_ENVIRONMENT_ENUM.MOCK}' ), `
        + 'user.modifiedDT DESC '
        + `LIMIT ${limit};`, [...Array(columnList.length).fill(`${searchTerm}`)]);
 
    return [...rows.map(row => ({userID: row.userID || -1, firstName: row.firstName || '', displayName: row.displayName || '', image: row.image || ''}))];
}

//Supports saving empty lists, returns undefined on error or not found
export const DB_SELECT_USER_SEARCH_CACHE = async(searchTerm:string, searchRefine:UserSearchRefineEnum):Promise<ProfileListItem[]|undefined> => {

    const rows = await execute('SELECT stringifiedProfileItemList ' + 'FROM user_search_cache '
        + 'WHERE searchTerm = ? AND searchRefine = ? AND modelSourceEnvironment = ?;', [searchTerm, searchRefine, getModelSourceEnvironment()]);

    if(rows.length === 0) return undefined;

    try {
        const stringifiedList:string = rows[0].stringifiedProfileItemList;    
        return JSON.parse(stringifiedList);
        
    } catch(error) {
        log.db('DB_SELECT_USER_SEARCH_CACHE :: Failed to Parse JSON List', rows[0]);
        return undefined;
    }
}

//Updates on Duplicate | Only caches searches including users with 'USER' Role
export const DB_INSERT_USER_SEARCH_CACHE = async({searchTerm, searchRefine, userList}:{searchTerm:string, searchRefine:UserSearchRefineEnum, userList:ProfileListItem[]}):Promise<boolean> => {

    const response:CommandResponseType = await command(`INSERT INTO user_search_cache ( searchTerm, searchRefine, stringifiedProfileItemList, modelSourceEnvironment ) `
    + `VALUES ( ?, ?, ?, ? ) ON DUPLICATE KEY UPDATE searchTerm=VALUES(searchTerm) , searchRefine=VALUES(searchRefine), stringifiedProfileItemList=VALUES(stringifiedProfileItemList), modelSourceEnvironment=VALUES(modelSourceEnvironment);`,
     [searchTerm, searchRefine, JSON.stringify(userList), getModelSourceEnvironment()]); 
    
    return ((response !== undefined) && (response.affectedRows > 0));
}

export const DB_DELETE_USER_SEARCH_CACHE = async(searchTerm:string, searchRefine:UserSearchRefineEnum):Promise<boolean> => {
    log.event(`Deleting Search User Cache for searchTerm: ${searchTerm}`);

    const response:CommandResponseType = await command('DELETE FROM user_search_cache WHERE searchTerm = ? AND searchRefine = ? AND modelSourceEnvironment = ?;', [searchTerm, searchRefine, getModelSourceEnvironment()]);

    return ((response !== undefined) && (response.affectedRows > 0));
}

export const DB_FLUSH_USER_SEARCH_CACHE_ADMIN = async():Promise<boolean> => {
    log.db('Flushing user_search_cache Table');

    const response:CommandResponseType = await command('DELETE FROM user_search_cache;', []);

    return ((response !== undefined) && (response.affectedRows > 0));
}

//TODO reverse search ???
export const DB_DELETE_USER_SEARCH_REVERSE_CACHE = async(filterList:UserSearchRefineEnum[], valueList:string[]):Promise<boolean> => {


    const response:CommandResponseType = await command('DELETE FROM user_search_cache '
    + 'WHERE ' + `${`CONCAT_WS( ${valueList.join(`, ' ', `)} )`} LIKE ? `, 
    []);
 
    return ((response !== undefined) && (response.affectedRows > 0));
}



/**********************************
 *  contact SEARCH & CACHE QUERIES
 **********************************/
/* SELECT Partners, Co-Circle Members, Circle Leaders */
export const DB_SELECT_CONTACT_LIST = async(userID:number, allSourceEnvironments = false, limit:number = LIST_LIMIT):Promise<ProfileListItem[]> => {
   
    const rows = await execute(
        'WITH USER_MODEL_SOURCE AS ( '
        + '    SELECT modelSourceEnvironment '
        + '    FROM user '
        + '    WHERE userID = ? '
        + '), '
        + 'CIRCLE_ID_LIST AS ( '
        + '    SELECT circle_user.circleID '
        + '    FROM circle_user '
        + '    WHERE circle_user.userID = ? '
        + `      AND circle_user.status = 'MEMBER'`
        + ') '
        + 'SELECT DISTINCT user.userID, user.firstName, user.displayName, user.image '
        + 'FROM user '
        + `LEFT JOIN circle_user ON user.userID = circle_user.userID `
        + 'LEFT JOIN circle ON circle_user.circleID = circle.circleID '
        + 'LEFT JOIN partner ON ( '
        + '    (user.userID = partner.userID AND partner.partnerID = ? ) '
        + '    OR (user.userID = partner.partnerID AND partner.userID = ? ) '
        + `) AND partner.status = 'PARTNER' `
        + 'WHERE user.userID != ? '
        + 'AND ( '
        + '    circle_user.circleID IN ( '
        + '        SELECT circleID '
        + '        FROM CIRCLE_ID_LIST '
        + '    ) '
        + '    OR user.userID IN ( '
        + '        SELECT circle.leaderID '
        + '        FROM circle '
        + '        WHERE circle.circleID IN ( '
        + '            SELECT circleID '
        + '            FROM CIRCLE_ID_LIST '
        + '        ) '
        + '    ) '
        + '    OR ( '
        + '        ( user.userID = partner.userID '
        + '          OR user.userID = partner.partnerID ) '
        + `        AND partner.status = 'PARTNER' `
        + '    ) '
        + `${allSourceEnvironments ? '' :
            `${'    AND ( '
                + '        user.modelSourceEnvironment = (SELECT modelSourceEnvironment FROM USER_MODEL_SOURCE) '
                + '        OR ( '
                + '            CASE '
                + `                WHEN (SELECT modelSourceEnvironment FROM USER_MODEL_SOURCE) = '${DATABASE_MODEL_SOURCE_ENVIRONMENT_ENUM.DEVELOPMENT}' THEN user.modelSourceEnvironment IN ('${DATABASE_MODEL_SOURCE_ENVIRONMENT_ENUM.DEVELOPMENT}', '${DATABASE_MODEL_SOURCE_ENVIRONMENT_ENUM.MOCK}') `
                + `                WHEN (SELECT modelSourceEnvironment FROM USER_MODEL_SOURCE) = '${DATABASE_MODEL_SOURCE_ENVIRONMENT_ENUM.MOCK}' THEN user.modelSourceEnvironment IN ('${DATABASE_MODEL_SOURCE_ENVIRONMENT_ENUM.DEVELOPMENT}', '${DATABASE_MODEL_SOURCE_ENVIRONMENT_ENUM.INTERNAL}') `
                + `                WHEN (SELECT modelSourceEnvironment FROM USER_MODEL_SOURCE) = '${DATABASE_MODEL_SOURCE_ENVIRONMENT_ENUM.INTERNAL}' THEN user.modelSourceEnvironment = '${DATABASE_MODEL_SOURCE_ENVIRONMENT_ENUM.MOCK}' `
                + '                ELSE false '
                + '            END '
                + '        ) '
                + '    ) '
            }`
        } ) `
        + 'ORDER BY '
        + '    CASE '
        + '        WHEN partner.userID IS NOT NULL OR partner.partnerID IS NOT NULL THEN 1 '
        + '        WHEN user.userID IN ( '
        + '            SELECT circle.leaderID '
        + '            FROM circle '
        + '            WHERE circle.circleID IN ( '
        + '                SELECT circleID '
        + '                FROM CIRCLE_ID_LIST '
        + '            ) '
        + '        ) THEN 2 '
        + '        ELSE 3 '
        + '    END ASC, '
        + `    FIELD( user.modelSourceEnvironment, '${DATABASE_MODEL_SOURCE_ENVIRONMENT_ENUM.PRODUCTION}', '${DATABASE_MODEL_SOURCE_ENVIRONMENT_ENUM.INTERNAL}', '${DATABASE_MODEL_SOURCE_ENVIRONMENT_ENUM.DEVELOPMENT}', '${DATABASE_MODEL_SOURCE_ENVIRONMENT_ENUM.MOCK}' ), `
        + '    user.modifiedDT DESC '
        + `LIMIT ${limit};`

    , [userID, userID, userID, userID, userID]);

    return [...rows.map(row => ({userID: row.userID || -1, firstName: row.firstName || '', displayName: row.displayName || '', image: row.image || ''}))];
}


//Supports saving empty lists, returns undefined on error or not found
export const DB_SELECT_CONTACT_CACHE = async(userID:number):Promise<ProfileListItem[]|undefined> => {

    const rows = await execute('SELECT stringifiedProfileItemList ' + 'FROM user_contact_cache '
        + 'WHERE userID = ?;', [userID]);

    if(rows.length === 0) return undefined;

    try {
        const stringifiedList:string = rows[0].stringifiedProfileItemList;    
        return JSON.parse(stringifiedList);
        
    } catch(error) {
        log.db('DB_SELECT_CONTACT_CACHE :: Failed to Parse JSON List', rows[0]);
        return undefined;
    }
}

//Updates on Duplicate | Only caches searches including users with 'USER' Role
export const DB_INSERT_CONTACT_CACHE = async({userID, userList}:{userID:number, userList:ProfileListItem[]}):Promise<boolean> => {

    const response:CommandResponseType = await command(`INSERT INTO user_contact_cache ( userID, stringifiedProfileItemList, modelSourceEnvironment ) `
        + `VALUES ( ?, ?, ? ) ON DUPLICATE KEY UPDATE userID=VALUES(userID), stringifiedProfileItemList=VALUES(stringifiedProfileItemList), modelSourceEnvironment=VALUES(modelSourceEnvironment);`,
     [userID, JSON.stringify(userList), getModelSourceEnvironment()]); 
    
    return ((response !== undefined) && (response.affectedRows > 0));
}

export const DB_DELETE_CONTACT_CACHE = async(userID:number):Promise<boolean> => {
    log.event(`Contact Cache Delete for user: ${userID}`);

    const response:CommandResponseType = await command('DELETE FROM user_contact_cache WHERE userID = ? AND modelSourceEnvironment = ?;', [ userID, getModelSourceEnvironment() ]);

    return ((response !== undefined) && (response.affectedRows > 0));
}

export const DB_DELETE_CONTACT_CACHE_BATCH = async(userIDList:number[]):Promise<boolean> => {
    if(userIDList.length === 0) {
        log.warn('Contact Cache Batch Delete: Empty List of Users');
        return false;
    }
    log.event('Contact Cache Batch Delete: ', `userIDList: ${JSON.stringify(userIDList)}`);
    const placeholderList = userIDList.map(() => '?').join(', ');

    const response:CommandResponseType = await command(`DELETE FROM user_contact_cache WHERE modelSourceEnvironment = ? AND userID IN (${placeholderList});`, [getModelSourceEnvironment(), ...userIDList]);

    return ((response !== undefined) && (response.affectedRows > 0));
}

export const DB_DELETE_CONTACT_CACHE_CIRCLE_MEMBERS = async(circleID:number):Promise<boolean> => {

    const memberIDList = await DB_SELECT_CIRCLE_USER_IDS(circleID, DATABASE_CIRCLE_STATUS_ENUM.MEMBER, true);

    log.event(`Contact Cache Delete for Members of Circle: ${circleID}`, `memberIDList: ${JSON.stringify(memberIDList)}`);
    return await DB_DELETE_CONTACT_CACHE_BATCH(memberIDList);
}

export const DB_DELETE_CONTACT_CACHE_BY_CIRCLE_BATCH = async(circleIDList:number[], userIDList:number[] = []): Promise<boolean> => {
    if(circleIDList.length === 0 && userIDList.length === 0) {
        log.warn('Contact Cache Batch Delete Circle: Empty List of Circles & Users');
        return false;
    }
    const allMemberIDLists = await Promise.all(
        circleIDList.map((circleID: number) => DB_SELECT_CIRCLE_USER_IDS(circleID, DATABASE_CIRCLE_STATUS_ENUM.MEMBER, true))
    );
    const uniqueUserIDs = Array.from(new Set([...allMemberIDLists.flat(), ...userIDList])); //Filter duplicates

    log.event('Contact Cache Batch Delete Circle: ', `userIDList: ${JSON.stringify(userIDList)}`, `circleIDList: ${JSON.stringify(circleIDList)}`, `allMemberIDList: ${JSON.stringify(allMemberIDLists)}`);
    return await DB_DELETE_CONTACT_CACHE_BATCH(uniqueUserIDs);
}

export const DB_FLUSH_CONTACT_CACHE_ADMIN = async():Promise<boolean> => {
    log.db('Flushing user_contact_cache Table');

    const response:CommandResponseType = await command('DELETE FROM user_contact_cache;', []);

    return ((response !== undefined) && (response.affectedRows > 0));
}


/*****************************
 * MOCK USER UTILITY QUERIES *
 *****************************/
export const DB_SELECT_USER_LIST_BY_SOURCE_ENVIRONMENT = async(sourceEnvironment:DATABASE_MODEL_SOURCE_ENVIRONMENT_ENUM, limit:number = LIST_LIMIT, maxCircleMemberships:number = LIST_LIMIT, maxSharedPrayerRequest = LIST_LIMIT):Promise<ProfileListItem[]> => {   
    const rows = await execute('SELECT user.*, ' 
        + 'COUNT(DISTINCT circle_user.circleID) AS circleCount, '
        + 'COUNT(DISTINCT prayer_request_recipient.prayerRequestID) AS requestCount '
        + 'FROM user '
        + 'LEFT JOIN circle_user ON user.userID = circle_user.userID '
        + 'LEFT JOIN prayer_request_recipient ON user.userID = prayer_request_recipient.userID '
        + 'WHERE modelSourceEnvironment = ? '
        + 'GROUP BY user.userID '
        + 'HAVING circleCount < ? '
        + '  AND requestCount < ? '
        + `ORDER BY ${(maxCircleMemberships <= maxSharedPrayerRequest) ? 'circleCount' : 'requestCount'} ASC, `
        + `${(maxCircleMemberships > maxSharedPrayerRequest) ? 'circleCount' : 'requestCount'} ASC, `
        + 'user.createdDT DESC '
        + `LIMIT ${limit};`,
    [sourceEnvironment, maxCircleMemberships, maxSharedPrayerRequest]); 

    return [...rows.map(row => ({userID: row.userID || -1, firstName: row.firstName || '', displayName: row.displayName || '', image: row.image || ''}))];
}
