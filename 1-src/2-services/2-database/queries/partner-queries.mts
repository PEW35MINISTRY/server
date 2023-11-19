import { PartnerListItem } from '../../../0-assets/field-sync/api-type-sync/profile-types.mjs';
import * as log from '../../log.mjs';
import { DATABASE_PARTNER_STATUS_ENUM } from '../database-types.mjs';
import { query, execute, command, validateColumns, batch } from '../database.mjs';


/**********************************************
/*    DEFINING AND HANDLING ALL QUERIES HERE 
/* TABLES: partner
***********************************************/

/* Prevent SQL Injection Protocol:
* 1) Use Prepared Statements, auto escape input strings
* 2) Validate Column Names
* - Use execute() for Prepared Statements (inputs)
* - Use query() for predefined Select Statements (static)
* - Use command() for database operation (inputs)
*/

// 'userID' is ALWAYS LESS THAN 'partnerID'

const getUserID = (userID:number, partnerID:number):number => (userID < partnerID) ? userID : partnerID;

const getPartnerID = (userID:number, partnerID:number):number => (userID > partnerID) ? userID : partnerID;


/*********************
 *  PARTNER QUERIES
 *********************/
export const DB_SELECT_PARTNER_LIST = async(userID:number, status:DATABASE_PARTNER_STATUS_ENUM = DATABASE_PARTNER_STATUS_ENUM.PARTNER):Promise<PartnerListItem[]> => {
    const rows = await execute('SELECT * ' + 'FROM partner '
        + 'WHERE ( userID = ? OR partnerID = ? ) AND status = ?;', [userID, userID, status]);


    return [...rows.map(row => ({userID: row.userID || -1, firstName: row.firstName || '', displayName: row.displayName || '', image: row.image || ''}))];
}

// export const DB_SELECT_USER_PARTNERS = async(userID:number):Promise<ProfileListItem[]> => { //TODO Query partner table
//     const rows = await execute('SELECT user.userID, user.firstName, user.displayName, user.image ' + 'FROM user ORDER BY modifiedDT DESC LIMIT 3;', []);

//     return [...rows.map(row => ({userID: row.userID || -1, firstName: row.firstName || '', displayName: row.displayName || '', image: row.image || ''}))];
// }

export const DB_IS_USER_PARTNER = async(userID:number, clientID:number):Promise<boolean> => {
    const rows = await execute('SELECT * ' + 'FROM partner '
        + 'WHERE userID = ? AND partnerID = ? AND status = ?;', [getUserID(userID, clientID), getPartnerID(userID, clientID), 'PARTNER']);

    if(rows.length > 1) log.db(`DB_IS_USER_PARTNER MULTIPLE RECORDS for partnership IDENTIFIED`, userID, clientID, JSON.stringify(rows));

    return (rows.length > 0);
}