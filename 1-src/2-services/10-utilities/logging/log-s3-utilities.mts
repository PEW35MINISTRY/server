import { NextFunction, Response } from 'express';
import { Readable } from 'stream';
import { DeleteObjectCommand, GetObjectCommand, ListObjectsV2Command, ListObjectsV2CommandOutput, PutObjectCommand, S3Client } from '@aws-sdk/client-s3';
import LOG_ENTRY from './logEntryModel.mjs';
import { LogType } from '../../../0-assets/field-sync/api-type-sync/utility-types.mjs';
import { getEnvironment } from '../utilities.mjs';
import { ENVIRONMENT_TYPE } from '../../../0-assets/field-sync/input-config-sync/inputField.mjs';
import { writeLogFile } from './log-local-utilities.mjs';
import { Exception } from '../../../1-api/api-types.mjs';
import { LOG_SEARCH_DEFAULT_MAX_ENTRIES, LOG_SEARCH_DEFAULT_TIMESPAN, MAX_PARALLEL_CONNECTIONS } from './log-types.mjs';
import dotenv from 'dotenv';
dotenv.config(); 
/* DO NOT IMPORT [ log from '/10-utilities/logging/log.mjs' ] to AVOID INFINITE LOOP */


/* Global Instance for S3 Log Management */
//Initialization if fine locally; but calling s3LogClient.send(command) will fail with authentication
const s3LogClient = new S3Client({ region: process.env.LOG_BUCKET_REGION });

/* All S3 logging errors will attempt to be recorded locally */
const saveLogLocally = async(type:LogType, ...messages:string[]):Promise<boolean> =>
    writeLogFile(
        new LOG_ENTRY(type, ['AWS S3 LOG UTILITY ERROR', ...messages]),
        false //Don't evaluateLogSize
    );


/*************************
 * S3 LOG FETCH HANDLING *
 *************************/
export const fetchS3LogEntry = async(key:string, validate:boolean = true):Promise<LOG_ENTRY | undefined> => {
    try {
        const command = new GetObjectCommand({
            Bucket: process.env.LOG_BUCKET_NAME,
            Key: key,
        });

        const response = await s3LogClient.send(command);
        const bodyString:string = await response.Body.transformToString();

        const entry:LOG_ENTRY = LOG_ENTRY.constructFromJSON(JSON.parse(bodyString), validate);

        if(!entry)
            throw new Error('Failed to parse or validate Log Entry body');

        entry.fileKey = key;
        return entry;

    } catch(error) {
        await saveLogLocally(LogType.ERROR, 'Failed - AWS S3 Log Fetch', key, error);
        return undefined;
    }
}

/* Fetch all Logs for a given day */
//Populated only from S3 Key (1024 characters), must use individual fetch to get full message list from body
export const fetchS3LogsByDay = async(type:LogType, date:Date = new Date(), maxEntries:number = LOG_SEARCH_DEFAULT_MAX_ENTRIES, mergeDuplicates:boolean = true, validate:boolean = true) => {
    try {
        const params = {
            Bucket: process.env.LOG_BUCKET_NAME,
            Prefix: LOG_ENTRY.createDayS3KeyPrefix(type, date),
        };
        const command:ListObjectsV2Command = new ListObjectsV2Command(params);
        const response:ListObjectsV2CommandOutput = await s3LogClient.send(command);

        if(!response.Contents || !Array.isArray(response.Contents) || response.Contents.length === 0) {
            if(getEnvironment() === ENVIRONMENT_TYPE.LOCAL) console.log(`Note: Reading S3 Log Day - Zero results for ${LOG_ENTRY.createDayS3KeyPrefix(type, date)}`);
            return []; //No entries matching prefix exist
        }

        let missingKeys:number = 0;
        let failedValidation:number = 0;
        const logEntries:LOG_ENTRY[] = [];
        for(const obj of Array.from(response.Contents).reverse().slice(0, maxEntries)) { //keys are timestamped and should be sorted oldest -> latest
            if(!obj.Key || obj.Key.length < 10) {
                missingKeys++;
                continue;
            }

            const entry:LOG_ENTRY|undefined = LOG_ENTRY.constructFromS3Key(obj.Key, validate);
            if(entry)
                logEntries.push(entry);
            else
                failedValidation++;
        }

        if((missingKeys + failedValidation) > 0)
            await saveLogLocally(type, `Local fetchS3LogsByDay skipped ${missingKeys} entries of ${response.Contents.length} with missing keys and ${failedValidation} entries with failed validations.`);

        //Optionally Combine Similar Duplicate Entires
        return (mergeDuplicates) ? LOG_ENTRY.mergeDuplicates(logEntries) : logEntries;
            
    } catch(error) {
        await saveLogLocally(type, 'FAILED - fetchS3LogsByDay', error);
        return [];
    }
}

