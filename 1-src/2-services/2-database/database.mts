import SQL, { Pool, PoolOptions, ResultSetHeader, RowDataPacket } from 'mysql2/promise';
import * as log from './../log.mjs';
import { CommandResponseType, AWSDatabaseSecrets, DATABASE_MODEL_SOURCE_ENVIRONMENT_ENUM } from './database-types.mjs';
import { SecretsManagerClient, GetSecretValueCommand, GetSecretValueResponse } from '@aws-sdk/client-secrets-manager';
import dotenv from 'dotenv';
dotenv.config(); 


/**************************************************************
 * ENVIRONMENT MODEL SOURCE SETTINGS                          *
 *  - Effects new models & search cache                       *
 *  - Only applies to user table; circles inherit from leader *
 **************************************************************/
export const getDatabaseModelSourceEnvironment = ():DATABASE_MODEL_SOURCE_ENVIRONMENT_ENUM => DATABASE_MODEL_SOURCE_ENVIRONMENT_ENUM[process.env.DEFAULT_MODEL_SOURCE_ENVIRONMENT as keyof typeof DATABASE_MODEL_SOURCE_ENVIRONMENT_ENUM] ?? DATABASE_MODEL_SOURCE_ENVIRONMENT_ENUM.PRODUCTION;


/*********************************************
 *  DATABASE CONFIGURATION & INITIALIZATION  *
 *********************************************/
let DATABASE:SQL.Pool|undefined; 

const GetRDSSecretCredentials = async():Promise<AWSDatabaseSecrets> => {
    try {
        const client = new SecretsManagerClient({ region: process.env.RDS_SECRET_REGION });
        const response:GetSecretValueResponse = await client.send(new GetSecretValueCommand({
            SecretId: process.env.RDS_SECRET_NAME
        }));
        return JSON.parse(response.SecretString) as AWSDatabaseSecrets;
    } catch (error) {
        await log.alert(`DATABASE | AWS Secret Manager failed to connect to RDS Secret: ${process.env.RDS_SECRET_NAME} in Region: ${process.env.RDS_SECRET_REGION}.`, error);
        throw error;
    }
}


const initializeDatabase = async():Promise<SQL.Pool> => {
    console.log(`Initializing Database in ${process.env.ENVIRONMENT} Environment...`);

    if(DATABASE) {
        console.log('DATABASE | initializeDatabase - Terminating existing instance.');
        await DATABASE.end();
        DATABASE = undefined;
    }

    /* Database Configurations */
    let DB_CONFIGURATIONS: PoolOptions = {
        host: process.env.DATABASE_END_POINT,
        database: process.env.DATABASE_NAME,
        user: process.env.DATABASE_USER,
        password: process.env.DATABASE_PASSWORD,
    
        port: parseInt(process.env.DATABASE_PORT || '3306'),
        connectTimeout: parseInt(process.env.DATABASE_CONNECTION_TIMEOUT_MS || '30000'),
        waitForConnections: true,
        connectionLimit: parseInt(process.env.DATABASE_CONNECTION_MAX || '10'),
        maxIdle: parseInt(process.env.DATABASE_CONNECTION_MIN || '5'),
        idleTimeout: parseInt(process.env.DATABASE_IDLE_TIME_MS || '60000'),
        timezone: 'Z',
    };
    
    /* Production Environment overwrites with AWS Secrets Manager */
    if(process.env.ENVIRONMENT === 'PRODUCTION') {
        const RDScredentials:AWSDatabaseSecrets = await GetRDSSecretCredentials();        
    
        DB_CONFIGURATIONS = {
            ...DB_CONFIGURATIONS,
            host: RDScredentials.host,
            database: RDScredentials.dbname,
            user: RDScredentials.username,
            password: RDScredentials.password,
        };
    }

    DATABASE = SQL.createPool(DB_CONFIGURATIONS);

    /* Test & Log Connection Success */
    try {
        const [rows] = await DATABASE.query('SELECT COUNT(*) AS count FROM `user`');
        if(rows[0] !== undefined && parseInt(rows[0]['count']) > 0) 
            console.info(`DATABASE CONNECTED with ${rows[0]['count']} Identified Users`);
        else 
            throw `Connected, but Query Failed: ${JSON.stringify(rows)}`;

    } catch (error) {
        await DATABASE.end();
        await log.alert('DATABASE FAILED TO CONNECT', JSON.stringify(DB_CONFIGURATIONS), error);
        throw error;
    }

    return DATABASE;
}

 /*  Initialize Database  & Wait*/
