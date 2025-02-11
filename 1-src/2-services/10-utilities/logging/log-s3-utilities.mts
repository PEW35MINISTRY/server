import { Response } from 'express';
import { Readable } from 'stream';
import { DeleteObjectCommand, GetObjectCommand, ListObjectsV2Command, ListObjectsV2CommandOutput, PutObjectCommand, S3Client } from '@aws-sdk/client-s3';
import LOG_ENTRY from './logEntryModel.mjs';
import { LogType } from '../../../0-assets/field-sync/api-type-sync/utility-types.mjs';
import { getEnvironment } from '../utilities.mjs';
import { ENVIRONMENT_TYPE } from '../../../0-assets/field-sync/input-config-sync/inputField.mjs';
import { writeLogFile } from './log-local-utilities.mjs';
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
export const fetchS3LogEntry = async(key:string):Promise<LOG_ENTRY | undefined> => {
    try {
        const command = new GetObjectCommand({
            Bucket: process.env.LOG_BUCKET_NAME,
            Key: key,
        });

        const response = await s3LogClient.send(command);
        const bodyString:string = await response.Body.transformToString();

        const entry:LOG_ENTRY = LOG_ENTRY.constructFromJSON(JSON.parse(bodyString));
        entry.fileKey = key;
        return entry;

    } catch(error) {
        await saveLogLocally(LogType.ERROR, 'Failed - AWS S3 Log Fetch', key, error);
        return undefined;
    }
}

/* Fetch all Logs for a given day */
//Populated only from S3 Key (1024 characters), must use individual fetch to get full message list from body
export const fetchS3LogsByDay = async(type:LogType, date:Date = new Date(), maxEntries:number = 500):Promise<LOG_ENTRY[]> => {
    try {
        const params = {
            Bucket: process.env.LOG_BUCKET_NAME,
            Prefix: LOG_ENTRY.createDayS3KeyPrefix(type, date),
        };
        const command:ListObjectsV2Command = new ListObjectsV2Command(params);
        const response:ListObjectsV2CommandOutput = await s3LogClient.send(command);

        if(!response.Contents || !Array.isArray(response.Contents) || response.Contents.length === 0)
            throw new Error('INVALID - response contents');

        let missingKeys:number = 0;
        let failedValidation:number = 0;
        const logEntries:LOG_ENTRY[] = [];
        for(const obj of Array.from(response.Contents).reverse().slice(0, maxEntries)) { //keys are timestamped and should be sorted oldest -> latest
            if(!obj.Key || obj.Key.length < 10) {
                missingKeys++;
                continue;
            }

            const entry:LOG_ENTRY|undefined = LOG_ENTRY.constructFromS3Key(obj.Key);
            if(entry && entry.validateCheck())
                logEntries.push(entry);
            else
                failedValidation++;
        }

        if((missingKeys + failedValidation) > 0)
            await saveLogLocally(type, `Local fetchS3LogsByDay skipped ${missingKeys} entries of ${response.Contents.length} with missing keys and ${failedValidation} entries with failed validations.`);

        return logEntries;
    } catch(error) {
        await saveLogLocally(type, 'FAILED - fetchS3LogsByDay', error);
        return [];
    }
}

export const fetchS3LogsByDateRange = async(type:LogType, startDate:Date, endDate:Date = new Date(), maxEntries:number = 500):Promise<LOG_ENTRY[]> => {
    const start = new Date(startDate);
    const end = new Date(endDate);
    end.setHours(0, 0, 0, 0);

    const promiseList:Promise<LOG_ENTRY[]>[] = [];
    while(start <= end) {
        promiseList.push(fetchS3LogsByDay(type, end, maxEntries)); //maintains order end -> start
        end.setDate(end.getDate() - 1); //endDate -> startDate
    }

    const logList:LOG_ENTRY[][] = await Promise.all(promiseList);
    return logList.flat().slice(maxEntries); //latest
}


