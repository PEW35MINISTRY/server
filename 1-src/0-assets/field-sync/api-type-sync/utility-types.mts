
/*********************************
*    ADDITIONAL UTILITY TYPES    *
**********************************/
/* Server Error | Toast Display: ServerErrorResponse.notification */
export interface ServerErrorResponse {
    status: number,
    notification: string,
};

export interface ServerDebugErrorResponse extends ServerErrorResponse {
    status: number,
    notification: string,
    message: string,
    action: string,
    type: string,
    url: string,
    params: string,
    query: string,
    header: string | object,
    body: string | object
};


/* EMAIL TYPES & HANDLING */
export enum EmailReport {
    USER = 'USER',
    LOG = 'LOG'
}


/* SERVER LOG CATEGORIES & TYPES */
//Server Additional Types: 1-src\2-services\10-utilities\logging\log-types.mts
export enum LogLocation {
    LOCAL = 'LOCAL', 
    S3 = 'S3',
}

export enum LogType {
    ERROR = 'ERROR', 
    WARN = 'WARN', 
    DB = 'DB', 
    AUTH = 'AUTH', 
    EVENT = 'EVENT',
}

//JSON form of LOG_ENTRY
export type LogListItem = { 
    timestamp:number; 
    type:LogType; 
    messages:string[]; 
    messageSearch:string; //Combine string for AWS Athena query
    stackTrace?:string[]; 
    fileKey?:string; 
    duplicateList?:string[]; 
};
