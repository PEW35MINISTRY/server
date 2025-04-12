import { AthenaClient, StartQueryExecutionCommand, GetQueryExecutionCommand, StartQueryExecutionCommandOutput, GetQueryExecutionCommandOutput, GetQueryResultsOutput, GetQueryResultsCommand } from '@aws-sdk/client-athena';
import * as log from './logging/log.mjs';


/********************************************
 * ATHENA QUERY HANDLING                    *
 * Queries need to be polled for completion *
 ********************************************/
export enum AthenaStatus { //May be more
    QUEUED = 'QUEUED',
    RUNNING = 'RUNNING',
    SUCCEEDED = 'SUCCEEDED',
    FAILED = 'FAILED',
    CANCELLED = 'FAILED',
    TIMEOUT = 'TIMEOUT' //Assigned here
}

export interface AthenaQueryResult {
    queryExecutionId:string;
    success:boolean;
    status:AthenaStatus;
    duration:number; //milliseconds
    rows:any[];
}

const athena = new AthenaClient({ region: process.env.ATHENA_REGION });

export const executeAthenaQuery = async(command:StartQueryExecutionCommand, maxDuration:number = 60000):Promise<AthenaQueryResult> => {
    const startTimestamp = new Date().getTime();
    let queryExecutionId = 'NO ID ASSIGNED';
    let status:AthenaStatus = AthenaStatus.QUEUED;

    try {
        const startResponse:StartQueryExecutionCommandOutput = await athena.send(command);
        queryExecutionId = startResponse.QueryExecutionId;

        if(!queryExecutionId) {
            log.error('ATHENA QUERY - FAILED to INITIATE', JSON.stringify(startResponse), JSON.stringify(command));
            return { queryExecutionId:queryExecutionId, success: false, status: AthenaStatus.FAILED, duration: 0, rows: [] };
        }

        //Poll for query completion
        const statusCommand:GetQueryExecutionCommand = new GetQueryExecutionCommand({ QueryExecutionId: queryExecutionId });
        let statusResponse:GetQueryExecutionCommandOutput;
        do {
            statusResponse = await athena.send(statusCommand);  
            status = AthenaStatus[statusResponse.QueryExecution?.Status?.State ?? AthenaStatus.FAILED];

            if([AthenaStatus.SUCCEEDED, AthenaStatus.FAILED, AthenaStatus.CANCELLED, AthenaStatus.TIMEOUT].includes(status)) {
                break;
            }

            await new Promise(resolve => setTimeout(resolve, 2000));

        } while(new Date().getTime() < (startTimestamp + maxDuration));


        /* Evaluate Result */
        if(startResponse && status === AthenaStatus.SUCCEEDED) {
            const duration:number = new Date().getTime() - startTimestamp;
            return { queryExecutionId:queryExecutionId, success:(status === AthenaStatus.SUCCEEDED), status:status, duration:duration, rows:[] };

        } else
            throw new Error('Query Completed Unsuccessfully');
        
    } catch(error) {
        const duration:number = new Date().getTime() - startTimestamp;
        await log.error(`${status} Athena Query - Athena for ${command.input?.QueryExecutionContext?.Database}`, error, error.message,
            'Duration: (ms)', duration, 'Timeout scheduled after: (ms)', maxDuration, 'Query:', command.input?.QueryString);
        return { queryExecutionId:queryExecutionId, success:false, status:(duration >= maxDuration) ? AthenaStatus.TIMEOUT : status, duration:duration, rows:[] };
    }
};


/* Query and Retrieve Row Results */
export type AthenaFieldSchema = Map<string, { type:'string'|'number'|'boolean'|'stringArray'|'numberArray', defaultIndicator:string, defaultApplied:any }>;

