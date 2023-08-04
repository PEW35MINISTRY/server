import { RoleEnum } from "../../models/Fields-Sync/profile-field-config.mjs";
import { CredentialProfile, ProfileListItem } from "../../../api/profile/profile-types.mjs";
import * as log from '../../log.mjs';
import { query as query, execute as execute, command } from "../database.mjs";
import { DATABASE_USER, USER_TABLE_COLUMNS, CommandResponseType, USER_TABLE_COLUMNS_REQUIRED } from "../database-types.mjs";
import USER from "../../models/userModel.mjs";

/********************************************************
/*       DEFINING AND HANDLING ALL QUERIES HERE 
/* TABLES: user, user_role, user_role_defined, partner
*********************************************************/

/* Prevent SQL Injection Protocol:
* 1) Use Prepared Statements, auto escape input strings
* 2) Validate Column Names
* - Use execute() for Prepared Statements (inputs)
* - Use query() for predefined Select Statements (static)
* - Use command() for database operation (inputs)
*/

/* REQUIRED VALIDATION ONLY WHEN COLUMNS ARE INPUTS */
const validateUserColumns = (inputMap:Map<string, any>, includesRequired:boolean = false):boolean => 
    Array.from(inputMap.entries()).every(([column, value]) => {
        return (USER_TABLE_COLUMNS.includes(column)
            && (!USER_TABLE_COLUMNS_REQUIRED.includes(column) 
                || value !== undefined && value !== null && (value.toString().length > 0)));
    }) 
    && (!includesRequired || USER_TABLE_COLUMNS_REQUIRED.every((c)=>inputMap.has(c)));


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
    const rows = await execute('SELECT user.*, user_role_defined.role ' + 'FROM user '
        + 'LEFT JOIN user_role ON user_role.userID = user.userID '
        + 'AND user_role.userRoleID = ( SELECT min( userRoleID ) FROM user_role WHERE user.userID = user_role.userID ) '
        + 'LEFT JOIN user_role_defined ON user_role_defined.userRoleID = user_role.userRoleID '
        + `WHERE ${preparedColumns};`, Array.from(filterMap.values()));
    
    if(rows.length === 1) return new USER(rows[0] as DATABASE_USER);
    else {
        log.error(`DB_SELECT_USER ${rows.length ? 'MULTIPLE' : 'NONE'} USERS IDENTIFIED`, JSON.stringify(filterMap), JSON.stringify(rows));
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
        log.error(`DB_SELECT_USER_PROFILE ${rows.length ? 'MULTIPLE' : 'NONE'} USERS IDENTIFIED`, JSON.stringify(filterMap), JSON.stringify(rows));
        return new USER();
    }
    
    //Append Full Profile 
    const user = new USER(rows[0] as DATABASE_USER);
    user.userRoleList = await DB_SELECT_USER_ROLES(user.userID);
    // user.circleList = await DB_SELECT_USER_CIRCLES(user.userID);
    user.partnerList = await DB_SELECT_USER_PARTNERS(user.userID);

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
    
    if(result[0] !== undefined && result[0]["COUNT(*)"] !== undefined && result[0]['COUNT(*)'] as number > 1)
        log.error(`Multiple Accounts Detected with matching fields`, JSON.stringify(validFieldMap));

    return (result[0] !== undefined && result[0]["COUNT(*)"] !== undefined && result[0]['COUNT(*)'] as number > 0);
}

/**********************
 *  USER ROLE QUERIES
 **********************/
export const DB_IS_USER_ROLE = async({userID, userRole}:{userID:number, userRole:RoleEnum}):Promise<Boolean> => {   
    const rows = await execute('SELECT * ' + 'FROM user '
    + 'LEFT JOIN user_role ON user_role.userID = user.userID '
    + 'LEFT JOIN user_role_defined ON user_role_defined.userRoleID = user_role.userRoleID '
    + `WHERE user.userID = ? AND user_role_defined.userRole = ?;`, [userID, userRole]); 

    return (rows.length === 1);
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

export const DB_INSERT_USER_ROLE = async({userID, email, userRoleList}:{userID?:number, email?:string, userRoleList:RoleEnum[]}):Promise<boolean> => {
    const response:CommandResponseType = await command('INSERT INTO user_role ( userID, userRoleID ) VALUES '
    + userRoleList.map(() => `( ${(userID === undefined) ? '(SELECT user.userID FROM user WHERE user.email = ? )' : '?'} , `
    + '(SELECT user_role_defined.userRoleID FROM user_role_defined WHERE user_role_defined.userRole = ? ))').join(', ')
    + ';', userRoleList.flatMap((role) => [userID || email, role]));

    return ((response !== undefined) && (response.affectedRows > 0));
}

export const DB_DELETE_USER_ROLE = async({userID, userRoleList}:{userID:number, userRoleList:RoleEnum[]}):Promise<boolean> => {    
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
    const rows = await execute('SELECT user.userID, user.firstName, user.displayName, user.image ' + 'FROM user ORDER BY userID < 10 DESC, modifiedDT DESC LIMIT 15;', []);

    return [...rows.map(row => ({userID: row.userID || -1, firstName: row.firstName || '', displayName: row.displayName || '', image: row.image || ''}))];
}

//TODO TEMPORARY FOR FRONT-END DEBUGGING
export const DB_SELECT_CREDENTIALS = async():Promise<CredentialProfile[]> => {
    //Query User and max userRole
    const rows = await query('SELECT user.userID, user.displayName, user.email, user.passwordHash, user_role_defined.userRole ' + 'FROM user '
        + 'LEFT JOIN user_role ON user_role.userID = user.userID '
        + 'AND user_role.userRoleID = ( SELECT min( userRoleID ) FROM user_role WHERE user.userID = user_role.userID ) '
        + 'LEFT JOIN user_role_defined ON user_role_defined.userRoleID = user_role.userRoleID '
        + 'ORDER BY user.userID < 10 ASC, modifiedDT DESC LIMIT 15;');

    return [...rows.map(row => ({userID: row.userID || -1, 
            displayName: row.displayName || '', 
            userRole: row.userRole || RoleEnum.STUDENT,
            email: row.email || '',
            passwordHash: row.passwordHash || '',
        }))];
}