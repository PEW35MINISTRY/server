import fs, { PathOrFileDescriptor } from 'fs';
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

enum LOG_TYPES {
    ALERT, ERROR, WARN, AUTH, EVENT
  }

const LOG_ERROR_FILE:PathOrFileDescriptor =  process.env.LOG_ERROR_FILE || './LOGS/log-error.txt';
const LOG_WARN_FILE:PathOrFileDescriptor =  process.env.LOG_WARN_FILE || './LOGS/log-warn.txt';
const LOG_EVENT_FILE:PathOrFileDescriptor =  process.env.LOG_EVENT_FILE || './LOGS/log-event.txt';
const LOG_AUTH_FILE:PathOrFileDescriptor =  process.env.LOG_AUTH_FILE || './LOGS/log-auth.txt';

const getLogFile = (type:LOG_TYPES):PathOrFileDescriptor => {
    switch (type) {
        case LOG_TYPES.WARN: return LOG_WARN_FILE;
        case LOG_TYPES.EVENT: return LOG_EVENT_FILE;
        case LOG_TYPES.AUTH: return LOG_AUTH_FILE;
        default: return LOG_ERROR_FILE;
    }
}


/*********************************/
//  Write to File   [LOCAL] 
/*********************************/
const writeFile = async (type: LOG_TYPES, text: String):Promise<Boolean> => !SAVE_LOGS_LOCALLY ? false : 
    new Promise((resolve, reject) => fs.appendFile (getLogFile(type), `${text}\n`, (error) => {     //console.error(text);  
        if (error) {console.error(error, text); reject(false);}
        else resolve(true);
}));

/*********************************/
//  Write to Database      
/*********************************/
const writeDatabase = async (type: LOG_TYPES, text: String):Promise<Boolean> => !SAVE_LOGS_DATABASE ? false : false;

/*********************************/
//   SEND EMAIL   
/*********************************/

const sendLogEmail = async (type: LOG_TYPES, body: String):Promise<Boolean> => !SEND_EMAILS ? false : false;

const sendEmail = async (header: String, body: String):Promise<Boolean> => !SEND_EMAILS ? false : false;

/*********************************/
//       Utility Functions     
/*********************************/ 
const formatLogEntry = (type: LOG_TYPES, ...messages: any[]):String => {
    const time = new Date().getTime();
    let trace = '';

    if(type == LOG_TYPES.ERROR || type == LOG_TYPES.ALERT) {
        const stack = parse(new Error());     
        if(stack.length>=2) trace  += `     > ${stack[1].getFunctionName()} = ${stack[1].getLineNumber()}:${stack[1].getColumnNumber()} => ${stack[1].getFileName()}\n`;
        if(stack.length>=3) trace  += `     >> ${stack[2].getFunctionName()} = ${stack[2].getLineNumber()}:${stack[2].getColumnNumber()} => ${stack[2].getFileName()}\n`;
        if(stack.length>=4) trace  += `     >>> ${stack[3].getFunctionName()} = ${stack[3].getLineNumber()}:${stack[3].getColumnNumber()} => ${stack[3].getFileName()}\n`;
    }
    return `[${dateFormat(time, 'm-d-yyyy H:MM:ss',)}] ${type} :: ` + messages.reduce((previous, current)=>previous+=`${current}\n`, '') + trace;
}

/*********************************/
//    Export Log Operations     
/*********************************/ 

export const alert = async(...messages: any[]):Promise<Boolean> => { //console.trace();
    const entry:String = formatLogEntry(LOG_TYPES.ALERT, ...messages);

    return await writeFile(LOG_TYPES.ALERT, entry)
        && await writeDatabase(LOG_TYPES.ALERT, entry)
        && await sendEmail('SERVER ALERT', entry);
}

export const error = async(...messages: any[]):Promise<Boolean> => { //console.trace();
    const entry:String = formatLogEntry(LOG_TYPES.ERROR, ...messages);

    return await writeFile(LOG_TYPES.ERROR, entry)
        && await writeDatabase(LOG_TYPES.ERROR, entry);
}

export default error;

export const warn = async(...messages: any[]):Promise<Boolean> => { //console.trace();
    const entry:String = formatLogEntry(LOG_TYPES.AUTH, ...messages);

    return await writeFile(LOG_TYPES.WARN, entry)
        && await writeDatabase(LOG_TYPES.WARN, entry);
}

export const auth = async(...messages: any[]):Promise<Boolean> => { //console.trace();
    const entry:String = formatLogEntry(LOG_TYPES.AUTH, ...messages);

    return await writeFile(LOG_TYPES.AUTH, entry)
        && await writeDatabase(LOG_TYPES.AUTH, entry);
}

export const event = async(...messages: any[]):Promise<Boolean> => { //console.trace();
    const entry:String = formatLogEntry(LOG_TYPES.EVENT, ...messages);

    return await writeFile(LOG_TYPES.EVENT, entry)
        && await writeDatabase(LOG_TYPES.EVENT, entry);
}

