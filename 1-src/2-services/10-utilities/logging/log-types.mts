import { PathLike } from 'fs';
import path from 'path';
const __dirname = path.resolve();
import { LogType } from '../../../0-assets/field-sync/api-type-sync/utility-types.mjs';
import { ENVIRONMENT_TYPE } from '../../../0-assets/field-sync/input-config-sync/inputField.mjs';
import { getEnvironment } from '../utilities.mjs';


/* LOGGING CONTROLS */
export const LOG_SEARCH_DEFAULT_TIMESPAN = (7 * 24 * 60 * 60 * 1000); //7 days
export const LOG_SEARCH_DEFAULT_MAX_ENTRIES = 500;
export const LOG_DEFAULT_ERROR_PERCENTAGE = 0.67;

export let PRINT_LOGS_TO_CONSOLE = (process.env.PRINT_LOGS_TO_CONSOLE !== undefined) ? (process.env.PRINT_LOGS_TO_CONSOLE === 'true') : (getEnvironment() === ENVIRONMENT_TYPE.LOCAL);

export let SAVE_LOGS_LOCALLY = (process.env.SAVE_LOGS_LOCALLY !== undefined) ? (process.env.SAVE_LOGS_LOCALLY === 'true') : true;
export const setSaveLogsLocally = (saveLocally:boolean):void => { SAVE_LOGS_LOCALLY = saveLocally; }

export const UPLOAD_LOGS_S3 = (process.env.UPLOAD_LOGS_S3 !== undefined) ? (process.env.UPLOAD_LOGS_S3 === 'true')
                                : [ENVIRONMENT_TYPE.DEVELOPMENT, ENVIRONMENT_TYPE.PRODUCTION].includes(getEnvironment());

export let SEND_LOG_EMAILS = (process.env.SEND_LOG_EMAILS !== undefined) ? (process.env.SEND_LOG_EMAILS === 'true')
                                : [ENVIRONMENT_TYPE.PRODUCTION].includes(getEnvironment());
export const setSendAlertEmails = (sendAlert:boolean):void => { SEND_LOG_EMAILS = sendAlert; }

export let SAVE_AUTH_LOGS = (process.env.SAVE_AUTH_LOGS !== undefined) ? (process.env.SAVE_AUTH_LOGS === 'true') : true;
export const setSaveAuthLogs = (saveAuthLogs:boolean):void => { SAVE_AUTH_LOGS = saveAuthLogs; }

export let SAVE_EVENT_LOGS = (process.env.SAVE_EVENT_LOGS !== undefined) ? (process.env.SAVE_EVENT_LOGS === 'true') : true;
export const setSaveEventLogs = (saveEventLogs:boolean):void => { SAVE_LOGS_LOCALLY = saveEventLogs; }


/* S3 LOGGING Controls */
export const MAX_PARALLEL_CONNECTIONS:number = (getEnvironment() === ENVIRONMENT_TYPE.LOCAL) ? 10 : 30;


/* LOCAL LOGGING FILES */
export const LOG_SIMILAR_TIME_RANGE:number = parseInt(process.env.LOG_SIMILAR_TIME_RANGE || '300000'); //5min
export const LOG_ESTIMATE_CONFIDENCE:number = 0.75;  //0.0-1.0 scale; +/- applied at application

export const LOG_MAX_SIZE_BYTES:number = parseInt(process.env.LOG_MAX_SIZE_BYTES || '1048576'); //1MB ~ 1.2k Errors (850 char each) ~ 11k Events (90x char each)
export const LOG_ROLLOVER_SIZE_BYTES:number = parseInt(process.env.LOG_ROLLOVER_SIZE_BYTES || '102400'); //100 KB ~ 120x Errors (1000 char each) ~ 1.1k Events (90x char each)

export const LOG_DIRECTORY:PathLike = path.join(__dirname, process.env.LOG_DIRECTORY || 'LOGS');

const LOG_ERROR_FILE:PathLike = path.join(LOG_DIRECTORY, process.env.LOG_ERROR_FILE || 'log-error.txt');
const LOG_WARN_FILE:PathLike = path.join(LOG_DIRECTORY, process.env.LOG_WARN_FILE || 'log-warn.txt');
const LOG_EVENT_FILE:PathLike = path.join(LOG_DIRECTORY, process.env.LOG_EVENT_FILE || 'log-event.txt');
const LOG_AUTH_FILE:PathLike = path.join(LOG_DIRECTORY, process.env.LOG_AUTH_FILE || 'log-auth.txt');
const LOG_DB_FILE:PathLike = path.join(LOG_DIRECTORY, process.env.LOG_DB_FILE || 'log-db.txt');

export const getLogFilePath = (type:LogType):PathLike => {
    switch (type) {
        case LogType.WARN:return LOG_WARN_FILE;
        case LogType.EVENT:return LOG_EVENT_FILE;
        case LogType.AUTH:return LOG_AUTH_FILE;
        case LogType.DB:return LOG_DB_FILE;
        default:return LOG_ERROR_FILE;
    }
}


export enum LOG_SOURCE {
    NEW = 'NEW',
    S3_KEY = 'S3_KEY',
    JSON = 'JSON',
    TEXT = 'TEXT'
}

