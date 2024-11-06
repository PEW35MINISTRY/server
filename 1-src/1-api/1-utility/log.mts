import express, { NextFunction, Request, Response, Router } from 'express';
import * as log from '../../2-services/log.mjs';
import {  JwtAdminRequest, LogEntryRequest, LogSearchRequest } from '../2-auth/auth-types.mjs';
import { LogLocation, LogType } from '../../0-assets/field-sync/api-type-sync/utility-types.mjs';
import { Exception } from '../api-types.mjs';
import { filterLogEntries, readLogFile, resetLogFile, writeLogFile } from '../../2-services/10-utilities/logging/log-local-utilities.mjs';
import LOG_ENTRY from '../../2-services/10-utilities/logging/logEntryModel.mjs';


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


export const POST_LogEntry = async(logType:LogType|undefined, request:LogEntryRequest, response:Response, next:NextFunction) => {
    /* Identifying Log Type via URL parameter */
    if(logType === undefined) {
        logType = LogType[String(request.params.type ?? '').toUpperCase().trim() as keyof typeof LogType];

        if(logType === undefined) 
            return next(new Exception(400, `Failed to parse log type :: missing 'type' parameter :: ${request.params.type}`, 'Missing Log Type'));
    }

    /* Identifying Location from Query parameter */
    const location = LogLocation[request.query.location as string] || LogLocation.LOCAL;
    const messageList:string[] = Array.isArray(request.body) ? request.body : [request.body];
    const stackTrace:string[]|undefined = [LogType.ALERT, LogType.ERROR].includes(logType) ? log.getStackTrace() : undefined;

    const logEntry = new LOG_ENTRY(logType, messageList, stackTrace);

    if(logEntry.validateCheck() === false)
        return next(new Exception(500, `New Log Entry failed to validate and not saved`, 'Failed to Validate Log'));
    
    else if((location === LogLocation.LOCAL) && await writeLogFile(logEntry) === false)
        return next(new Exception(500, `Failed to write log to local file :: ${logType}`, 'Failed to Write Log'));
    
    else
        return response.status(202).send(logEntry.toJSON());
}


export const POST_LogResetFile = async(logType:LogType|undefined, request:LogEntryRequest, response:Response, next:NextFunction) => {
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
    