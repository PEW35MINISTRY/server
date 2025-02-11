import assert from 'node:assert';
import { LogListItem, LogType } from "../../../0-assets/field-sync/api-type-sync/utility-types.mjs";
import { LOG_SOURCE } from "./log-types.mjs";
import LOG_ENTRY from "./logEntryModel.mjs";

const entry = new LOG_ENTRY(
    LogType.WARN,
    [
        'Error connecting to database - Initial connection attempt failed - timeout after 30 seconds Possible network issues - server overload - connection retries in progress',
        'Database connection retry failed - Network congestion or server unresponsiveness - time limit reached Further attempts to reconnect scheduled - troubleshooting ongoing',
        'Database connection established after retries - Network load balancing resolved issue - server responded after congestion cleared Query execution next step',
        'Query execution failed - error code 500 - Database internal error, resource limits exceeded - retry mechanism triggered, still failing - impact on client requests under review',
        'Query execution completed with partial results - Timeout occurred during execution - some data fetched, query failed for certain items - manual intervention required to complete operation'
    ],
    [
        'Module.error = 118:19 => file:server/0-compiled/2-services/log.mjs | Module initialization failed - log service failure detected.',
        'null = 314:13 => file:server/0-compiled/server.mjs | Unable to resolve endpoint - server down, further investigation required.',
        'Layer.handle_error = 71:5 => node_modules/express/lib/router/layer.js | Error handler triggered | request processing halted due to critical failure - client notified.'
    ],
    undefined,
    new Date('2025-01-30T23:59:15'),  //Local time
    LOG_SOURCE.NEW
);

const testToStringThenConstructFromText = () => {
    const str:string = entry.toString();
    const newEntry:LOG_ENTRY = LOG_ENTRY.constructFromText(str);
    
    try {
        assert.equal(newEntry.validateCheck(), true, 'testToStringThenConstructFromText - validation failed');
        assert.equal(newEntry.equals(entry), true, 'testToStringThenConstructFromText -> equals match failed');
    
    } catch (error) {
        newEntry.print();
        console.log(newEntry.validate());
        throw error;
    }
};

const testToJsonThenConstructFromJson = () => {
    const json:LogListItem = entry.toJSON();
    const newEntry:LOG_ENTRY = LOG_ENTRY.constructFromJSON(json);
    
    try {
        assert.equal(newEntry.validateCheck(), true, 'testToJsonThenConstructFromJson - validation failed');
        assert.equal(newEntry.equals(entry), true, 'testToJsonThenConstructFromJson -> equals match failed');

    } catch (error) {
        newEntry.print();
        console.log(newEntry.validate());
        throw error;
    }
};

const testCreateKeyThenConstructFromKey = () => {
    const s3Key:string = entry.createS3Key();
    const newEntry = LOG_ENTRY.constructFromS3Key(s3Key);
    
    try {
        assert.equal(newEntry.validateCheck(), true, 'testCreateKeyThenConstructFromKey - validation failed');
        assert.equal(newEntry.similar(entry), true, 'testCreateKeyThenConstructFromKey -> similar match failed');

    } catch (error) {
        newEntry.print();
        console.log(newEntry.validate());
        throw error;
    }
};

export const executeLogTests = () => {
    testToStringThenConstructFromText();
    testToJsonThenConstructFromJson();
    testCreateKeyThenConstructFromKey();
};
