import { NextFunction, Response } from 'express';
import {  JwtAdminRequest, LogEntryKeyRequest, LogEntryNewRequest, LogSearchRequest } from '../2-auth/auth-types.mjs';
import { LogLocation, LogType } from '../../0-assets/field-sync/api-type-sync/utility-types.mjs';
import { Exception } from '../api-types.mjs';
import { filterLogEntries, readLogFile, resetLogFile, streamLocalLogFile, writeLogFile } from '../../2-services/10-utilities/logging/log-local-utilities.mjs';
import LOG_ENTRY from '../../2-services/10-utilities/logging/logEntryModel.mjs';


//Fetch individual entry by S3 File Key
export const GET_LogEntryByS3Key = async(request:LogEntryKeyRequest, response:Response, next:NextFunction) => {
    return response.status(200).send(new LOG_ENTRY(LogType.ERROR, ['This is a sample Error until S3 is implemented', request.query.key]).toJSON());
}


//Default View; combines ERROR and WARN entries
export const GET_LogDefaultList = async(request:JwtAdminRequest, response:Response, next:NextFunction) => {
    const startTime = Date.now() - 7 * 24 * 60 * 60 * 1000; //7 days

    let logList:LOG_ENTRY[] = [];
    logList.push(...(await readLogFile(LogType.WARN, 30)));
    logList.push(...(await readLogFile(LogType.ERROR, 100 - logList.length)));

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
    const { location = LogLocation.LOCAL, search, cumulativeIndex, startTimestamp, endTimestamp, maxEntries, combineDuplicates } = request.query;
    const lastReadEntryIndex:number = Math.max(0, parseInt(cumulativeIndex ?? '0'));
    const startTime:number|undefined = startTimestamp ? new Date(parseInt(startTimestamp)).getTime() : undefined;
    const endTime:number|undefined = endTimestamp ? new Date(parseInt(endTimestamp)).getTime() : undefined;
    const mergeDuplicates: boolean = (combineDuplicates === 'true') ? true : (combineDuplicates === 'false') ? false : true;
    const entries:number = Math.min(500, parseInt(maxEntries ?? String(search ? 500 : 100)));

    const logList:LOG_ENTRY[] = (location === LogLocation.LOCAL) ? await readLogFile(logType, entries, lastReadEntryIndex, endTime) : [];

    if(Array.isArray(logList) && logList.length > 0)
        return response.status(200).send(filterLogEntries(logList, search, startTime, endTime, mergeDuplicates).map(entry => entry.toJSON()));
    else
        return response.status(205).send([]);
};

/* Save New Log Entry */
export const POST_LogEntry = async(logType:LogType|undefined, request:LogEntryNewRequest, response:Response, next:NextFunction) => {
    /* Identifying Log Type via URL parameter */
    if(logType === undefined) {
        logType = LogType[String(request.params.type ?? '').toUpperCase().trim() as keyof typeof LogType];

        if(logType === undefined) 
            return next(new Exception(400, `Failed to parse log type :: missing 'type' parameter :: ${request.params.type}`, 'Missing Log Type'));
    }

    /* Identifying Location from Query parameter */
    const location = LogLocation[request.query.location as string] || LogLocation.LOCAL;
    const messageList:string[] = Array.isArray(request.body) ? request.body : [request.body];

    const logEntry = new LOG_ENTRY(logType, messageList);

    if(logEntry.validateCheck() === false)
        return next(new Exception(500, `New Log Entry failed to validate and not saved: ${logEntry.toString()}`, 'Failed to Validate Log'));
    
    else if((location === LogLocation.LOCAL) && await writeLogFile(logEntry) === false)
        return next(new Exception(500, `Failed to write log to local file :: ${logType}`, 'Failed to Write Log'));
    
    else
        return response.status(202).send(logEntry.toJSON());
}

//Reduce to minimum & latest entries
export const POST_LogResetFile = async(logType:LogType|undefined, request:LogEntryNewRequest, response:Response, next:NextFunction) => {
    /* Identifying Log Type via URL parameter */
    if(logType === undefined) {
        logType = LogType[String(request.params.type ?? '').toUpperCase().trim() as keyof typeof LogType];

        if(logType === undefined) 
            return next(new Exception(400, `Failed to parse log type :: missing 'type' parameter :: ${request.params.type}`, 'Missing Log Type'));
    }

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
    else
        return next(new Exception(404, 'Download only available for local logs'));
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
