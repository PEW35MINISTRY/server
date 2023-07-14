import SQL, { Pool, PoolOptions, ResultSetHeader, RowDataPacket } from 'mysql2/promise';
import { Exception } from '../../api/api-types.mjs';
import * as log from './../log.mjs';
import dotenv from 'dotenv';
import { CommandResponseType } from './database-types.mjs';
dotenv.config(); 

const CONFIGURATIONS:PoolOptions = {
    host: process.env.DATABASE_END_POINT,
    database: process.env.DATABASE_NAME,
    port: (process.env.DATABASE_PORT as unknown as number) || 3306,
    user: process.env.DATABASE_USER,
    password: process.env.DATABASE_PASSWORD,
    connectTimeout: (process.env.DATABASE_CONNECTION_TIMEOUT_MS as unknown as number) || 30000, 
    waitForConnections: true,
    connectionLimit: (process.env.DATABASE_CONNECTION_MAX as unknown as number) || 10,
    maxIdle: (process.env.DATABASE_CONNECTION_MIN as unknown as number) || 5,
    idleTimeout: (process.env.DATABASE_IDLE_TIME_MS as unknown as number) || 60000, 
    timezone: 'local',
  };

const DATABASE:Pool = SQL.createPool(CONFIGURATIONS);

/* Test & Log Connection Success */
setTimeout(async()=> await DATABASE.query('SELECT COUNT(*) FROM `user`')
    .then(([rows, fields]) => {
            if(rows[0] !== undefined && rows[0]['COUNT(*)'] > 0) console.info(`DATABASE CONNECTED with ${rows[0]['COUNT(*)']} Identified Users`);
            else throw `Connected, but Query Failed: ${JSON.stringify(rows)}`;})
    .catch((error) => log.alert('DATABASE FAILED TO CONNECT', JSON.stringify(CONFIGURATIONS), error))
, 5000);

/* Prevent SQL Injection Protocol:
* 1) Use Prepared Statements, auto escape input strings
* 2) Validate Column Names
* - Use query() for predefined Select Statements (static)
* - Use execute() for Prepared Statements (inputs)
* - Use command() for database operation (inputs)
*/

/* DO NOT CALL DIRECTLY | Use Predefined Queries */

/**********************************************
 *  QUERY: STATIC PREDEFINED SELECT STATEMENT
 **********************************************/
export const query = async(query:string):Promise<SQL.RowDataPacket[]> => 
    await DATABASE.query(query)
        .then(([rows, fields]:[SQL.RowDataPacket[], SQL.FieldPacket[]]) => {
                // log.db('DB Query Successful: ', query, JSON.stringify(rows));
                return [...rows];
            })
        .catch((error) => {
            log.db('DB Query Failed: ', query, error);
            return [];
        });


/***************************************
 *  EXECUTE: PREPARED SELECT STATEMENT
 ***************************************/
export const execute = async(query:string, fields:any[]):Promise<SQL.RowDataPacket[]> => 
     await DATABASE.execute(query, fields)
        .then(([rows, fields]:[SQL.RowDataPacket[], SQL.FieldPacket[]]) => {
                // log.db('DB Execute Successful: ', query, JSON.stringify(rows));
                return [...rows];
            })
        .catch((error) => {
            log.db('DB Execute Failed: ', query, JSON.stringify(fields), error);
            return [];
        });


/***************************************************
 *  COMMAND: PREPARED DATABASE OPERATION STATEMENT
 ***************************************************/
export const command = async(query:string, fields:any[]):Promise<CommandResponseType|undefined> => 
    await DATABASE.execute(query, fields)
        .then((result:any[]) => {
                if(result.length >= 1) {
                    // log.db('DB Command Successful: ', query, JSON.stringify(result));
                    if((result as unknown as SQL.ResultSetHeader[])[0].affectedRows !== undefined)
                        return (result as unknown as SQL.ResultSetHeader[])[0];
                    else
                        return (result as unknown as SQL.RowDataPacket[])[0];
                } else {
                    log.error('DB Command Successful; but NO Response: ', query, JSON.stringify(result));
                    return undefined;
                }
            })
        .catch((error) => {
            log.db('DB Command Failed: ', query, JSON.stringify(fields), error);
            return undefined;
        });

export default DATABASE;
