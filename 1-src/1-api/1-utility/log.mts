import { NextFunction, Response } from 'express';
import { JwtAdminRequest, LogEntryDayRequest, LogEntryKeyRequest, LogEntryLocationRequest, LogEntryNewRequest, LogSearchRequest } from '../2-auth/auth-types.mjs';
import { LogLocation, LogType } from '../../0-assets/field-sync/api-type-sync/utility-types.mjs';
import { Exception } from '../api-types.mjs';
import { filterLogEntries, readLogFile, resetLogFile, streamLocalLogFile, writeLogFile } from '../../2-services/10-utilities/logging/log-local-utilities.mjs';
import LOG_ENTRY from '../../2-services/10-utilities/logging/logEntryModel.mjs';
import { deleteS3Log, deleteS3LogsByDay, fetchS3LogEntry, fetchS3LogsByDateRange, streamS3LogsAsFile, uploadS3LogEntry } from '../../2-services/10-utilities/logging/log-s3-utilities.mjs';
import { getEnvironment } from '../../2-services/10-utilities/utilities.mjs';
import { ENVIRONMENT_TYPE } from '../../0-assets/field-sync/input-config-sync/inputField.mjs';
import { athenaSearchS3Logs } from '../../2-services/10-utilities/logging/log-s3-athena-search.mjs';
import { updateAthenaPartitions } from '../../2-services/10-utilities/athena.mjs';


//Fetch individual entry by S3 File Key
export const GET_LogEntryByS3Key = async(request:LogEntryKeyRequest, response:Response, next:NextFunction) => {
    if(request.query.key === undefined || request.query.key.length < 10) 
        return next(new Exception(400, `Invalid log key in query parameter :: ${request.query.key}`, 'Missing Log Key'));
    else
        return response.status(200).send(await (await fetchS3LogEntry(request.query.key))?.toJSON());
}


//Default View; combines ERROR and WARN entries
export const GET_LogDefaultList = async(request:LogEntryLocationRequest, response:Response, next:NextFunction) => {
    const {location =  (getEnvironment() === ENVIRONMENT_TYPE.LOCAL) ? LogLocation.LOCAL : LogLocation.S3} = request.query
    const startTime = new Date().getTime() - (7 * 24 * 60 * 60 * 1000); //7 days
    
    let logList:LOG_ENTRY[] = [];
    if(location === LogLocation.LOCAL) {
        logList.push(...(await readLogFile(LogType.WARN, 200)));
        logList.push(...(await readLogFile(LogType.ERROR, 500 - logList.length)));

    } else if(location === LogLocation.S3) {
        logList.push(...(await fetchS3LogsByDateRange(LogType.WARN, startTime, undefined, 200)));
        logList.push(...(await fetchS3LogsByDateRange(LogType.ERROR, startTime, undefined, 500 - logList.length)));
    }

    if(Array.isArray(logList) && logList.length > 0)
        return response.status(200).send(filterLogEntries(logList, undefined, startTime, undefined, true).map(entry => entry.toJSON()));
    else
        return response.status(205).send([]);
}


