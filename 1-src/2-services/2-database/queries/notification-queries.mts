import * as log from '../../log.mjs';
import { batch, command, execute, validateColumns } from '../database.mjs';
import { CommandResponseType } from '../database-types.mjs';
import PRAYER_REQUEST from '../../1-models/prayerRequestModel.mjs';
import { CircleListItem } from '../../../0-assets/field-sync/api-type-sync/circle-types.mjs';
import { PrayerRequestCommentListItem, PrayerRequestListItem } from '../../../0-assets/field-sync/api-type-sync/prayer-request-types.mjs';
import { LIST_LIMIT } from '../../../0-assets/field-sync/input-config-sync/search-config.mjs';
import { getModelSourceEnvironment } from '../../10-utilities/utilities.mjs';
import { NotificationDeviceListItem } from '../../../0-assets/field-sync/api-type-sync/notification-types.mjs';


/*****************************************************************************
/*    DEFINING AND HANDLING ALL QUERIES HERE 
/* TABLES: notification_device
******************************************************************************/

/* Prevent SQL Injection Protocol:
* 1) Use Prepared Statements, auto escape input strings
* 2) Validate Column Names
* - Use execute() for Prepared Statements (inputs)
* - Use query() for predefined Select Statements (static)
* - Use command() for database operation (inputs)
*/


/***************************
 *  NOTIFICATION QUERIES   *
 ***************************/

/* INSERT OR UPDATE RECORD | deviceToken triggers UPDATE */
export const DB_INSERT_NOTIFICATION_DEVICE = async(userID:number, deviceName:string, endpointARN:string):Promise<boolean> => {
    const response = await command(
        `INSERT INTO notification_device (userID, deviceName, endpointARN) VALUES (?, ?, ?)`, [userID, deviceName, endpointARN]
    );
    return (response?.affectedRows > 0);
};

export const DB_SELELCT_NOTIFICATION_DEVICE_ID = async(userID:number, endpointArn:string):Promise<number[]> => {
    const rows = await execute(`SELECT deviceID FROM notification_device WHERE userID = ? AND endpointARN = ?`, [userID, endpointArn]);
    
    return rows.map(row => row.deviceID); 
}

/* USER Editable */
export const DB_SELECT_NOTIFICATION_DEVICE_LIST = async(userID:number):Promise<NotificationDeviceListItem[]> => {
    const rows = await execute(`SELECT deviceID, userID, deviceName, modifiedDT FROM notification_device WHERE userID = ?`, [userID]);
    
    return rows.map(row => ({
        deviceID: row.deviceID,
        userID: row.userID,
        deviceName: row.deviceName,
        modifiedDT: row.modifiedDT //ISO string, readonly
    }));
}

export const DB_SELECT_NOTIFICATION_DEVICE_ID = async (deviceID:number):Promise<number[]> => {
    const rows = await execute(`SELECT deviceID FROM notification_device WHERE deviceID = ?`, [deviceID]);
    return rows.map(row => row.deviceID);
}

export const DB_SELECT_NOTIFICATION_DEVICE_BY_ENDPOINT = async (endpointARN:string):Promise<number[]> => {
    const rows = await execute(`SELECT deviceID FROM notification_device WHERE endpointARN = ?`, [endpointARN]);
    return rows.map(row => row.deviceID);
}

export const DB_UPDATE_NOTIFICATION_DEVICE_NAME = async(deviceID:number, deviceName:string):Promise<boolean> => {
    const response:CommandResponseType = await command(`UPDATE notification_device SET deviceName = ? WHERE deviceID = ?;`, [deviceName, deviceID]); 
    
    return ((response !== undefined) && (response.affectedRows === 1));
}

/* Delete Individually by deviceID or All linked to userID */
export const DB_DELETE_NOTIFICATION_DEVICE_BY_USER = async({deviceID, userID}:{deviceID?:number, userID:number}):Promise<boolean> => {
    log.event((deviceID !== undefined) ? `Deleting Notification Device with deviceID: ${deviceID}` : `Deleting Notification Device(s) for userID: ${userID}`);
    
    const response:CommandResponseType = (deviceID !== undefined) ? await command('DELETE FROM notification_device WHERE deviceID = ? ;', [deviceID])
                : await command('DELETE FROM notification_device WHERE userID = ? ;', [userID]);

    return (response !== undefined); //Success on non failure
}

export const DB_DELETE_NOTIFICATION_DEVICE_BY_ENDPOINT = async(endpointARN:string):Promise<boolean> => {
    log.event(`Deleting Endpoint ARN ${endpointARN}`);
        const response:CommandResponseType = await command('DELETE FROM notification_device WHERE endpointARN = ? ;', [endpointARN]);

    return (response !== undefined); //Success on non failure
}

/* AWS Endpoint ARN */
export const DB_SELECT_NOTIFICATION_ENDPOINT_LIST = async(userID:number):Promise<string[]> => {
    const rows = await execute(`SELECT endpointARN FROM notification_device WHERE userID = ?`, [userID]);
    
    return rows.map(row => row.endpointARN); 
}

export const DB_SELECT_NOTIFICATION_ENDPOINT = async(deviceID:number):Promise<string[]> => {
    const rows = await execute(`SELECT endpointARN FROM notification_device WHERE deviceID = ?`, [deviceID]);
    
    return rows.map(row => row.endpointARN); 
}

export const DB_SELECT_NOTIFICATION_BATCH_ENDPOINT_LIST = async(userIDList:number[]):Promise<string[]> => {
    if(userIDList.length === 0 || !Array.isArray(userIDList) || !userIDList.every(id => typeof id === 'number')) {
        log.db('DB_SELECT_NOTIFICATION_BATCH_ENDPOINT_LIST Invalid userIDList:', JSON.stringify(userIDList));
        return [];
    }

    const placeholders = userIDList.map(() => '?').join(',');
    const rows = await execute(`SELECT endpointARN FROM notification_device WHERE userID IN (${placeholders})`, userIDList);
    return rows.map((row) => row.endpointARN);
}
