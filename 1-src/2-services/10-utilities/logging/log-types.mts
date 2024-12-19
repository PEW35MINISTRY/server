import { PathLike } from 'fs';
import path from 'path';
const __dirname = path.resolve();
import { LogType } from '../../../0-assets/field-sync/api-type-sync/utility-types.mjs';


/* LOGGING CONTROLS */
export let SAVE_LOGS_LOCALLY = (process.env.SAVE_LOGS_LOCALLY !== undefined) ? (process.env.SAVE_LOGS_LOCALLY === 'true') :true;
export const setSaveLogsLocally = (saveLocally:boolean):void => { SAVE_LOGS_LOCALLY = saveLocally; }

export const UPLOAD_LOGS = (process.env.SAVE_LOGS_DATABASE !== undefined) ? (process.env.SAVE_LOGS_DATABASE === 'true') :false;

export let SEND_ALERT_EMAILS = (process.env.SEND_EMAILS !== undefined) ? (process.env.SEND_EMAILS === 'true') :false;
export const setSendAlertEmails = (sendAlert:boolean):void => { SEND_ALERT_EMAILS = sendAlert; }



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
    META_DATA = 'META_DATA',
    JSON = 'JSON',
    TEXT = 'TEXT'
}

