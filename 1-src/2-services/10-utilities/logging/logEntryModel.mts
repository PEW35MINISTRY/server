import * as log from './log.mjs';
import { LogListItem, LogType } from "../../../0-assets/field-sync/api-type-sync/utility-types.mjs";
import { ENVIRONMENT_TYPE } from "../../../0-assets/field-sync/input-config-sync/inputField.mjs";
import { getEnvironment } from "../utilities.mjs";
import { LOG_SIMILAR_TIME_RANGE, LOG_SOURCE } from "./log-types.mjs";


/* LOG ENTRY OBJECT | Manages import/export with uniform formatting */
export default class LOG_ENTRY {
    date:Date;
    type:LogType;
    messages:string[];
    stackTrace:string[];
    fileKey:string;       //S3 Object Key / File Path
    source:LOG_SOURCE;
    duplicateList:string[] = [];

    filterRank:number = 1; //Temporarily Search Order Ranking

    constructor(type:LogType, messages:string[], stackTrace:string[] = [], fileKey:string = '', date:Date = new Date(), source:LOG_SOURCE = LOG_SOURCE.NEW) {
        this.date = date;
        this.type = type;

//TODO decide if filter or BLANK

        this.messages = messages.map(m => (m === undefined) ? 'UNDEFINED' : (m === null) ? 'NULL' : (m.trim && m.trim().length === 0) ? 'BLANK' : m);   //.filter(m => m.length > 0);
        this.stackTrace = stackTrace.filter(m => m.length > 0);
        this.fileKey = fileKey;
        this.source = source;

        // if((this.source === LOG_SOURCE.NEW) && (getEnvironment() === ENVIRONMENT_TYPE.LOCAL)) this.print();
    }


    /* JSON */
    toJSON = ():LogListItem => ({
        timestamp:this.getTimestamp(),
        type:this.type,
        messages:this.messages,
        stackTrace: (this.stackTrace.length > 0) ? this.stackTrace : undefined,
        fileKey: (this.fileKey.length > 0) ? this.fileKey : undefined,
        duplicateList: (this.duplicateList.length > 0) ? this.duplicateList : undefined,
    });
    

    static constructFromJSON = (json:any):LOG_ENTRY | undefined => {
        try {
            const { timestamp, type, messages, stackTrace, fileKey } = json;
            const logEntry:LOG_ENTRY = new LOG_ENTRY(type, messages, stackTrace ?? [], fileKey, new Date(timestamp), LOG_SOURCE.JSON);

            if(!logEntry.validate(LOG_SOURCE.JSON))
                throw new Error(`Invalid ${LOG_SOURCE.JSON} Log:${JSON.stringify(logEntry.toJSON())}`);
            return logEntry;
        } catch (error) {
            log.error('Failed LOG_ENTRY.constructFromJSON:', error, JSON.stringify(json));
            return undefined;
        }
    }


    /* AWS S3 Storage */
    static createDayS3KeyPrefix = (type:LogType, date:Date):string => {
        const year:number = date.getFullYear();
        const month:string = String(date.getMonth() + 1).padStart(2, '0');
        const day:string = String(date.getDate()).padStart(2, '0');
        return `${type}_${year}/${month}/${day}/`;
    }

    static createHourS3KeyPrefix = (type:LogType, date:Date):string => {
        const hour:string = String(date.getHours()).padStart(2, '0');
        return `${LOG_ENTRY.createDayS3KeyPrefix(type, date)}${hour}/`;
    }

    //S3 Object key: max 1024 characters
    static readonly MAX_KEY_LENGTH:number = 1000;
    getS3Key = (maxCharacters:number = LOG_ENTRY.MAX_KEY_LENGTH):string => 
        (!this.fileKey) ? (this.fileKey = this.createS3Key(maxCharacters)) : this.fileKey;

    createS3Key = (maxCharacters:number = LOG_ENTRY.MAX_KEY_LENGTH):string => {
        const prefix:string = `${LOG_ENTRY.createHourS3KeyPrefix(this.type, this.date)}${this.getMinuteTimestamp()}`;
        let combineMessages: string = this.messages.map(m => filterNonASCII(m).replace(/[^a-zA-Z0-9_-]+/g, '_')).join('~');
        return `${prefix}_${ combineMessages}`.slice(0, (maxCharacters - 5)) + '.json';
    }


