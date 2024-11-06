import { LogType } from '../0-assets/field-sync/api-type-sync/utility-types.mjs';
import { writeLogFile } from './10-utilities/logging/log-local-utilities.mjs';
import { SAVE_LOGS_LOCALLY } from './10-utilities/logging/log-types.mjs';
import LOG_ENTRY from './10-utilities/logging/logEntryModel.mjs';

/* EXPORT LOG BY TYPE */
export const alert = async(...messages: any[]):Promise<Boolean> => {
    const entry:LOG_ENTRY = new LOG_ENTRY(LogType.ALERT, messages, getStackTrace());

    return !SAVE_LOGS_LOCALLY || await writeLogFile(entry);
        // && await writeDatabase(LOG_TYPE.ALERT, entry)
        // && await sendEmail('SERVER ALERT', entry);
}

export const error = async(...messages: any[]):Promise<Boolean> => {
    const entry:LOG_ENTRY = new LOG_ENTRY(LogType.ERROR, messages, getStackTrace());

    return !SAVE_LOGS_LOCALLY || await writeLogFile(entry);
        // && await writeDatabase(LOG_TYPE.ERROR, entry)
}

export default error;

export const warn = async(...messages: any[]):Promise<Boolean> => {
    const entry:LOG_ENTRY = new LOG_ENTRY(LogType.WARN, messages);

    return !SAVE_LOGS_LOCALLY || await writeLogFile(entry);
        // && await writeDatabase(LOG_TYPE.WARN, entry)
}

export const db = async(...messages: any[]):Promise<Boolean> => {
    const entry:LOG_ENTRY = new LOG_ENTRY(LogType.DB, messages);

    return !SAVE_LOGS_LOCALLY || await writeLogFile(entry);
        // && await writeDatabase(LOG_TYPE.DB, entry)
}

export const auth = async(...messages: any[]):Promise<Boolean> => {
    const entry:LOG_ENTRY = new LOG_ENTRY(LogType.AUTH, messages);

    return !SAVE_LOGS_LOCALLY || await writeLogFile(entry);
        // && await writeDatabase(LOG_TYPE.AUTH, entry)
}

export const event = async(...messages: any[]):Promise<Boolean> => {
    const entry:LOG_ENTRY = new LOG_ENTRY(LogType.EVENT, messages);

    return !SAVE_LOGS_LOCALLY || await writeLogFile(entry);
        // && await writeDatabase(LOG_TYPE.EVENT, entry)
}



/* LOGGING UTILITIES */
export const getStackTrace = (): string[] => {
    const stack = new Error().stack?.split('\n').slice(2) || [];
    return stack.slice(0, 5).map(line => line.trim());
};
