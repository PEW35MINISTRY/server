import fs, { PathLike, PathOrFileDescriptor } from 'fs';
import path from 'path';
const __dirname = path.resolve();
import dateFormat from 'dateformat';
import { parse } from 'stack-trace';


/*********************************/
/* Debug Controls */
/*********************************/
const SAVE_LOGS_LOCALLY = process.env.SAVE_LOGS_LOCALLY || true;
const SAVE_LOGS_DATABASE = process.env.SAVE_LOGS_DATABASE || false;
const SEND_EMAILS = process.env.SEND_EMAILS || false;


/*********************************/
// ERROR TYPES
/*********************************/

export enum LOG_TYPE {
    ALERT, ERROR, WARN, AUTH, EVENT
  }

const LOG_TYPE_LABEL = new Map<number, string>([
    [LOG_TYPE.ALERT, 'ALERT'],
    [LOG_TYPE.ERROR, 'ERROR'],
    [LOG_TYPE.WARN, 'WARN'],
    [LOG_TYPE.AUTH, 'AUTH'],
    [LOG_TYPE.EVENT, 'EVENT'],
  ]);

export const getTypeLabel = (type: LOG_TYPE): string => LOG_TYPE_LABEL.get(type);

const LOG_DIRECTORY:PathLike = path.join(__dirname, 'LOGS');
const LOG_ERROR_FILE:PathOrFileDescriptor = path.join(LOG_DIRECTORY, process.env.LOG_ERROR_FILE || 'log-error.txt');
const LOG_WARN_FILE:PathOrFileDescriptor =  path.join(LOG_DIRECTORY, process.env.LOG_WARN_FILE || 'log-warn.txt');
const LOG_EVENT_FILE:PathOrFileDescriptor = path.join(LOG_DIRECTORY, process.env.LOG_EVENT_FILE || 'log-event.txt');
const LOG_AUTH_FILE:PathOrFileDescriptor =  path.join(LOG_DIRECTORY, process.env.LOG_AUTH_FILE || 'log-auth.txt');

export const getLogFilePath = (type:LOG_TYPE):PathLike|PathOrFileDescriptor => {
    switch (type) {
        case LOG_TYPE.WARN: return LOG_WARN_FILE;
        case LOG_TYPE.EVENT: return LOG_EVENT_FILE;
        case LOG_TYPE.AUTH: return LOG_AUTH_FILE;
        default: return LOG_ERROR_FILE;
    }
}


/*********************************/
//  Write to File   [LOCAL] 
/*********************************/
const writeFile = async (type: LOG_TYPE, text: String):Promise<Boolean> => !SAVE_LOGS_LOCALLY ? true : 
    new Promise((resolve, reject) => {
        if (!fs.existsSync(LOG_DIRECTORY)) fs.mkdirSync(LOG_DIRECTORY, { recursive: true});

        fs.appendFile (getLogFilePath(type), `${text}\n`, (error) => {     console.error(text, error);  
            if (error) {console.error(error, text); resolve(false);}
            else resolve(true);
    });});

export const readFile = async(type: LOG_TYPE):Promise<Boolean> => !SAVE_LOGS_LOCALLY ? true : 
    new Promise((resolve, reject) => fs.readFile(getLogFilePath(type), (error) => {     console.error(getTypeLabel(type), error);  
        if (error) {console.error(type, error); resolve(false);}
        else resolve(true);
    }));


/*********************************/
//  Write to Database      
/*********************************/
const writeDatabase = async (type: LOG_TYPE, text: String):Promise<Boolean> => !SAVE_LOGS_DATABASE ? true : false;


/*********************************/
//   SEND EMAIL   
/*********************************/
const sendLogEmail = async (type: LOG_TYPE, body: String):Promise<Boolean> => !SEND_EMAILS ? true : false;

const sendEmail = async (header: String, body: String):Promise<Boolean> => !SEND_EMAILS ? true : false;


/*********************************/
//       Utility Functions     
/*********************************/ 
const formatLogEntry = (type: LOG_TYPE, ...messages: any[]):String => {
    const time = new Date().getTime();
    let trace = '';

    if(type == LOG_TYPE.ERROR || type == LOG_TYPE.ALERT) {
        const stack = parse(new Error());     
        if(stack.length>=2) trace  += `     > ${stack[1].getFunctionName()} = ${stack[1].getLineNumber()}:${stack[1].getColumnNumber()} => ${stack[1].getFileName()}\n`;
        if(stack.length>=3) trace  += `     >> ${stack[2].getFunctionName()} = ${stack[2].getLineNumber()}:${stack[2].getColumnNumber()} => ${stack[2].getFileName()}\n`;
        if(stack.length>=4) trace  += `     >>> ${stack[3].getFunctionName()} = ${stack[3].getLineNumber()}:${stack[3].getColumnNumber()} => ${stack[3].getFileName()}\n`;
    }
    return `[${dateFormat(time, 'm-d-yyyy H:MM:ss',)}] ${getTypeLabel(type)} :: ` + messages.reduce((previous, current)=>previous+=`${current}\n`, '') + trace;
}


/*********************************/
//    Export Log Operations     
/*********************************/ 

export const alert = async(...messages: any[]):Promise<Boolean> => { //console.trace();
    const entry:String = formatLogEntry(LOG_TYPE.ALERT, ...messages);

    return await writeFile(LOG_TYPE.ALERT, entry)
        && await writeDatabase(LOG_TYPE.ALERT, entry)
        && await sendEmail('SERVER ALERT', entry);
}

export const error = async(...messages: any[]):Promise<Boolean> => { //console.trace();
    const entry:String = formatLogEntry(LOG_TYPE.ERROR, ...messages);

    return await writeFile(LOG_TYPE.ERROR, entry)
        && await writeDatabase(LOG_TYPE.ERROR, entry);
}

export default error;

export const warn = async(...messages: any[]):Promise<Boolean> => { //console.trace();
    const entry:String = formatLogEntry(LOG_TYPE.AUTH, ...messages);

    return await writeFile(LOG_TYPE.WARN, entry)
        && await writeDatabase(LOG_TYPE.WARN, entry);
}

export const auth = async(...messages: any[]):Promise<Boolean> => { //console.trace();
    const entry:String = formatLogEntry(LOG_TYPE.AUTH, ...messages);

    return await writeFile(LOG_TYPE.AUTH, entry)
        && await writeDatabase(LOG_TYPE.AUTH, entry);
}

export const event = async(...messages: any[]):Promise<Boolean> => { //console.trace();
    const entry:String = formatLogEntry(LOG_TYPE.EVENT, ...messages);

    return await writeFile(LOG_TYPE.EVENT, entry)
        && await writeDatabase(LOG_TYPE.EVENT, entry);
}