//Stream recent entries as a downloadable file
export const streamS3LogsAsFile = async(logType:LogType, response:Response):Promise<Response> => {
    try {
        writeLogFile(
            new LOG_ENTRY(LogType.EVENT, ['Downloading last 10 days of S3 logs as a file: ', logType]),
            false //Don't evaluateLogSize
        );

        const startTime = Date.now() - 10 * 24 * 60 * 60 * 1000; //10 days
        const logs = await fetchS3LogsByDateRange(logType, new Date(startTime), new Date(), 1000);
            
        // Convert logs to a stream and send it as response
        const logStream = Readable.from(logs.map(log => JSON.stringify(log) + '\n'));
        logStream.pipe(response);

        logStream.on('error', async(error) => {
            await saveLogLocally(logType, `Streaming ${logType} log from S3 as txt file error: `, String(error));
        });
        return response;
    } catch(error) { //Not returning Exception, b/c fileStream is ongoing
        await saveLogLocally(logType, `Error while attempting to stream ${logType} log from S3 as txt file: `, String(error));
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
const MAX_CONNECTIONS:number = (getEnvironment() === ENVIRONMENT_TYPE.LOCAL) ? 10 : 50;
export const uploadS3LogBatch = async (entries: LOG_ENTRY[]): Promise<boolean> => {
    const queue:Promise<boolean>[] = [];
    for(const entry of entries) {
        const task:Promise<boolean> = uploadS3LogEntry(entry); //Handles Local or AWS approach
        queue.push(task);

        if(queue.length >= MAX_CONNECTIONS) {
            await Promise.race(queue);
            for (let i = queue.length - 1; i >= 0; i--) {
                if (queue[i].catch(() => {}) === Promise.resolve()) {
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
        await saveLogLocally(LogType.EVENT, 'Successful - AWS S3 Log Deleted', key);
        return true;
    } catch(error) {
        await saveLogLocally(LogType.ERROR, 'Failed - AWS S3 Log Deleted', key, error);
        return false;
    }
}

export const deleteS3LogsByDay = async(type:LogType, date:Date = new Date()): Promise<boolean> => {
    try {
        const params = {
         Bucket: process.env.LOG_BUCKET_NAME,
         Prefix: LOG_ENTRY.createDayS3KeyPrefix(type, date),
     };

     const command = new ListObjectsV2Command(params);
     const response:ListObjectsV2CommandOutput = await s3LogClient.send(command);

     if(!response.Contents || !Array.isArray(response.Contents) || response.Contents.length === 0)
         throw new Error('INVALID - response contents');

     let missingKeys:number = 0;
     
     const deletePromises = response.Contents.map((obj) => {
         if(!obj.Key || obj.Key.length < 10) {
             missingKeys++;
             Promise.resolve(true);
         }

         return deleteS3Log(obj.Key);
     });

     const results = await Promise.all(deletePromises);
     const deletionsFailed:number = results.reduce((count, result) => (result === false) ? count++ : count, 0);

     if((missingKeys + deletionsFailed) > 0)
        await saveLogLocally(LogType.WARN, `AWS deleteS3LogsByDay skipped ${missingKeys} entries of ${results.length} with missing keys and ${deletionsFailed} deletions failed.`);

     return (deletionsFailed === 0);
 } catch(error) {
     await saveLogLocally(LogType.ERROR, 'FAILED - deleteS3LogsByDay', type, date.toDateString(), error);
     return false;
 }
}

export const deleteS3LogsByDateRange = async(type:LogType, startDate:Date, endDate:Date): Promise<boolean> => {
    try {
        const start:Date = new Date(startDate);
        const end:Date = new Date(endDate);
        end.setHours(0, 0, 0, 0);

        const deletePromises: Promise<boolean>[] = [];

        //Generate delete operations for each day in the range
        while(start <= end) {
            const dateCopy = new Date(start); //Avoid mutation
            deletePromises.push(deleteS3LogsByDay(type, dateCopy));
            start.setDate(start.getDate() + 1); // Increment day
        }

        const results = await Promise.all(deletePromises);
        return results.every((result) => result === true);
    } catch(error) {
        await saveLogLocally(LogType.ERROR, `Failed - Delete logs within date range ${startDate.toISOString()} to ${endDate.toISOString()}:`, error);
        return false;
    }
}
