import { NextFunction, Response } from 'express';
import { JwtAdminRequest, LogEntryKeyRequest, LogEntryLocationRequest, LogEntryNewRequest, LogSearchRequest } from '../2-auth/auth-types.mjs';
import { LogLocation, LogType } from '../../0-assets/field-sync/api-type-sync/utility-types.mjs';
import { Exception } from '../api-types.mjs';
import { filterLogEntries, readLogFile, resetLogFile, streamLocalLogFile, writeLogFile } from '../../2-services/10-utilities/logging/log-local-utilities.mjs';
import LOG_ENTRY from '../../2-services/10-utilities/logging/logEntryModel.mjs';
import { fetchS3LogEntry, fetchS3LogsByDateRange, streamS3LogsAsFile, uploadS3LogEntry } from '../../2-services/10-utilities/logging/log-s3-utilities.mjs';
import { getEnvironment } from '../../2-services/10-utilities/utilities.mjs';
import { ENVIRONMENT_TYPE } from '../../0-assets/field-sync/input-config-sync/inputField.mjs';


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
    const startTime = Date.now() - 7 * 24 * 60 * 60 * 1000; //7 days

    let logList:LOG_ENTRY[] = [];
    if(location === LogLocation.LOCAL) {
        logList.push(...(await readLogFile(LogType.WARN, 200)));
        logList.push(...(await readLogFile(LogType.ERROR, 500 - logList.length)));

    } else if(location === LogLocation.S3) {
        logList.push(...(await fetchS3LogsByDateRange(LogType.WARN, new Date(startTime), new Date(), 200)));
        logList.push(...(await fetchS3LogsByDateRange(LogType.ERROR, new Date(startTime), new Date(), 500 - logList.length)));
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
    const startTime:number|undefined = startTimestamp ? new Date(parseInt(startTimestamp)).getTime() : undefined;
    const endTime:number|undefined = endTimestamp ? new Date(parseInt(endTimestamp)).getTime() : undefined;
    const mergeDuplicates: boolean = (combineDuplicates === 'true') ? true : (combineDuplicates === 'false') ? false : true;
    const entries:number = Math.min(500, parseInt(maxEntries ?? String(search ? 500 : 100)));

    const logList:LOG_ENTRY[] = (location === LogLocation.LOCAL) ? await readLogFile(logType, entries, lastReadEntryIndex, endTime) 
                                : (location == LogLocation.S3) ? await fetchS3LogsByDateRange(logType, new Date(startTime), new Date(endTime)) //Limited to key details
                                : [];

//TODO ATHENA Search

    if(Array.isArray(logList) && logList.length > 0)
        return response.status(200).send(filterLogEntries(logList, search, startTime, endTime, mergeDuplicates).map(entry => entry.toJSON()));
    else
        return response.status(205).send([]);
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

    response.setHeader('Content-Disposition', `attachment; filename="${logType}.txt"`);
    response.setHeader('Content-Type', 'text/plain');
    
    //Initiate file stream within log utilities
    if(location === LogLocation.LOCAL)
        streamLocalLogFile(logType, response);
    else if(location === LogLocation.S3)
        streamS3LogsAsFile(logType, response);
    else
        return next(new Exception(404, `Download unavailable for log location: ${location}`));
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