await initializeDatabase();   


/* Prevent SQL Injection Protocol:
* 1) Use Prepared Statements, auto escape input strings
* 2) Validate Column Names
* - Use query() for predefined Select Statements (static)
* - Use execute() for Prepared Statements (inputs)
* - Use command() for database operation (inputs)
* - Use batch() for multiple prepared operations (input)
*/

/* DO NOT CALL DIRECTLY | Use Predefined Queries */

/**********************************************
 *  QUERY: STATIC PREDEFINED SELECT STATEMENT
 **********************************************/
export const query = async(query:string):Promise<SQL.RowDataPacket[]> => 
    await DATABASE.query(query)
        .then(([rows, fields]:[SQL.RowDataPacket[], SQL.FieldPacket[]]) => {
                // log.db('DB Query Successful: ', query, JSON.stringify(rows));
                return [...postParseResultRows(rows)];
            })
        .catch((error) => {
            log.db('DB Query Failed: ', query, error);
            return [];
        });


/***************************************
 *  EXECUTE: PREPARED SELECT STATEMENT
 ***************************************/
export const execute = async(query:string, fields:any[]):Promise<SQL.RowDataPacket[]> => {
    //validate fields supplied
    if((query.split('?').length - 1) !== fields.length) {
        log.error('DB execute Rejected for incorrect number of fields provided: ', query, (query.split('?').length - 1), fields.length, JSON.stringify(fields));
        return [];

    } else if(fields.some(field => (field === undefined))) { //use null to clear
        log.error('DB execute Rejected for undefined field: ', query, fields.length, JSON.stringify(fields));
        return [];

    } else if(fields.some(field => (field !== null && field.length === 0))) {
        log.error('DB execute Rejected for empty string field: ', query, fields.length, JSON.stringify(fields));
        return [];

    } else {
        return await DATABASE.execute(query, preSanitizeInput(fields))
            .then(([rows, fields]:[SQL.RowDataPacket[], SQL.FieldPacket[]]) => {
                    // log.db('DB Execute Successful: ', query, JSON.stringify(rows));
                    return [...postParseResultRows(rows)];
                })
            .catch((error) => {
                log.db('DB Execute Failed: ', query, JSON.stringify(fields), error);
                return [];
            });
    }
}


/***************************************************
 *  COMMAND: PREPARED DATABASE OPERATION STATEMENT
 ***************************************************/
export const command = async(query:string, fields:any[]):Promise<CommandResponseType|undefined> => {
    //validate fields supplied
    if((query.split('?').length - 1) !== fields.length) {
        log.error('DB command Rejected for incorrect number of fields provided: ', query, (query.split('?').length - 1), fields.length, JSON.stringify(fields));
        return undefined;

    } else if(fields.some(field => (field === undefined))) { //use null to clear
        log.error('DB command Rejected for undefined field: ', query, fields.length, JSON.stringify(fields));
        return undefined;

    } else if(fields.some(field => (field !== null && field.length === 0))) {
        log.error('DB command Rejected for empty string field: ', query, fields.length, JSON.stringify(fields));
        return undefined;

    } else {
        return await DATABASE.execute(query, preSanitizeInput(fields))
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
    }
}

        
/************************************************************
 *  BATCH: PREPARED STATEMENT FOR MULTIPLE ROW OPERATIONS [Single Operations Only: INSERT & UPDATE]
 * https://stackoverflow.com/questions/67672322/bulk-insert-with-mysql2-and-nodejs-throws-500
 * https://stackoverflow.com/questions/8899802/how-do-i-do-a-bulk-insert-in-mysql-using-node-js
 ************************************************************/