export const searchAthenaQuery = async(command:StartQueryExecutionCommand, fieldMap:AthenaFieldSchema = new Map(), maxDuration:number = 60000):Promise<AthenaQueryResult> => {
    let statusResult:AthenaQueryResult = { queryExecutionId:'', success:false, status:AthenaStatus.QUEUED, duration:0, rows:[] };
    try {
        statusResult = await executeAthenaQuery(command, maxDuration);

        if(!statusResult.success) return statusResult;

        const resultCommand = new GetQueryResultsCommand({ QueryExecutionId: statusResult.queryExecutionId });
        const queryResults = await athena.send(resultCommand);
        const rowResults = queryResults.ResultSet?.['ResultRows'] || [];

        if(rowResults.length <= 1) return statusResult;

        //If table sells are null, they are removed from result array and can cause misalignment in matching header fields to data
        if(!fieldMap.size && rowResults.some((row: { Data:string[] }) => row.Data.length !== fields.length))
            log.warn(`Athena Search has missing data and no parsing schema defined - Athena for ${command.input?.QueryExecutionContext?.Database}`, 'Query:', command.input?.QueryString);

        /* Parse Result Rows */
        const fields:string[] = rowResults[0].Data; //First row are fieldNames/Headers
        const rows = rowResults.slice(1).map((row: { Data:string[] }, rowIndex) => {
            const obj: Record<string, any> = {};
            row.Data.filter((v,i) => !fieldMap.size || fieldMap.has(fields[i])).forEach((value, index) => {
                const column:string = fields[index];
                obj[column] =
                    (value === fieldMap.get(column)?.defaultIndicator?.replace(/(['"]|ARRAY)/g, '')) //SQL requires default format: "ARRAY['EMPTY']" to populate: '[EMPTY]'
                        ? fieldMap.get(column).defaultApplied
                        
                    : (value === null || value === undefined || value === 'null' || value === 'undefined') ? undefined
                    
                    /* Parse via fieldMap.type */
                    : (fieldMap.get(column)?.type === 'string')
                        ? String(value)
                    : (fieldMap.get(column)?.type === 'number')
                        ? (isNaN(Number(value)) ? undefined : Number(value))
                    : (fieldMap.get(column)?.type === 'boolean')
                        ? (value === 'true' || value === '1')
                    : (fieldMap.get(column)?.type === 'stringArray')
                        ? parseStringArray(value)
                    : (fieldMap.get(column)?.type === 'numberArray')
                        ? parseStringArray(value).map(v => (isNaN(Number(v)) ? undefined : Number(v)))
                    : value;
            });
            return obj;
        });

        return {...statusResult, rows};

    } catch(error) {
        await log.error(`Failed Fetching Athena Query Results - Athena for ${command.input?.QueryExecutionContext?.Database}`, error, error.message, 'Query:', command.input?.QueryString);
        return {...statusResult, status: AthenaStatus.FAILED};
    }
}



//Partitioning S3 into Athena Table updates the folders (not data) used in query
const MAX_PARTITION_TIMEOUT_MS = 30000; //30sec ~ Estimate 0.00015s/partition ~ For S3 Logs: 200k Days if daily or 8k Days if hourly
export const updateAthenaPartitions = async(databaseName:string, tableName:string, saveBucketLocation:string): Promise<boolean> => {
    if(!databaseName || databaseName.length < 3 || !tableName || tableName.length < 3) {
        log.alert('updateAthenaPartitions - Invalid Athena database names: ', databaseName, tableName);
        return false;
    }

    const params = {
        QueryString: `MSCK REPAIR TABLE ${tableName};`,
        QueryExecutionContext: {
            Database: databaseName,
        },
        ResultConfiguration: { OutputLocation: saveBucketLocation }
    };

    const response:AthenaQueryResult = await executeAthenaQuery(new StartQueryExecutionCommand(params), MAX_PARTITION_TIMEOUT_MS);
    if(response.success)
        log.event(`Athena ${databaseName}.${tableName} partitioning completed.`, 'Duration: (ms)', response.duration);
    else
        log.error(`${response.status} - partitioning Athena ${databaseName}.${tableName}.`);

    return response.success;
}
   



/* UTILITIES */
const parseStringArray = (text:string):string[] => {
    if(!text || typeof text !== 'string') return [];
    text = text.trim();

    //Optionally: remove end brackets
    if(text.startsWith('[') && text.endsWith(']'))
        text = text.slice(1, -1);

    //Preserve groupings inside JSON stringified
    const result: string[] = [];
    let buffer = '';
    let curlyBrackets = 0;
    let squareBrackets = 0;
    let roundBrackets = 0;
    let doubleQuoteCount = 0;
    let singleQuoteCount = 0;

    for(const char of text) {
        // Track brackets
        if(char === '{') curlyBrackets++;
        if(char === '}') curlyBrackets--;
        if(char === '[') squareBrackets++;
        if(char === ']') squareBrackets--;
        if(char === '(') roundBrackets++;
        if(char === ')') roundBrackets--;

        // Track quotes (toggle by incrementing/decrementing)
        if(char === '"') doubleQuoteCount += (doubleQuoteCount % 2 === 0 ? 1 : -1);
        if(char === "'") singleQuoteCount += (singleQuoteCount % 2 === 0 ? 1 : -1);

        // Handle splitting at commas only if not inside any structure
        if(
            char === ',' &&
            curlyBrackets === 0 &&
            squareBrackets === 0 &&
            roundBrackets === 0 &&
            doubleQuoteCount === 0 &&
            singleQuoteCount === 0
        ) {
            result.push(buffer.trim());
            buffer = '';
        } else {
            buffer += char;
        }
    }

    if(buffer.length > 0) {
        result.push(buffer.trim()); // Add last part
    }

    return result;
}