export const GET_LogSearchList = async(logType:LogType|undefined, request:LogSearchRequest, response:Response, next:NextFunction) => {
    /* Identifying Log Type via URL parameter */
    if(logType === undefined) {
        logType = LogType[String(request.params.type ?? '').toUpperCase().trim() as keyof typeof LogType];

        if(logType === undefined) 
            return next(new Exception(400, `Failed to parse log type :: missing 'type' parameter :: ${request.params.type}`, 'Missing Log Type'));
    }

    //Search Options
    const { location = (getEnvironment() === ENVIRONMENT_TYPE.LOCAL) ? LogLocation.LOCAL : LogLocation.S3, 
        search, cumulativeIndex, startTimestamp, endTimestamp, maxEntries, combineDuplicates } = request.query;
    const lastReadEntryIndex:number = Math.max(0, parseInt(cumulativeIndex ?? '0'));
    const startTime:number|undefined = startTimestamp ? new Date(parseInt(startTimestamp)).getTime() : new Date().getTime() - (7 * 24 * 60 * 60 * 1000); //7 days;
    const endTime:number|undefined = endTimestamp ? new Date(parseInt(endTimestamp)).getTime() : new Date().getTime();
    const mergeDuplicates:boolean = (combineDuplicates === 'true') ? true : (combineDuplicates === 'false') ? false : true;
    const entries:number = Math.min(500, parseInt(maxEntries ?? String(search ? 500 : 100)));

    const logList:LOG_ENTRY[] = (location === LogLocation.LOCAL) ? filterLogEntries(await readLogFile(logType, entries, lastReadEntryIndex, endTime), search, startTime, endTime, mergeDuplicates)
                                : (location === LogLocation.S3) ? 
                                    (!search || search.length === 0) ? await fetchS3LogsByDateRange(logType, startTime, endTime, entries, mergeDuplicates) //Limited to key details
                                    : await athenaSearchS3Logs(logType, search, startTime , endTime, entries, mergeDuplicates)
                                : [];

    if(Array.isArray(logList) && logList.length > 0)
        return response.status(200).send(logList.map(entry => entry.toJSON()));
    else
        return response.status(205).send([]);
};


/* Manually Updates Athena Search Partitions | Needed daily, athenaSearchS3Logs calls automatically */
export const POST_LogPartitionBucket = async (request:JwtAdminRequest, response:Response, next:NextFunction) => {
    if(await updateAthenaPartitions(process.env.LOG_ATHENA_DATABASE, process.env.LOG_ATHENA_TABLE, `s3://${process.env.LOG_BUCKET_NAME}/athena`))
        response.status(204).send(`Manual Athena partitions successfully.`);
    else
        next(new Exception(404, `Failed to manually partition logs for Athena searching.`, 'Partition Failed'));
};


/* Save New Log Entry */
export const POST_LogEntry = async(type:LogType|'ALERT'|undefined, request:LogEntryNewRequest, response:Response, next:NextFunction) => {
    let logType:LogType;
    const sendAlertEmail:boolean = (type === 'ALERT'); //Alert Error is type LogType.ERROR and sends email
    
    if(sendAlertEmail) {
        logType = LogType.ERROR;
    /* Identifying Log Type via URL parameter */
    } else if(type === undefined) {
        logType = LogType[String(request.params.type ?? '').toUpperCase().trim() as keyof typeof LogType];

        if(logType === undefined) 
            return next(new Exception(400, `Failed to parse log type :: missing 'type' parameter :: ${request.params.type}`, 'Missing Log Type'));
    }

    /* Identifying Location from Query parameter */
    const location = LogLocation[request.query.location as string] || (getEnvironment() === ENVIRONMENT_TYPE.LOCAL) ? LogLocation.LOCAL : LogLocation.S3;
    const messageList:string[] = Array.isArray(request.body) ? request.body : [request.body];

    const logEntry = new LOG_ENTRY(logType, messageList);

    if(logEntry.validateCheck() === false)
        return next(new Exception(500, `New Log Entry failed to validate and not saved: ${logEntry.toString()}`, 'Failed to Validate Log'));
    
    else if((location === LogLocation.LOCAL) && await writeLogFile(logEntry) === false)
        return next(new Exception(500, `Failed to write log to local file :: ${logType}`, 'Failed to Write Log'));

    else if((location === LogLocation.S3) && await uploadS3LogEntry(logEntry) === false)
        return next(new Exception(500, `Failed to upload log to S3 :: ${logType}`, 'Failed to Write Log'));
    
    else {
        if(sendAlertEmail)
            console.warn('Email Alert not supported yet.');
            // await sendLogAlertEmail(logEntry);
        return response.status(202).send(logEntry.toJSON());
    }
}