    static constructFromS3Key = (fileKey:string):LOG_ENTRY => {
        try {
            //Match createS3Key structure: type + date path + minuteTimestamp + messages
            const regex = /^([^_]+)_(\d{4})\/(\d{2})\/(\d{2})\/(\d{2})\/(\d+)_(.+)\.json$/;
            const match = fileKey.match(regex);
            if(!match) throw new Error(`Invalid fileKey format: ${fileKey}`);
    
            const [, typeString, year, month, day, hour, minuteTimestamp, messagesPart] = match;
    
            const type:LogType = LogType[typeString];    
            const timestampDate = new Date(parseInt(year), parseInt(month) - 1, parseInt(day), parseInt(hour), 0, 0, 0);    
            const timestamp = timestampDate.getTime() + parseInt(minuteTimestamp);    
            const messages:string[] = messagesPart ? messagesPart.replace(/[_]+/g,' ').split('~') : [];
    
            //Construct LOG_ENTRY
            const logEntry = new LOG_ENTRY(type, messages, [], fileKey, new Date(timestamp), LOG_SOURCE.S3_KEY);
            const validationErrors:string[] = logEntry.validate(LOG_SOURCE.S3_KEY);
            if(validationErrors.length > 0)
                throw new Error(`Invalid Validation errors: ${JSON.stringify(validationErrors)}`);
    
            return logEntry;
        } catch(error) {
            log.error('Failed LOG_ENTRY.constructFromS3Key:', error, fileKey);
            return undefined;
        }
    }
    

    /* TEXT */
    createDuplicateSummary = (entry:LOG_ENTRY, maxCharacters:number = 200):string => {
        //Identify First Unique Message
        const uniqueMessages = entry.messages.filter(m => !this.messages.includes(m));
        const summaryMessage = uniqueMessages.length > 0 ? uniqueMessages[0] 
                                : entry.messages[0] || 'Unknown Error';
    
        const prefix:string = formatLogTime(entry.date) + ' :: ';
        return prefix + `${summaryMessage.slice(0, (maxCharacters - prefix.length))}`;
    }

    addDuplicate = (entry:LOG_ENTRY) => this.duplicateList.push(this.createDuplicateSummary(entry));


    toString = ():string => {
        const messageSection:string = (this.messages.length > 0) ? this.messages.join('\n') : '(no message)';
        const traceIndent:number = 4;
        const traceSection:string = (this.stackTrace.length > 0) ?
            '\n' + this.stackTrace.map((trace, idx) => `${' '.repeat(traceIndent)}${'>'.repeat(idx + 1)} ${trace}`).join('\n') : '';

        return formatLogDate(this.date) + ' ' + this.type + ' :: ' + messageSection + traceSection;
    }

