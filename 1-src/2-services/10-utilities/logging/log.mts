import { LogType } from '../../../0-assets/field-sync/api-type-sync/utility-types.mjs';
import { writeLogFile } from './log-local-utilities.mjs';
import { uploadS3LogEntry } from './log-s3-utilities.mjs';
import { SAVE_AUTH_LOGS, SAVE_EVENT_LOGS, SAVE_LOGS_LOCALLY, UPLOAD_LOGS_S3 } from './log-types.mjs';
import LOG_ENTRY from './logEntryModel.mjs';

/* EXPORT LOG BY TYPE */
export const alert = async(...messages:any[]):Promise<boolean> => {
    const entry:LOG_ENTRY = new LOG_ENTRY(LogType.ALERT, messages, getStackTrace());

    return !SAVE_LOGS_LOCALLY || await writeLogFile(entry)
        && !UPLOAD_LOGS_S3 || await uploadS3LogEntry(entry);
        // && !SEND_LOG_EMAILS || await sendLogAlertEmail(entry);
}

export const error = async(...messages:any[]):Promise<boolean> => {
    const entry:LOG_ENTRY = new LOG_ENTRY(LogType.ERROR, messages, getStackTrace());

    return !SAVE_LOGS_LOCALLY || await writeLogFile(entry)
        && !UPLOAD_LOGS_S3 || await uploadS3LogEntry(entry);
}

export const errorWithoutTrace = async(...messages:any[]):Promise<boolean> => {
    const entry:LOG_ENTRY = new LOG_ENTRY(LogType.ERROR, messages);

    return !SAVE_LOGS_LOCALLY || await writeLogFile(entry)
        && !UPLOAD_LOGS_S3 || await uploadS3LogEntry(entry);
}

export default error;

export const warn = async(...messages:any[]):Promise<boolean> => {
    const entry:LOG_ENTRY = new LOG_ENTRY(LogType.WARN, messages);

    return !SAVE_LOGS_LOCALLY || await writeLogFile(entry)
        && !UPLOAD_LOGS_S3 || await uploadS3LogEntry(entry);
}

export const db = async(...messages:any[]):Promise<boolean> => {
    const entry:LOG_ENTRY = new LOG_ENTRY(LogType.DB, messages);

    return !SAVE_LOGS_LOCALLY || await writeLogFile(entry)
        && !UPLOAD_LOGS_S3 || await uploadS3LogEntry(entry);
}

export const auth = async(...messages:any[]):Promise<boolean> => {
    if(!SAVE_AUTH_LOGS)
        return true;
    
    const entry:LOG_ENTRY = new LOG_ENTRY(LogType.AUTH, messages);

    return !SAVE_LOGS_LOCALLY || await writeLogFile(entry)
        && !UPLOAD_LOGS_S3 || await uploadS3LogEntry(entry);
}

export const event = async(...messages:any[]):Promise<boolean> => {
    if(!SAVE_EVENT_LOGS)
        return true;

    const entry:LOG_ENTRY = new LOG_ENTRY(LogType.EVENT, messages);

    return !SAVE_LOGS_LOCALLY || await writeLogFile(entry)
        && !UPLOAD_LOGS_S3 || await uploadS3LogEntry(entry);
}



/* LOGGING UTILITIES */
export const getStackTrace = ():string[] => {
    const stack = new Error().stack?.split('\n').slice(2) || [];
    return stack.slice(0, 5).map(line => line.trim());
};
