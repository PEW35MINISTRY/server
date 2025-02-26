import { StartQueryExecutionCommand } from '@aws-sdk/client-athena';
import { AthenaQueryResult, searchAthenaQuery, updateAthenaPartitions } from '../athena.mjs';
import { getEnvironment } from '../utilities.mjs';
import { ENVIRONMENT_TYPE } from '../../../0-assets/field-sync/input-config-sync/inputField.mjs';
import LOG_ENTRY from './logEntryModel.mjs';
import { LogType } from '../../../0-assets/field-sync/api-type-sync/utility-types.mjs';
import * as log from './log.mjs';

/*
    Athena Table to Query S3 Logs
        - Table must be created and saved in AWS Athena
        - Partitions come from fileKey format: type=ERROR/year=2025/month=02/day=06/hour=02
        - Partitions filter scope and allow query to run in parallel (Athena does this automatically)
        - New Partitions must be synced with query: MSCK REPAIR TABLE `ATHENA_LOGS_DEV`.`LOGS_DEV`;

    Table Created: 2/12/2025
    CREATE EXTERNAL TABLE IF NOT EXISTS `ATHENA_LOGS_DEV`.`LOGS_DEV` (
        `timestamp` bigint, `messageSearch` string, `filekey` string, 
        `messages` array<string>, `stackTrace` array<string>, `duplicateList` array<string>
    ) PARTITIONED BY (`type` string, `year` int, `month` int, `day` int)
    ROW FORMAT SERDE 'org.openx.data.jsonserde.JsonSerDe' 
    WITH SERDEPROPERTIES ('ignore.malformed.json' = 'FALSE', 'dots.in.keys' = 'FALSE', 'case.insensitive' = 'TRUE', 'mapping' = 'TRUE') 
    STORED AS 
        INPUTFORMAT 'org.apache.hadoop.mapred.TextInputFormat' 
        OUTPUTFORMAT 'org.apache.hadoop.hive.ql.io.HiveIgnoreKeyTextOutputFormat' 
    LOCATION 's3://pew35-logs-dev/' 
    TBLPROPERTIES ('classification' = 'json');
*/