export const batch = async(query:string, fieldSets:any[][]):Promise<boolean|undefined> => {
    //validate all sets are equal length
    if(fieldSets.length === 0 || !fieldSets.every(set => (set.length === fieldSets[0].length))) {
        log.error('DB Batch Rejected for uneven field sets: ', query, fieldSets.length, JSON.stringify(fieldSets));
        return undefined;

    } else {
        try { //Note: All queries must be valid for a success
            return await DATABASE.query(query, [fieldSets.map(fieldList => preSanitizeInput(fieldList))])
                .then((result:any[]) => {
                    if(result.length >= 1) {
                        // log.db('DB Batch Successful: ', query, fieldSets.length, JSON.stringify(result));
                        if((result as unknown as SQL.ResultSetHeader[])[0].affectedRows !== undefined)
                            return ((result as unknown as SQL.ResultSetHeader[])[0].affectedRows as number === fieldSets.length);
                    } else {
                        log.error('DB Batch Successful; but NO Response: ', query, fieldSets.length, JSON.stringify(result));
                        return undefined;
                    }
                    })
                .catch((err) => {
                    log.db('DB Batch Failed: ', query, fieldSets.length, JSON.stringify(fieldSets), err);
                    return undefined;
                });
            } catch (error) {
                log.error('DB Batch ERROR: ', query, fieldSets.length, error);
                return undefined;
            }
        }
    }

export default DATABASE;

/*** UTILITIES ***/
export const validateColumns = (inputMap:Map<string, any>, includesRequired:boolean, columnList:string[], requiredColumnList:string[]):boolean => 
    Array.from(inputMap.entries()).every(([column, value]) => {
        return (columnList.includes(column)
            && (!requiredColumnList.includes(column) 
                || value !== undefined && value !== null && (value.toString().length > 0)));
    }) 
    && (!includesRequired || requiredColumnList.every((c)=>inputMap.has(c)));


/********************************************************************
 *         ADDITIONAL SANITIZATION OF INPUT VALUES                  *
 * Occurs before SQL (mysql2) prepares statement and escapes values *
 ********************************************************************/
const TIMEZONE_REGEX = new RegExp(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}(Z|[+-]\d{2}:\d{2})$/); //Matches timezone: 1970-01-01T00:00:00.013Z or 1970-01-01T00:00:00.013+06:00

const preSanitizeInput = (valueList:any[]):any[] =>
    valueList.map(value => {    
        /* null is allowed to clear fields */
        if(value == null) return value;
        
        /* Remove Timezone Suffix from Date.toISOString | Server & Database are in UTC, client may convert timezone locally */ 
        if (TIMEZONE_REGEX.test(value)) {
            const timezoneMatch:string[] = value.match(TIMEZONE_REGEX);
            if (timezoneMatch && timezoneMatch.length > 1) return value.replace(timezoneMatch[1], ''); // Remove timezone 'Z' or '+06:00'
        }

        return value;
    });


/********************************************************************
 *       ADDITIONAL UNIVERSAL PARSING OF DATABASE VALUES            *
 ********************************************************************/
const BOOLEAN_REGEX = new RegExp(/^is[A-Z]/); //database column prefix with 'is'

const postParseResultRows = (rows:RowDataPacket[]):RowDataPacket[] =>
    rows.map((row: RowDataPacket) => {
        Object.entries(row).map(([column, value]) => {

            /*Convert MYSQL tinyint(1) to JavaScript boolean */
            if ((value !== null) && BOOLEAN_REGEX.test(column) && (value >= 0) && (value <= 1)) {
                row[column] = (value === 1) ? true : false;
            }
        });
        return row;
    });
    