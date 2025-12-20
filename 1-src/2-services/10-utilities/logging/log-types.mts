import { PathLike, readFileSync } from 'fs';
import path from 'path';
const __dirname = path.resolve();
import { getEnvBase, isEnvironment } from '../env-utilities.mjs';
import { LogType } from '../../../0-assets/field-sync/api-type-sync/utility-types.mjs';
import { ENVIRONMENT_TYPE } from '../../../0-assets/field-sync/input-config-sync/inputField.mjs';


export enum LOG_SOURCE {
    NEW = 'NEW',
    S3_KEY = 'S3_KEY',
    JSON = 'JSON',
    TEXT = 'TEXT'
}

/* LOGGING CONTROLS */
export const LOG_SEARCH_DEFAULT_TIMESPAN = (7 * 24 * 60 * 60 * 1000); //7 days
export const LOG_SEARCH_DEFAULT_MAX_ENTRIES = 500;
export const LOG_DEFAULT_ERROR_PERCENTAGE = 0.67;

export let PRINT_LOGS_TO_CONSOLE:boolean = getEnvBase(console.error, 'PRINT_LOGS_TO_CONSOLE', 'boolean', isEnvironment(ENVIRONMENT_TYPE.LOCAL));

export let SAVE_LOGS_LOCALLY:boolean = getEnvBase(console.error, 'SAVE_LOGS_LOCALLY', 'boolean', true);
export const setSaveLogsLocally:(saveLocally:boolean) => void = (saveLocally:boolean):void => { SAVE_LOGS_LOCALLY = saveLocally; }

export const UPLOAD_LOGS_S3:boolean = getEnvBase(console.error, 'UPLOAD_LOGS_S3', 'boolean', isEnvironment(ENVIRONMENT_TYPE.DEVELOPMENT, ENVIRONMENT_TYPE.PRODUCTION));

export let SEND_LOG_EMAILS:boolean = getEnvBase(console.error, 'SEND_LOG_EMAILS', 'boolean', isEnvironment(ENVIRONMENT_TYPE.PRODUCTION));
export const setSendAlertEmails:(sendAlert:boolean) => void = (sendAlert:boolean):void => { SEND_LOG_EMAILS = sendAlert; }

export let SAVE_AUTH_LOGS:boolean = getEnvBase(console.error, 'SAVE_AUTH_LOGS', 'boolean', true);
export const setSaveAuthLogs:(saveAuthLogs:boolean) => void = (saveAuthLogs:boolean):void => { SAVE_AUTH_LOGS = saveAuthLogs; }

export let SAVE_EVENT_LOGS:boolean = getEnvBase(console.error, 'SAVE_EVENT_LOGS', 'boolean', true);
export const setSaveEventLogs:(saveEventLogs:boolean) => void = (saveEventLogs:boolean):void => { SAVE_LOGS_LOCALLY = saveEventLogs; }


/* S3 LOGGING Controls */
export const MAX_PARALLEL_CONNECTIONS:number = isEnvironment(ENVIRONMENT_TYPE.LOCAL) ? 10 : 30;

/* LOCAL LOGGING FILES */
export const LOG_SIMILAR_TIME_RANGE:number = getEnvBase(console.error, 'LOG_SIMILAR_TIME_RANGE', 'number', 300000); //5min
export const LOG_ESTIMATE_CONFIDENCE:number = 0.75;  //0.0-1.0 scale; +/- applied at application

export const LOG_MAX_SIZE_BYTES:number = getEnvBase(console.error, 'LOG_MAX_SIZE_BYTES', 'number', 1048576); //1MB ~ 1.2k Errors (850 char each) ~ 11k Events (90x char each)
export const LOG_ROLLOVER_SIZE_BYTES:number = getEnvBase(console.error, 'LOG_ROLLOVER_SIZE_BYTES', 'number', 102400); //100 KB ~ 120x Errors (1000 char each) ~ 1.1k Events (90x char each)

export const LOG_DIRECTORY:PathLike = path.join(__dirname, getEnvBase(console.error, 'LOG_DIRECTORY', 'string', 'LOGS'));

const LOG_ERROR_FILE:PathLike = path.join(LOG_DIRECTORY, getEnvBase(console.error, 'LOG_ERROR_FILE', 'string', 'log-error.txt'));
const LOG_WARN_FILE:PathLike = path.join(LOG_DIRECTORY, getEnvBase(console.error, 'LOG_WARN_FILE', 'string', 'log-warn.txt'));
const LOG_EVENT_FILE:PathLike = path.join(LOG_DIRECTORY, getEnvBase(console.error, 'LOG_EVENT_FILE', 'string', 'log-event.txt'));
const LOG_AUTH_FILE:PathLike = path.join(LOG_DIRECTORY, getEnvBase(console.error, 'LOG_AUTH_FILE', 'string', 'log-auth.txt'));
const LOG_DB_FILE:PathLike = path.join(LOG_DIRECTORY, getEnvBase(console.error, 'LOG_DB_FILE', 'string', 'log-db.txt'));

export const getLogFilePath = (type:LogType):PathLike => {
    switch (type) {
        case LogType.WARN:return LOG_WARN_FILE;
        case LogType.EVENT:return LOG_EVENT_FILE;
        case LogType.AUTH:return LOG_AUTH_FILE;
        case LogType.DB:return LOG_DB_FILE;
        default:return LOG_ERROR_FILE;
    }
}