export const fetchS3LogsByDateRange = async(type:LogType, startTimestamp?:number, endTimestamp?:number, maxEntries:number = LOG_SEARCH_DEFAULT_MAX_ENTRIES, mergeDuplicates:boolean = true):Promise<LOG_ENTRY[]> => {
    const endDate = new Date(endTimestamp ?? new Date().getTime()); //Default to today
    endDate.setHours(0, 0, 0, 0);
    const startDate = new Date(startTimestamp ?? (endDate.getTime() - LOG_SEARCH_DEFAULT_TIMESPAN));
    const promiseQueue:Promise<LOG_ENTRY[]>[] = [];
    const logList:LOG_ENTRY[][] = [];
    while(startDate <= endDate) {
        promiseQueue.push(fetchS3LogsByDay(type, new Date(endDate), maxEntries, mergeDuplicates)); //maintains order end -> start
        
        if(promiseQueue.length >= MAX_PARALLEL_CONNECTIONS) {
            logList.push(...await Promise.all(promiseQueue.splice(0, MAX_PARALLEL_CONNECTIONS)));

            if(logList.flat().length >= maxEntries)
                break; 
        }
        endDate.setDate(endDate.getDate() - 1); //endDate -> startDate
    }

    if(promiseQueue.length > 0 && logList.flat().length < maxEntries) {
        logList.push(...await Promise.all(promiseQueue)); //Process remaining days
    }

    return logList.flat().slice(0, maxEntries);
}
  

//Stream recent entries as a downloadable file
export const streamS3LogsAsFile = async(logType:LogType, response:Response, next:NextFunction):Promise<Response|void> => {
    try {
        const startTime = new Date().getTime() - LOG_SEARCH_DEFAULT_TIMESPAN;
        const logs = await fetchS3LogsByDateRange(logType, startTime, new Date().getTime(), 1000, false);
            
        if(!logs || logs.length === 0)
            throw new Error(`Zero S3 Logs Identified for ${logType} within last 10 days.`);

        // Convert logs to a stream and send it as response
        const logStream = Readable.from(logs.map(entry => `${entry.toString()}\n\n`));
        logStream.pipe(response);

        logStream.on('end', () => {
            writeLogFile(
                new LOG_ENTRY(LogType.EVENT, ['Downloaded last 10 days of S3 logs as a file: ', logType]),
                false //Don't evaluateLogSize
            );
            response.end();
        });

        logStream.on('error', async(error) => {
            await saveLogLocally(logType, `Streaming ${logType} log from S3 as txt file error: `, String(error));
            next(new Exception(500, `Error streaming S3 log type: ${logType}`, 'Failed Stream'));
        });
        return response;
    } catch(error) {
        await saveLogLocally(logType, `Error while attempting to stream ${logType} log from S3 as txt file: `, String(error));
        return next(new Exception(404, `Stream failed to generate for S3 log type: ${logType}`, 'Failed Stream'));
    }
};


/**************************
 * S3 LOG UPLOAD HANDLING *
 **************************/
