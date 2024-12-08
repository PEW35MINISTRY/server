import fs, { promises as fsPromises } from 'fs';
import { Response } from 'express';
import readline from 'readline';
import { LOG_DIRECTORY, getLogFilePath, LOG_MAX_SIZE_BYTES, LOG_ROLLOVER_SIZE_BYTES, LOG_ESTIMATE_CONFIDENCE } from './log-types.mjs';
import { LogType } from '../../../0-assets/field-sync/api-type-sync/utility-types.mjs';
import LOG_ENTRY, { logDateRegex } from './logEntryModel.mjs';
import * as log from './log.mjs'; //Only use on read operations
import { getEnvironment } from '../utilities.mjs';
import { ENVIRONMENT_TYPE } from '../../../0-assets/field-sync/input-config-sync/inputField.mjs';
import { Exception } from '../../../1-api/api-types.mjs';


/* WRITE TO FILE */
export const writeLogFile = async(entry:LOG_ENTRY, evaluateLogSize:boolean = true):Promise<Boolean> => {
    try {
        // Ensure the directory exists
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



/* RESET LOG FILE WITH LATEST ENTRIES | May also use to validate and re-write log file */
export const resetLogFile = async(type:LogType, validate:boolean = false):Promise<LOG_ENTRY[]> => {
    const logEntriesKeeping:LOG_ENTRY[] = [];

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

        return new Promise<LOG_ENTRY[]>((resolve) => {
            let entryBuffer = '';
            readInterface.on('line', (line) => {                    
                if(logDateRegex.test(line) && (entryBuffer.length > 10)) {
                    const logEntry:LOG_ENTRY = LOG_ENTRY.constructFromText(entryBuffer.trim());

                    if(!validate) {
                        logEntriesKeeping.push(logEntry);

                    } else {
                        const validationErrorList = logEntry.validate();
                        if(validationErrorList.length === 0)
                            logEntriesKeeping.push(logEntry);
                        else
                            console.log(`NOTE: Resetting ${type} Log Entry - Failed Validation:`, validationErrorList, line.trim());
                    }

                    entryBuffer = '';
                }
                entryBuffer += line + '\n';
            });

            readInterface.on('close', async() => {
                console.log('Reached close with ', logEntriesKeeping.length);

                //Write the retained entries back to the file asynchronously
                await fs.promises.writeFile(getLogFilePath(type), logEntriesKeeping
                    .sort((a,b) => a.getTimestamp() - b.getTimestamp())
                    .map(entry => entry.toString()).join('\n') + '\n', 'utf-8');

                resolve(logEntriesKeeping.slice(-1 * 500).reverse());
            });

            readInterface.on('error', async(error) => {
                await writeLogFile(
                    new LOG_ENTRY((type !== LogType.ERROR) ? LogType.WARN : LogType.ERROR,
                        ['Error resetting log file:', type, getLogFilePath(type), error]
                    ), false);

                resolve([]);
            });                    
        });
        
    } catch (error) {
        await writeLogFile(
            new LOG_ENTRY((type !== LogType.ERROR) ? LogType.WARN : LogType.ERROR,
                ['Invalid Error resetting log file:', type, getLogFilePath(type), error]
            ), false);

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
        
        if(startByte > 0 && getEnvironment() === ENVIRONMENT_TYPE.LOCAL) console.log(`NOTE: Starting to read ${type} log file at byte: ${startByte} of total size: ${await calculateLogSize(type)} bytes.`);

        const readInterface = readline.createInterface({
            input: fs.createReadStream(getLogFilePath(type), { encoding: 'utf-8', start: startByte }),
            crlfDelay: Infinity
        });

        let readNextLine:boolean = true;
        return new Promise((resolve) => {
            let entryBuffer = '';
            readInterface.on('line', (line) => {                   
                if(!readNextLine)
                    return;
                else if(logDateRegex.test(line) && (entryBuffer.length > 10)) {
                    const logEntry:LOG_ENTRY = LOG_ENTRY.constructFromText(entryBuffer.trim());

                    if(!validate) {
                        logEntries.push(logEntry);

                    } else {
                        const validationErrorList = logEntry.validate();
                        if(validationErrorList.length === 0)
                            logEntries.push(logEntry);
                    }

                    entryBuffer = '';

                    if(logEntry.getTimestamp() > endTimeStamp) {
                        readNextLine = false;
                        readInterface.close();
                    }
                }
                entryBuffer += line + '\n';
            });

            readInterface.on('close', () => {
                readNextLine = false;
                resolve(logEntries.slice(-1 * maxEntries).reverse());
            });

            readInterface.on('error', async(error) => {
                readNextLine = false;
                await writeLogFile(
                    new LOG_ENTRY(LogType.ERROR,
                        ['Error reading log file:', type, getLogFilePath(type), error]
                    ), false);
                resolve([]);
            });
        });
    } catch (error) {
        await writeLogFile(
            new LOG_ENTRY(LogType.ERROR,
                ['Error parsing log file:', type, getLogFilePath(type), error]
            ), false);
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
    const selectedList:LOG_ENTRY[] = []; //Local cache tracking duplicates

    return logList
        .filter((entry) => {
            //Filter time range
            if(startTimestamp && endTimestamp && (startTimestamp < endTimestamp)) {
                const entryTimestamp = entry.getTimestamp();

                if(entryTimestamp < startTimestamp || endTimestamp > entryTimestamp)
                    return false;
            }

            //Optionally Combine Similar Duplicate Entires
            if(mergeDuplicates) {
                for(let i = selectedList.length - 1; i >= 0; i--) { //Assume chronologically ordered
                    const recentEntry = selectedList[i];

                    if(!recentEntry.compatibleTime(entry))
                        break;

                    if(entry.similar(recentEntry)) {
                        recentEntry.addDuplicate(entry);
                        return false;
                    }
                }
            }

            //Calculate Search Term Ranking
            if(searchTerm && searchTerm.length >= 1) {
                entry.filterRank = calculateSearchTermRanking(entry, searchTerm);
                if(entry.filterRank < 0)
                    return false;
            }

            selectedList.push(entry);
            return true;
        })
        //Update filterRank to factor in duplicates
        .map((entry) => {
            if(mergeDuplicates && searchTerm && searchTerm.length >= 1 && entry.duplicateList.length > 0)
                entry.filterRank = calculateSearchTermRanking(entry, searchTerm);
            return entry;
        })
        //Priority Sorting
        .sort((a, b) => (b.filterRank !== a.filterRank) ? b.filterRank - a.filterRank 
            : b.getTimestamp() - a.getTimestamp());
    }


//Stream local file to download
export const streamLocalLogFile = async(logType:LogType, response:Response):Promise<Response> => {
    try {     
        log.event('Downloading local log file: ', getLogFilePath(logType))  ;
        await fsPromises.access(getLogFilePath(logType));
        const fileStream = fs.createReadStream(getLogFilePath(logType));

        //Pipe the file stream to the response
        fileStream.pipe(response);

        fileStream.on('error', (error) => {
            log.error(`Streaming ${logType} log from local txt file error: `, error);
        });
        return response;
    } catch (error) { //Not returning Exception, b/c fileStream is ongoing
        log.error(`Error while attempting to stream ${logType} log from local txt file: `, error);
    }
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
        case LogType.ALERT:
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
        case LogType.ALERT:
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
