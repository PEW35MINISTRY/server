import * as log from '../../log.mjs';
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


/*********************
 *  PARTNER QUERIES
 *********************/
export const DB_IS_USER_PARTNER = async({userID, clientID}:{userID:number, clientID:number}):Promise<boolean> => {
    const rows = await execute('SELECT * ' + 'FROM partner '
        + 'WHERE ((userID = ? AND partnerUserID = ?) OR (userID = ? AND partnerUserID = ?)) AND accepted = ?;', [userID, clientID, clientID, userID, true]);

    if(rows.length > 1) log.db(`DB_IS_USER_PARTNER MULTIPLE RECORDS for partnership IDENTIFIED`, userID, clientID, JSON.stringify(rows));

    return (rows.length > 0);
}