import fs, { promises as fsPromises } from 'fs';
import { NextFunction, Response } from 'express';
import readline from 'readline';
import { LOG_DIRECTORY, getLogFilePath, LOG_MAX_SIZE_BYTES, LOG_ROLLOVER_SIZE_BYTES, LOG_ESTIMATE_CONFIDENCE, SAVE_LOGS_LOCALLY } from './log-types.mjs';
import { LogType } from '../../../0-assets/field-sync/api-type-sync/utility-types.mjs';
import LOG_ENTRY, { logDateRegex } from './logEntryModel.mjs';
import { getEnvironment } from '../utilities.mjs';
import { ENVIRONMENT_TYPE } from '../../../0-assets/field-sync/input-config-sync/inputField.mjs';
import { Exception } from '../../../1-api/api-types.mjs';
/* DO NOT IMPORT [ log from '/10-utilities/logging/log.mjs' ] to AVOID INFINITE LOOP */


/* WRITE TO FILE */
export const writeLogFile = async(entry:LOG_ENTRY, evaluateLogSize:boolean = true):Promise<boolean> => {
    try {
        if(!SAVE_LOGS_LOCALLY) {
            console.error('LOCAL LOGGING DISABLED\n', entry.print());
            return false;
        }

        //Temporary console.log validity
        const errors:string[] = entry.validate();
        if(errors.length > 0) 
            console.log(entry.source, errors);

        //Ensure the directory exists
        if(!await fsPromises.access(LOG_DIRECTORY).catch(() => false))
            await fsPromises.mkdir(LOG_DIRECTORY, { recursive: true });

        await fsPromises.appendFile(getLogFilePath(entry.type), `${entry.toString()}\n\n`, 'utf-8');

        //Evaluate file size & Reduce to latest entries
        const logSize = await calculateLogSize(entry.type);
        if(evaluateLogSize && logSize !== undefined && logSize > LOG_MAX_SIZE_BYTES) {
            await resetLogFile(entry.type);
        }

        return true;
    } catch (error) {
        console.error('Error writing to log file:', entry.type, getLogFilePath(entry.type), error, entry.toString());
        return false;
    }
}


/* Local Utility to write parsing errors to file */
//Use console.log when chance of infinite loop from writing to file errors
const saveLogLocally = async(actionType:LogType, ...messages:string[]):Promise<boolean> =>
    writeLogFile(
        new LOG_ENTRY((actionType !== LogType.ERROR) ? LogType.WARN : LogType.ERROR,
            ['LOCAL LOG UTILITY ERROR', ...messages, actionType, String(getLogFilePath(actionType))]
        ),
        false //Don't evaluateLogSize
    );


/* RESET LOG FILE WITH LATEST ENTRIES | May also use to validate and re-write log file */
export const resetLogFile = async(type:LogType, validate:boolean = false):Promise<LOG_ENTRY[]> => {
    if(!SAVE_LOGS_LOCALLY) {
        console.error(`LOCAL LOGGING DISABLED - Rejecting ${type} resetLogFile`);
        return [];
    }

    try {
        await fsPromises.access(getLogFilePath(type)); //Verify File Exists

        const logSize = await calculateLogSize(type);
        if(logSize <= LOG_ROLLOVER_SIZE_BYTES && !validate)
            return []; //Do Nothing

        console.log(`NOTE: Resetting ${type} log file with size: ${logSize} to be within ${LOG_ROLLOVER_SIZE_BYTES} bytes.`);

        const readInterface = readline.createInterface({
            input: fs.createReadStream(getLogFilePath(type), { encoding: 'utf-8', start: Math.max(0, logSize - LOG_ROLLOVER_SIZE_BYTES) }),
            crlfDelay: Infinity
        });

        const logEntriesKeeping:LOG_ENTRY[] = [];
        return new Promise<LOG_ENTRY[]>((resolve) => {
            let entryBuffer = '';
            readInterface.on('line', (line) => {                    
                if(logDateRegex.test(line) && (entryBuffer.length > 10)) {
                    const logEntry:LOG_ENTRY|undefined = LOG_ENTRY.constructFromText(entryBuffer.trim(), validate);

                    if(logEntry)
                        logEntriesKeeping.push(logEntry);

                    else
                        console.log(`NOTE: Resetting ${type} Log Entry - Failed Validation:`, ...(logEntry?.validate() ?? []), line.trim());

                    entryBuffer = '';
                }
                entryBuffer += line + '\n';
            });

            readInterface.on('close', async() => {
                //Write the retained entries back to the file asynchronously
                await fs.promises.writeFile(getLogFilePath(type), logEntriesKeeping
                    .sort((a,b) => a.getTimestamp() - b.getTimestamp())
                    .map(entry => entry.toString()).join('\n') + '\n', 'utf-8');

                resolve(logEntriesKeeping.slice(-1 * 500).reverse());
            });

            readInterface.on('error', async(error) => {
                await saveLogLocally(type, 'Error - Parsing while resetting local log file.', error);

                resolve([]);
            });                    
        });
        
    } catch (error) {
        await saveLogLocally(type, 'Invalid Error - Resetting local log file.', error);

        return [];
    }
};