export const uploadS3LogEntry = async(entry:LOG_ENTRY):Promise<boolean> => {
    const command = new PutObjectCommand({
        Bucket: process.env.LOG_BUCKET_NAME,
        Key: entry.getS3Key(),
        Body: JSON.stringify(entry.toJSON()),
        ContentType: 'text',
    });

    try {
        await s3LogClient.send(command);
        return true;
    } catch(error) {
        await saveLogLocally(entry.type, 'Failed - AWS S3 Log Upload', entry.getS3Key(), error);
        return false;
    }
}

/* Batch Upload | Throttle Connections */
export const uploadS3LogBatch = async (entries:LOG_ENTRY[]): Promise<boolean> => {
    const queue:Promise<boolean>[] = [];
    for(const entry of entries) {
        const task:Promise<boolean> = uploadS3LogEntry(entry); //Handles Local or AWS approach
        queue.push(task);

        if(queue.length >= MAX_PARALLEL_CONNECTIONS) {
            await Promise.race(queue);
            for(let i = queue.length - 1; i >= 0; i--) {
                if(queue[i].catch(() => {}) === Promise.resolve()) {
                    queue.splice(i, 1);
                }
            }
        }
    }

    const results:boolean[] = await Promise.all(queue);
    if (results.every((result) => result)) { //All succeeded
        await saveLogLocally(LogType.EVENT, `Success - AWS S3 batch upload ${results.length}`);
        return true;
    } else { //Any Failed
        await saveLogLocally(LogType.ERROR, `Failed - AWS S3 batch upload ${results.length}`)
        return false;
    }
}


/**************************
 * S3 LOG DELETE HANDLING *
 **************************/
export const deleteS3Log = async(key:string):Promise<boolean> => {
    try {
        const command = new DeleteObjectCommand({
            Bucket: process.env.LOG_BUCKET_NAME,
            Key: key,
        });

        await s3LogClient.send(command);
        return true;
    } catch(error) {
        await saveLogLocally(LogType.ERROR, 'Failed - AWS S3 Log Deleted', key, error);
        return false;
    }
}


export const deleteS3LogsByDay = async(type:LogType, date:Date = new Date()):Promise<boolean> => {
    const params = {
        Bucket: process.env.LOG_BUCKET_NAME,
        Prefix: LOG_ENTRY.createDayS3KeyPrefix(type, date),
    };

     const command = new ListObjectsV2Command(params);
     const response:ListObjectsV2CommandOutput = await s3LogClient.send(command);

     if(!response.Contents || !Array.isArray(response.Contents) || response.Contents.length === 0) {
        if(getEnvironment() === ENVIRONMENT_TYPE.LOCAL) console.log(`Note: Reading S3 Log Day - Zero results for ${LOG_ENTRY.createDayS3KeyPrefix(type, date)}`);
        return false; //No entries matching prefix exist
     }

     let missingKeys:number = 0;
     const deletePromises = response.Contents.map((obj) => {
         if(!obj.Key || obj.Key.length < 10) {
             missingKeys++;
             Promise.resolve(true);
         }

         return deleteS3Log(obj.Key);
     });

     const results:boolean[] = [];
     while(deletePromises.length > 0) {
        const batch = deletePromises.splice(0, MAX_PARALLEL_CONNECTIONS);
        results.push(...await Promise.all(batch));
     }

     const deletionsFailed:number = results.reduce((count, result) => (result === false) ? count++ : count, 0);

     if((missingKeys + deletionsFailed) > 0)
        await saveLogLocally(LogType.WARN, `AWS deleteS3LogsByDay skipped ${missingKeys} entries of ${deletePromises.length} with missing keys and ${deletionsFailed} deletions failed.`);

     return (deletionsFailed === 0);
}


export const deleteS3LogsByDateRange = async(type:LogType, startDate:Date, endDate:Date): Promise<boolean> => {
    const start:Date = new Date(startDate);
    start.setHours(0, 0, 0, 0);
    const end:Date = new Date(endDate);
    end.setHours(0, 0, 0, 0);

    const results:boolean[] = [];
    while(start <= end) {
        results.push(await deleteS3LogsByDay(type, new Date(start)));
        start.setDate(start.getDate() + 1);
    }

    return results.every((result) => result === true);
}