/**************************
* AWS ATHENA QUERY SEARCH *
***************************/
//NOTE: Parsing Athena Search Results are not perfect and should not be re-uploaded 
const MAX_QUERY_TIMEOUT_MS = 15000; //15 seconds
let lastPartitionUpdateTimestamp:number = 0;
export const athenaSearchS3Logs = async(type:LogType, searchTerm:string, startTimestamp?:number, endTimestamp?:number, maxEntries:number = 1000, mergeDuplicates:boolean = false):Promise<LOG_ENTRY[]> => {
    const endDate = new Date(endTimestamp); //Default to today
    const startDate = new Date(startTimestamp ?? (endDate.getTime() - (7 * 24 * 60 * 60 * 1000))); //7 days

    if(isNaN(startDate.getTime()) || isNaN(endDate.getTime()) || endDate.getTime() < startDate.getTime()) {
        log.warn('athenaSearchS3Logs called with invalid dates: (start/timestamp/end/timestamp)', startDate, startTimestamp, endDate, endTimestamp);
        return [];
    }

    let logList:LOG_ENTRY[] = [];
    //Only update Partitions on first search of session
    if(getEnvironment() !== ENVIRONMENT_TYPE.LOCAL && new Date().getTime() > (lastPartitionUpdateTimestamp + (12 * 60 * 60 * 1000))) { //12h, current log partitions are daily
        if(await updateAthenaPartitions(process.env.LOG_ATHENA_DATABASE, process.env.LOG_ATHENA_TABLE, `s3://${process.env.LOG_BUCKET_NAME}/athena`) === false) //Still attempt search on failure
            logList.push(new LOG_ENTRY(LogType.ERROR, ['***WARNING - Athena partitioning failed and may affect search results***']));
    }

    const query = 
        'WITH ranked AS ( '
        + `SELECT ${Array.from(LOG_ENTRY.JSONFieldDetails.entries()).filter(([key]) => key !== 'timestamp').map((([key]) => key)).join(', ')}, `
            + 'logs_dev.timestamp AS ts, '
            
            /* +18 points for every whole string match surrounded by word boundaries or symbols */
            + `CASE 
                WHEN REGEXP_LIKE(LOWER(messageSearch), '(^|[\\s\\-\\_\\=\\+\\"\\,|\\[\\]\\{\\}<>])${searchTerm.toLowerCase()}($|[\\s\\-\\_\\=\\+\\"\\,|\\[\\]\\{\\}<>])') 
                    THEN ${18}
                ELSE 0 
                END AS fullMatchScore, `

            /* +5 points for every whole string match as a substring | Max 17x points */
            + ` LEAST(${17}, 
                    (LENGTH(messageSearch) - LENGTH(REPLACE(LOWER(messageSearch), '${searchTerm.toLowerCase()}', ''))) 
                        / LENGTH('${searchTerm}') * ${5}
                ) AS partialMatchScore, `

            /* +1 points for individual word matches as a substring | Max 4x points */
            //Approach: First removes all occurrences of searchTerm in messageSearch. The difference in lengths gives the total length of characters removed; finally dividing by searchTerm length gets an occurrence.
            + `LEAST(${4}, (
                    ${searchTerm.split(' ').filter(s => s.trim().length > 0).map(word =>
                        `  (LENGTH(messageSearch) - LENGTH(REPLACE(LOWER(messageSearch), '${word.trim().toLowerCase()}', ''))) 
                            / LENGTH('${word.trim()}') `
                    ).join(' + ')}
                )) AS wordMatchScore `

        + `FROM ${process.env.LOG_ATHENA_DATABASE}.${process.env.LOG_ATHENA_TABLE} `

        /* Filter via partitions defined in S3 key | (Athena will query in parallel) */
        + `WHERE logs_dev.type = '${type}' `
            + `AND logs_dev.year >= ${startDate.getFullYear()} AND logs_dev.year <= ${endDate.getFullYear()} `  //year is always sequential
            + `${(startDate.getMonth() <= endDate.getMonth() && startDate.getFullYear() === endDate.getFullYear()) //Months within same year
                ? `AND logs_dev.month >= ${startDate.getMonth() + 1} AND logs_dev.month <= ${endDate.getMonth() + 1} ` : ''}`

            + `${(startDate.getDate() <= endDate.getDate() && startDate.getMonth() === endDate.getMonth() && startDate.getFullYear() === endDate.getFullYear()) //Days within same month
                ? `AND logs_dev.day >= ${startDate.getDate()} AND logs_dev.day <= ${endDate.getDate()} ` : ''}`

            + `AND logs_dev.timestamp >= ${startDate.getTime()} AND logs_dev.timestamp <= ${endDate.getTime()} `
        +') '

        //Apply placeholders for empty columns, otherwise omitted in results array | ('timestamp' is a SQL keyword)
        + `SELECT ${Array.from(LOG_ENTRY.JSONFieldDetails.entries()).filter(([key]) => key !== 'timestamp').map(([key, value]:[string, { defaultIndicator:string }]) => `COALESCE(${key}, ${value.defaultIndicator}) AS ${key}`).join(', ')}, `
            + 'ts AS timestamp, '
            + '(fullMatchScore + partialMatchScore + wordMatchScore) AS score '
            + 'FROM ranked '
            + 'WHERE (fullMatchScore + partialMatchScore + wordMatchScore) > 0 '
            + 'ORDER BY score DESC, ts DESC '
            + `LIMIT ${maxEntries};`;

    const queryExecutionCommand = new StartQueryExecutionCommand({
        QueryString: query,
        QueryExecutionContext: { Database: process.env.LOG_ATHENA_DATABASE },
        ResultConfiguration: { OutputLocation: `s3://${process.env.LOG_BUCKET_NAME}/athena` }
    });

    const response:AthenaQueryResult = await searchAthenaQuery(queryExecutionCommand, LOG_ENTRY.JSONFieldDetails, MAX_QUERY_TIMEOUT_MS);

    logList.push(...
        response.rows.map((row:{string:string}) => 
            LOG_ENTRY.constructFromJSON(row)
        ));

    //Remove any that failed to parse
    logList = logList.filter((entry:LOG_ENTRY) => entry && entry.validateCheck());
    if(logList.length < response.rows.length)
        log.warn(`ATHENA SEARCH - failed to parse ${response.rows.length - logList.length} rows of ${response.rows.length} log entries queried.`, type, searchTerm, startDate.getTime(), endDate.getTime(), query);

    //Optionally Combine Similar Duplicate Entires
    return (mergeDuplicates) ? LOG_ENTRY.mergeDuplicates(logList) : logList;
}