/* READ AND PARSE LOG ENTRIES FROM END OF FILE */
export const readLogFile = async (type:LogType, maxEntries:number|undefined = undefined, lastReadIndex:number = 0, endTimeStamp:number = new Date().getTime(), validate:boolean = true):Promise<LOG_ENTRY[]> => {
    const logEntries:LOG_ENTRY[] = [];
    
    try {
        await fsPromises.access(getLogFilePath(type)); //Verify File Exists

        const startByte = (maxEntries === undefined) ? 0 : Math.max(0, 
            Math.floor((await calculateLogSize(type)) 
                - (estimateBytes(type, (lastReadIndex + 1) * maxEntries) 
                    * (2.0 - LOG_ESTIMATE_CONFIDENCE))));
        
        if(startByte > 0 && getEnvironment() === ENVIRONMENT_TYPE.LOCAL) console.log(`NOTE: Reading local ${type} log file at byte: ${startByte} of total size: ${await calculateLogSize(type)} bytes.`);

        const readInterface = readline.createInterface({
            input: fs.createReadStream(getLogFilePath(type), { encoding: 'utf-8', start: startByte }),
            crlfDelay: Infinity
        });

        let readNextLine:boolean = true;
        let skipNextEntry:boolean = (startByte !== 0); //First entry read will be partial, because of byte estimation
        let failedValidation:number = 0;
        return new Promise((resolve) => {
            let entryBuffer = '';
            readInterface.on('line', (line) => {                   
                if(!readNextLine)
                    return;
                else if(logDateRegex.test(line) && (entryBuffer.length > 10)) {
                    if(!skipNextEntry) {
                        const logEntry:LOG_ENTRY|undefined = LOG_ENTRY.constructFromText(entryBuffer.trim(), validate);

                        if(logEntry)
                            logEntries.push(logEntry);

                        else
                            failedValidation++;


                        if(logEntry && logEntry.getTimestamp() > endTimeStamp) {
                            readNextLine = false;
                            readInterface.close();
                        }
                    }
                    skipNextEntry = false;
                    entryBuffer = '';
                }
                entryBuffer += line + '\n';
            });

            readInterface.on('close', async() => {
                readNextLine = false;

                if(failedValidation > 0)
                    await saveLogLocally(type, `Local ReadLogFile skipped ${failedValidation} entries with failed validations.`);

                resolve(logEntries.slice(-1 * (maxEntries ?? 500)).reverse());
            });

            readInterface.on('error', async(error) => {
                readNextLine = false;
                await saveLogLocally(type, 'Error - Parsing while reading local log file.', error);
                resolve([]);
            });
        });
    } catch(error) {
        await saveLogLocally(type, 'Invalid Error - Reading local log file.', error);
        return [];
    }
};
    


