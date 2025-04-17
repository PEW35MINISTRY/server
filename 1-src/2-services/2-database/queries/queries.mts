import { CommandResponseType } from '../database-types.mjs';
import { command, execute, query, validateColumns } from '../database.mjs';
import * as log from '../../10-utilities/logging/log.mjs';



/*****************************
*  GENERAL DATABASE QUERIES
* TABLES: subscription
******************************/

export const DB_INSERT_EMAIL_SUBSCRIPTION = async(email:string, role?:string, note?:string):Promise<boolean> => {
    const response:CommandResponseType = await command('INSERT INTO subscription (email, role, note) '
    + 'VALUES (?, ?, ?) '
    + 'ON DUPLICATE KEY UPDATE role = VALUES(role), note = VALUES(note);'
    , [email, role || null, note || null]);

    return ((response !== undefined) && (response.affectedRows > 0));
}
