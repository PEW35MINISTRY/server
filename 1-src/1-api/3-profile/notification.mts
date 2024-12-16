import { NextFunction, Response } from 'express';
import * as log from '../../2-services/log.mjs';
import { Exception } from '../api-types.mjs';
import { JwtClientRequest } from '../2-auth/auth-types.mjs';
import { DB_DELETE_NOTIFICATION_DEVICE, DB_SELECT_NOTIFICATION_DEVICE_LIST, DB_UPDATE_NOTIFICATION_DEVICE_NAME } from '../../2-services/2-database/queries/notification-queries.mjs';
import { NotificationDeviceDeleteRequest, NotificationDeviceNameRequest, NotificationDeviceSignupRequest, NotificationDeviceVerifyRequest } from './profile-types.mjs';
import { NOTIFICATION_DEVICE_FIELDS } from '../../0-assets/field-sync/input-config-sync/profile-field-config.mjs';
import { saveNotificationDevice, verifyNotificationDevice } from './profile-utilities.mjs';
import { NotificationDeviceVerify } from '../../0-assets/field-sync/api-type-sync/profile-types.mjs';

export const POST_notificationDeviceUser = async (request:NotificationDeviceVerifyRequest, response:Response, next:NextFunction) => {
    // Verify notification device ID. If a device ID is not provided, a new device is registered
    let deviceID = request.body.deviceID;

    if (request.body.deviceID !== undefined) {
        if (await verifyNotificationDevice(request.clientID, request.body) === false)
            next(new Exception(500, `Failed to verify or update notification device for user: ${request.clientID}`, 'Failed to verify or update'));
    }
    else {
        deviceID = await saveNotificationDevice(request.clientID, {deviceToken: request.body.deviceToken});
        if (deviceID < 0) next(new Exception(500, `Failed to insert notification device for user: ${request.clientID}`, 'Failed to Save'));
    }

    response.status(200).send(deviceID);
    log.event(`Notification device created/updated for user ${request.clientID} by user ${request.jwtUserID}`);
}

export const GET_notificationDeviceList = async (request:JwtClientRequest, response:Response) => {
    response.status(200).send(await DB_SELECT_NOTIFICATION_DEVICE_LIST(request.clientID));
    log.event(`Returning notification device list for user ${request.clientID}`);
};


export const PATCH_notificationDeviceName = async (request:NotificationDeviceNameRequest, response:Response, next:NextFunction) => {
    const validationRegex:RegExp = NOTIFICATION_DEVICE_FIELDS.find((input) => input.field === 'deviceName')?.validationRegex || new RegExp(/.{1,255}/);
    const deviceName:string = request.body.deviceName;
    
    if(request.params.device === undefined || isNaN(parseInt(request.params.device))) 
        return next(new Exception(400, `Notification Device name Update Failed :: missing or invalid deviceID parameter :: ${request.params.device}`, 'Missing DeviceID'));

    else if((deviceName === undefined) || !(new RegExp(validationRegex).test(deviceName)))
        return next(new Exception(400, `Notification Device name Update Failed :: invalid deviceName :: ${deviceName}`, 'Invalid Device Name'));

    else if(await DB_UPDATE_NOTIFICATION_DEVICE_NAME(parseInt(request.params.device), deviceName) === false)
        return next(new Exception(500, `Failed to Update Device Name for notification device: ${request.params.device}`, 'Update Failed'));

    else {
        response.status(200).send(`Device Name Updated Successfully`);
        log.event(`Updated Device Name for deviceID: ${request.params.device} belonging to user ${request.clientID}`);
    }
};


//New or Replace Record
export const PUT_notificationDeviceAdmin = async(request:NotificationDeviceSignupRequest, response:Response, next:NextFunction) => {
    
    const deviceID = await saveNotificationDevice(request.clientID, request.body);
    if (deviceID < 0) next(new Exception(500, `Failed to insert or update notification device for user: ${request.clientID}`, 'Failed to Save'));
    else {
        response.status(200).send(deviceID);
        log.event(`Notification device created/updated for user ${request.clientID} by user ${request.jwtUserID}`);
    }
};


//Delete single record by deviceID
export const DELETE_notificationDevice = async (request:NotificationDeviceDeleteRequest, response:Response, next:NextFunction) => {

    if(request.params.device === undefined || isNaN(parseInt(request.params.device))) 
        return next(new Exception(400, `Notification Device Delete Failed :: missing deviceID parameter :: ${request.params.device}`, 'Missing DeviceID'));

    else if(await DB_DELETE_NOTIFICATION_DEVICE({ deviceID: parseInt(request.params.device), userID: request.clientID }) === false)
        return next(new Exception(404, `Notification Device Delete Failed :: Failed to delete device with deviceID: ${request.params.device} for userID: ${request.clientID}`, 'Delete Failed'));

    else 
        return response.status(204).send(`Notification Device with deviceID: ${request.params.device} successfully removed for userID: ${request.clientID}`);
    //Event logging, handled in route
};


//Delete all notification device records associated with clientID
export const DELETE_allUserNotificationDevices = async (request:JwtClientRequest, response:Response, next:NextFunction) => {

    if(await DB_DELETE_NOTIFICATION_DEVICE({ userID: request.clientID }) === false)
        return next(new Exception(404, `Notification Device Delete Failed :: Failed to delete devices for userID: ${request.clientID}`, 'Delete Failed'));

    else 
        return response.status(204).send(`All Notification Devices successfully removed for userID: ${request.clientID}`);
    //Event logging, handled in route
};