/* LOCAL SEARCHING & FILTERING */
const calculateSearchTermRanking = (entry:LOG_ENTRY, search:string):number => {
    if(search === undefined || search.length < 0 || !entry.validateCheck())
        return 1;

    const content = entry.messages.join(' ');
    const duplicateSummaries = entry.duplicateList.join(' '); //Includes Unique Variations
    const words = search.split(/\s+/);

    const fullMatchCount = (content.match(new RegExp(`\\b${search}\\b`, 'g')) || []).length;
    if((content.match(new RegExp(`\\b${search}\\b`, 'g')) || []).length > 1)
        return (18 * fullMatchCount);

    const duplicateFullMatchCount:number = (content.match(new RegExp(`\\b${search}\\b`, 'g')) || []).length;
    if((duplicateSummaries.match(new RegExp(`\\b${search}\\b`, 'g')) || []).length > 1)
        return Math.min(6 * duplicateFullMatchCount, 18); //3x matches 1x fullMatchCount

    //Content Consecutive Partial Match
    else if(content.includes(search))
        return 5;

    //Duplicate Consecutive Partial Match
    else if(duplicateSummaries.includes(search))
        return 4;

    //Individual Words    
    else
        return Math.min(5, //5x words equals content partial match
            words.reduce((count, word) => {
                return count + (new RegExp(`\\b${word}\\b`, 'i').test(content) ? 1 : 0);
            }, 0));
};


export const filterLogEntries = (logList:LOG_ENTRY[], searchTerm?:string, startTimestamp?:number, endTimestamp?:number, mergeDuplicates:boolean = false):LOG_ENTRY[] => {
    let selectedList:LOG_ENTRY[] = logList;

    //Filter time range
    if(startTimestamp && endTimestamp && (startTimestamp < endTimestamp))
        selectedList = selectedList.filter((entry) => (startTimestamp <= entry.getTimestamp() && entry.getTimestamp() <= endTimestamp));

    //Optionally Combine Similar Duplicate Entires
    if(mergeDuplicates)
        selectedList = LOG_ENTRY.mergeDuplicates(selectedList);

    //Update filterRank to factor in duplicates
    if(searchTerm && searchTerm.length >= 1)
        selectedList = selectedList.filter((entry) => {
            if(searchTerm && searchTerm.length >= 1) {
                entry.filterRank = calculateSearchTermRanking(entry, searchTerm);
                return (entry.filterRank > 0);
            } else
                return true;
        });

    //Priority Sorting
    return selectedList.sort((a, b) => (b.filterRank !== a.filterRank) ? b.filterRank - a.filterRank 
        : b.getTimestamp() - a.getTimestamp());
}


//Stream local file to download
export const streamLocalLogFile = async(logType:LogType, response:Response, next:NextFunction):Promise<Response|void> => {
    try {
        writeLogFile(
            new LOG_ENTRY(LogType.EVENT, ['Downloading local log file: ', String(getLogFilePath(logType))]),
            false //Don't evaluateLogSize
        );

        await fsPromises.access(getLogFilePath(logType));
        const fileStream = fs.createReadStream(getLogFilePath(logType));

        //Pipe the file stream to the response
        fileStream.pipe(response);

        fileStream.on('error', async(error) => {
            await saveLogLocally(logType, `Streaming ${logType} log from local txt file error: `, String(error));
            next(new Exception(500, `Error streaming local log file: ${getLogFilePath(logType)}`, 'Failed Stream'));
        });
        return response;
    } catch(error) { //Not returning Exception, b/c fileStream is ongoing
        await saveLogLocally(logType, `Error while attempting to stream ${logType} log from local txt file: `, String(error));
        return next(new Exception(404, `Stream failed to generate for local log file: ${getLogFilePath(logType)}`, 'Failed Stream'));    }
};


/* UTILITIES */
const calculateLogSize = async (type:LogType):Promise<number|undefined> => { //Bytes
    try {
        const stats = await fsPromises.stat(getLogFilePath(type));
        return stats.size;
    } catch (error) {
        console.error(`Error accessing log file: `, getLogFilePath(type), error);
    }
    return undefined;
}

const estimateLine = (type:LogType, bytes:number):number => { 
    switch(type) {
        case LogType.ERROR:
            return Math.floor(bytes / 830);
        case LogType.DB:
            return Math.floor(bytes / 105);
        case LogType.AUTH:
            return Math.floor(bytes / 125);
        default:
            return Math.floor(bytes / 90);
    }
}

const estimateBytes = (type:LogType, entries:number):number => { 
    switch(type) {
        case LogType.ERROR:
            return entries * 830;
        case LogType.DB:
            return entries * 105;
        case LogType.AUTH:
            return entries * 125;
        default:
            return entries * 90;
    }
}