//Reduce to minimum & latest entries
export const POST_LogResetFile = async(logType:LogType|undefined, request:LogEntryNewRequest, response:Response, next:NextFunction) => {
    /* Identifying Log Type via URL parameter */
    if(logType === undefined) {
        logType = LogType[String(request.params.type ?? '').toUpperCase().trim() as keyof typeof LogType];

        if(logType === undefined) 
            return next(new Exception(400, `Failed to parse log type :: missing 'type' parameter :: ${request.params.type}`, 'Missing Log Type'));
    }

    if(LogLocation[request.query.location] !== LogLocation.LOCAL)
        return next(new Exception(400, `Log reset unavailable for ${LogLocation.S3} location.`));

    const retainedLogList:LOG_ENTRY[] = await resetLogFile(logType, true);

    if(Array.isArray(retainedLogList) && retainedLogList.length > 0)
        return response.status(202).send(retainedLogList);
    else
        return next(new Exception(500, `Failed to reset local log file :: ${logType}`, 'Failed to Reset Log'));
}


//Export txt log file
export const GET_LogDownloadFile = async(logType:LogType|undefined, request:LogEntryNewRequest, response:Response, next:NextFunction) => {
    const {location = LogLocation.LOCAL} = request.query

    /* Identifying Log Type via URL parameter */
    if(logType === undefined) {
        logType = LogType[String(request.params.type ?? '').toUpperCase().trim() as keyof typeof LogType];

        if(logType === undefined) 
            return next(new Exception(400, `Failed to parse log type :: missing 'type' parameter :: ${request.params.type}`, 'Missing Log Type'));
    }

    response.setHeader('Content-Disposition', `attachment; filename='${logType}.txt'`);
    response.setHeader('Content-Type', 'text/plain');
    
    //Initiate file stream within log utilities
    if(location === LogLocation.LOCAL)
        streamLocalLogFile(logType, response, next);
    else if(location === LogLocation.S3)
        streamS3LogsAsFile(logType, response, next);
    else
        return next(new Exception(404, `Download unavailable for log location: ${location}`, 'Invalid Location'));
}


export const POST_LogEmailReport = async(logType:LogType|undefined, request:LogEntryNewRequest, response:Response, next:NextFunction) => {
    /* Identifying Log Type via URL parameter */
    if(logType === undefined) {
        logType = LogType[String(request.params.type ?? '').toUpperCase().trim() as keyof typeof LogType];

        if(logType === undefined) 
            return next(new Exception(400, `Failed to parse log type :: missing 'type' parameter :: ${request.params.type}`, 'Missing Log Type'));
    }

    return next(new Exception(500, 'Log email service yet to be implemented', 'Email Service Unavailable'));
}


/* Delete S3 Log Entries */
export const DELETE_LogEntryByS3Key = async (request:LogEntryKeyRequest, response:Response, next:NextFunction) => {
    const { key } = request.query;
    if(!key || key.length < 10)
        return next(new Exception(400, 'S3 Key is required', 'Missing S3 Key'));

    if(await deleteS3Log(key))
        response.status(204).send(`Log entry with key ${key} deleted successfully`);
    else
        next(new Exception(404, `Failed to delete log entry with key ${key}`, 'Log Deletion Failed'));
}


export const DELETE_LogEntryS3ByDay = async (request:LogEntryDayRequest, response:Response, next:NextFunction) => {
    const { timestamp } = request.query;
    if (!timestamp || isNaN(new Date(timestamp).getTime()))
        return next(new Exception(400, 'Timestamp query parameter is required', 'Missing Timestamp'));

    if(await deleteS3LogsByDay(LogType.EVENT, new Date(timestamp)))
        response.status(204).send(`Logs for ${timestamp} deleted successfully`);
    else
        next(new Exception(404, `Failed to delete logs for ${timestamp}`, 'Log Day Deletion Failed'));
};

