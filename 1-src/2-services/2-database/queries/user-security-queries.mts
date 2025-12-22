import { execute, command, query, batch } from '../database.mjs';
import { DATABASE_USER_ROLE_ENUM, CommandResponseType, DATABASE_TOKEN, DATABASE_TOKEN_TYPE_ENUM } from '../database-types.mjs';
import * as log from '../../10-utilities/logging/log.mjs';
import { RoleEnum } from '../../../0-assets/field-sync/input-config-sync/profile-field-config.mjs';


/**************************************************************************
/*       DEFINING AND HANDLING ALL QUERIES HERE 
/* TABLES: user_role, user_role_defined, user_token
***************************************************************************/

/* Prevent SQL Injection Protocol:
* 1) Use Prepared Statements, auto escape input strings
* 2) Validate Column Names
* - Use execute() for Prepared Statements (inputs)
* - Use query() for predefined Select Statements (static)
* - Use command() for database operation (inputs)
* - Use batch() for multiple prepared operations (input)
*/


/**********************
 *  USER ROLE QUERIES *
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
    const response:CommandResponseType = 
        await command('INSERT INTO user_role ( userID, userRoleID ) VALUES '
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



/****************************************
 *       GENERAL TOKEN QUERIES          *
 * userID | type | token | expirationDT *
 ****************************************/

export const DB_SELECT_TOKEN = async(token:string):Promise<DATABASE_TOKEN | undefined> => {
    const rows = await execute('SELECT userID, type, expirationDT, createdDT '
        + 'FROM token '
        + 'WHERE token = ? '
        + 'LIMIT 1;', [token]);

    if((rows === undefined) || (rows.length === 0))
        return undefined;

    return {userID:rows[0].userID, type:DATABASE_TOKEN_TYPE_ENUM[rows[0].type], expirationDT:rows[0].expirationDT, createdDT:rows[0].createdDT, token:''}; //token not returned for security
}

export const DB_SELECT_TOKEN_EXISTS = async(entry:DATABASE_TOKEN):Promise<boolean> => {
    const rows = await execute('SELECT token '
        + 'FROM token '
        + 'WHERE userID = ? AND type = ? AND token = ? '
        + 'AND ( expirationDT IS NULL OR expirationDT > NOW() ) '
        + 'LIMIT 1;', [entry.userID, entry.type, entry.token]);

    return ((rows !== undefined) && (rows.length > 0));
}

export const DB_SELECT_TOKEN_USER_ALL = async({userID, type}:{userID:number, type?:DATABASE_TOKEN_TYPE_ENUM}):Promise<DATABASE_TOKEN[]> => {
    const rows = (type === undefined)
        ? await execute('SELECT userID, type, expirationDT, createdDT '
            + 'FROM token '
            + 'WHERE userID = ?;', [userID])

        : await execute('SELECT userID, type, expirationDT '
            + 'FROM token '
            + 'WHERE userID = ? AND type = ?;', [userID, type]);

    return rows.map((row) => ({userID:row.userID, type:DATABASE_TOKEN_TYPE_ENUM[row.type], expirationDT:row.expirationDT ?? null, createdDT:row.createdDT, token:''})); //token not returned for security
}

export const DB_INSERT_TOKEN = async(entry:DATABASE_TOKEN):Promise<boolean> => {
    if(entry.token.length < 4) {
        log.error('DB_INSERT_TOKEN token rejected for being too short', entry);
        return false;
    
    } else if((entry.expirationDT === undefined) || (String(entry.expirationDT).length === 0))
        log.warn('DB_INSERT_TOKEN expirationDT not set', entry); //unlimited is allowed, but not recommended

    const response:CommandResponseType = await command('INSERT INTO token ( userID, type, token, expirationDT ) VALUES '
        + '( ?, ?, ?, ? ) '
        + 'ON DUPLICATE KEY UPDATE '
        + 'userID = VALUES(userID), type = VALUES(type), expirationDT = VALUES(expirationDT);',
        [entry.userID, entry.type, entry.token, entry.expirationDT ?? null]); //null implies unlimited

    return ((response !== undefined) && (response.affectedRows > 0));
}

//Batch insert multiple tokens at once
export const DB_INSERT_TOKEN_BATCH = async(entryList:DATABASE_TOKEN[]):Promise<boolean> => {
    //Filter out invalid tokens
    entryList = entryList.filter(entry => String(entry.token).length >= 4 && entry.expirationDT !== undefined); //unlimited not permitted for batch
    if(entryList.length === 0)
        return false;

    //Insert all tokens at once
    const batchList = entryList.map(entry => ([entry.userID, entry.type, entry.token, entry.expirationDT ?? null]));

    const response:boolean|undefined = await batch('INSERT INTO token ( userID, type, token, expirationDT ) VALUES ? '
        + 'ON DUPLICATE KEY UPDATE '
        + 'userID = VALUES(userID), type = VALUES(type), expirationDT = VALUES(expirationDT);',
        batchList);

    return (response === true);
}

export const DB_DELETE_TOKEN = async(token:string):Promise<boolean> => {

    const response:CommandResponseType = await command('DELETE FROM token '
        + 'WHERE token = ?;', [token]);

    return (response !== undefined);  //Success on non-error
}

//Batch delete multiple tokens at once
export const DB_DELETE_TOKEN_BATCH = async(tokenList:string[]):Promise<boolean> => {
    tokenList = tokenList.filter(token => String(token).length >= 4);
    if(tokenList.length === 0)
        return false;

    const placeholders:string = tokenList.map(() => '?').join(',');

    const response:CommandResponseType = await command('DELETE FROM token '
        + `WHERE token IN (${placeholders});`, tokenList);

    return (response !== undefined); //Success on non-error
}

export const DB_DELETE_TOKEN_USER_ALL = async({userID, type}:{userID:number, type?:DATABASE_TOKEN_TYPE_ENUM}):Promise<boolean> => {
    log.db(`DELETE TOKEN USER ALL attempted: userID:${userID}, type:${type}`);

    const response:CommandResponseType = (type === undefined) ? //Delete All Types
    await command('DELETE FROM token '
        + 'WHERE userID = ?;', [userID])

    : await command('DELETE FROM token '
        + 'WHERE userID = ? AND type = ?;', [userID, type]);

    return (response !== undefined);  //Success on non-error
}

//CRON JOB to delete expired across database
export const DB_FLUSH_EXPIRED_TOKENS = async(type?:DATABASE_TOKEN_TYPE_ENUM):Promise<boolean> => {
    const response:CommandResponseType = (type === undefined) ? //All Types
    await command('DELETE FROM token '
        + 'WHERE expirationDT < NOW();', [])

    : await command('DELETE FROM token '
        + 'WHERE expirationDT < NOW() AND type = ?;', [type]);

    return (response !== undefined);  //Success on non-error
}