    //Sync with output from toString()
    static constructFromText = (text:string):LOG_ENTRY | undefined => {
        try {
            // Step 1: Extract and reformat timestamp
            const timestampString = text.match(/\[(.*?)\]/)?.[1] || '';
            const formattedTimestamp = timestampString.replace(/(\d{2})-(\d{2})-(\d{4})/, '$3-$1-$2');
            const timestamp = new Date(formattedTimestamp);
    
            // Step 2: Extract the log type - word immediately following the first ]
            const typeMatch = text.match(/\] (\w+)/);
            const typePart = typeMatch ? typeMatch[1] : 'ERROR';
            const type = LogType[typePart as keyof typeof LogType] || LogType.ERROR;
    
            // Step 3: Extract the first message - content after the first "::"
            const firstMessageMatch = text.match(/:: (.*)/);
            const firstMessage = firstMessageMatch ? firstMessageMatch[1].trim() : '';
    
            // Step 4: Extract additional messages - consecutive lines that don't start with ">"
            const additionalMessages: string[] = [];
            const lines = text.split('\n');
            let messageSectionStarted = false;
            
            for (const line of lines) {
                const trimmedLine = line.trim();
                if (!messageSectionStarted && trimmedLine.includes('::')) {
                    messageSectionStarted = true;
                    continue; // skip the line with the first message as it's already captured
                }
                if (messageSectionStarted && !trimmedLine.startsWith('>') && trimmedLine.length > 0) {
                    additionalMessages.push(trimmedLine);
                } else if (messageSectionStarted && trimmedLine.startsWith('>')) {
                    break; // stop once we hit stack trace
                }
            }
    
            // Step 5: Extract stack trace - consecutive lines starting with ">"
            const stackTrace: string[] = [];
            let inStackTrace = false;
    
            for(const line of lines) {
                const trimmedLine = line.trim();
                if (trimmedLine.startsWith('>')) {
                    inStackTrace = true;
                    const cleanedLine = trimmedLine.replace(/^>+\s*/, '').trim(); // Remove leading ">" and spaces
                    if (cleanedLine.length > 0) {
                        stackTrace.push(cleanedLine);
                    }
                } else if (inStackTrace) {
                    break; // stop stack trace once non ">" line encountered
                }
            }
    
            // Combine messages into a single array
            const messages = [firstMessage, ...additionalMessages].filter(msg => msg.length > 0);
    
    
            // Step 7: Construct log entry
            const logEntry:LOG_ENTRY = new LOG_ENTRY(type, messages, stackTrace, undefined, timestamp, LOG_SOURCE.TEXT);
    
            // Validate log entry
            if(!logEntry.validateCheck(LOG_SOURCE.TEXT))
                throw new Error(`Invalid ${LOG_SOURCE.TEXT} Log: ${JSON.stringify(logEntry.toJSON())}`);

            return logEntry;
        } catch (error) {
            // console.error('Failed LOG_ENTRY.constructFromText:', error, text);
            return undefined;
        }
    }
        

    print = ():void => {
        switch (this.type) {
            case LogType.ERROR:
                return console.error(this.toString());
            case LogType.WARN:
                return console.warn(this.toString());
            case LogType.EVENT:
                return console.info(this.toString());
            default:
                return console.log(this.toString());
        }
    }


    /* Internal Log Utilities */
    getTimestamp = ():number => this.date.getTime();

    getDailyTimestamp = ():number => this.date.getTime() % 86400000;

    getMinuteTimestamp = ():number => this.date.getTime() % 3600000;

    /* EQUALS COMPARISON */
    equals = (entry:LOG_ENTRY):boolean =>
        this.type === entry.type
        && this.getTimestamp() === entry.getTimestamp()
        && this.messages.length === entry.messages.length
        && this.messages.every((m, i) => m === entry.messages[i]);

    //Pre-test for similar eligibility
    compatibleTime = (entry:LOG_ENTRY):boolean => Math.abs(this.getTimestamp() - entry.getTimestamp()) < LOG_SIMILAR_TIME_RANGE;

    similar = (entry:LOG_ENTRY):boolean =>
        this.type === entry.type
        && this.compatibleTime(entry)
        && this.messages.some(m => entry.messages.includes(m));
        

    /* Validation for Required Fields and Format */
    validateCheck = (destinationSource:LOG_SOURCE = this.source):boolean => !this.validate(destinationSource).length;

    validate = (destinationSource:LOG_SOURCE = this.source):string[] => {
        const errorList:string[] = [];

        if(!(this.date instanceof Date) || isNaN(this.date.getTime()))
            errorList.push(`Invalid ${destinationSource} Log:  date value ${this.date}`);

        if(!Object.values(LogType).includes(this.type))
            errorList.push(`Invalid ${destinationSource} Log: invalid type value ${this.type}`);

        if(!(Array.isArray(this.messages) && this.messages.length > 0))
            errorList.push(`Invalid ${destinationSource} Log: messages required value ${JSON.stringify(this.messages)}`);

        if((destinationSource === LOG_SOURCE.S3_KEY) && (!this.fileKey || this.fileKey.length > LOG_ENTRY.MAX_KEY_LENGTH))
            errorList.push(`Invalid ${destinationSource} Log: fileKey missing or length ${this.fileKey?.length || 0} exceeds maximum ${LOG_ENTRY.MAX_KEY_LENGTH}`);

        if(destinationSource === LOG_SOURCE.S3_KEY) {
            const s3KeyLength = encodeURIComponent(this.getS3Key()).length;
            if(s3KeyLength > LOG_ENTRY.MAX_KEY_LENGTH)
                errorList.push(`Invalid ${destinationSource} Log: S3 key length ${s3KeyLength} exceeds maximum ${LOG_ENTRY.MAX_KEY_LENGTH}`);
        }

        return errorList;
    }
}


/* UTILITIES */

//Replace non-ASCII with ? and remove ; | ASCII characters are a 1:1 bytes
const filterNonASCII = (text:string):string => String(text || '').replace(/[^\x00-\x7F]/g, '?').replace(/;/g, '');

//MM-DD-YYYY HH:MM:SS.mmm
export const logDateRegex: RegExp = new RegExp(/^\[\d{1,2}-\d{1,2}-\d{4} \d{1,2}:\d{1,2}:\d{1,2}(\.\d{1,3})?\]/);

const formatLogDate = (date:Date):string => (!(date instanceof Date) || isNaN(date.getTime())) ? '[]' :
    '['
    + String(date.getMonth() + 1).padStart(2, '0')
    + '-'
    + String(date.getDate()).padStart(2, '0')
    + '-'
    + date.getFullYear()
    + ' '
    + String(date.getHours()).padStart(2, '0')
    + ':'
    + String(date.getMinutes()).padStart(2, '0')
    + ':'
    + String(date.getSeconds()).padStart(2, '0')
    + '.'
    + String(date.getMilliseconds()).padStart(3, '0')
    + ']';

const formatLogTime = (date:Date):string => (!(date instanceof Date) || isNaN(date.getTime())) ? '' :
    '['
    + String(date.getHours()).padStart(2, '0')
    + ':'
    + String(date.getMinutes()).padStart(2, '0')
    + ':'
    + String(date.getSeconds()).padStart(2, '0')
    + '.'
    + String(date.getMilliseconds()).padStart(3, '0')
    + ']';
    