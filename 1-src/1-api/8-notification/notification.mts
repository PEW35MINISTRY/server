import { NextFunction, Response } from 'express';
import * as log from '../../2-services/10-utilities/logging/log.mjs';
import { Exception } from '../api-types.mjs';
import { JwtClientRequest } from '../2-auth/auth-types.mjs';
import { DB_DELETE_NOTIFICATION_DEVICE_BY_USER, DB_SELECT_NOTIFICATION_DEVICE_DETAILED_BY_ID, DB_SELECT_NOTIFICATION_DEVICE_LIST, DB_SELECT_NOTIFICATION_ENDPOINT, DB_UPDATE_NOTIFICATION_DEVICE, DB_UPDATE_NOTIFICATION_DEVICE_NAME } from '../../2-services/2-database/queries/notification-queries.mjs';
import { NotificationDeviceAdminEditRequest, NotificationDeviceClientRequest, NotificationDeviceNameRequest, NotificationDeviceSignupRequest, NotificationDeviceVerifyRequest } from './notification-types.mjs';
import { deleteNotificationOrphanedEndpoint, saveNotificationDevice, verifyNotificationDevice } from './notification-utilities.mjs';
import { EDIT_NOTIFICATION_DEVICE_FIELDS_ADMIN, NOTIFICATION_DEVICE_FIELDS } from '../../0-assets/field-sync/input-config-sync/notification-field-config.mjs';
import { DeviceVerificationResponseType } from '../../0-assets/field-sync/api-type-sync/notification-types.mjs';
import { DB_SELECT_USER } from '../../2-services/2-database/queries/user-queries.mjs';



// Query the endpointARN on AWS to see if the user's deviceToken has changed since they last login & update
export const POST_verifyNotificationDeviceUser = async (request:NotificationDeviceVerifyRequest, response:Response, next:NextFunction) => {
    
    const result:DeviceVerificationResponseType = await verifyNotificationDevice(request.clientID, request.params.device, request.body.deviceToken);
    switch(result) {
        case DeviceVerificationResponseType.FAILURE:
            return next(new Exception(500, `Failed to verify or update notification device for user: ${request.clientID}`, DeviceVerificationResponseType.FAILURE));
            break;
        case DeviceVerificationResponseType.DELETED:
            return next(new Exception(500, `Failed to verify or update notification device for user: ${request.clientID}`, DeviceVerificationResponseType.DELETED));
            break;
        case DeviceVerificationResponseType.SUCCESS:
            log.event(`Notification device verified for user ${request.clientID} by user ${request.jwtUserID}`, DeviceVerificationResponseType.SUCCESS);
            response.status(200).send(DeviceVerificationResponseType.SUCCESS);
            break
    }
}

export const POST_newNotificationDeviceUser = async (request:NotificationDeviceSignupRequest, response:Response, next:NextFunction) => {

    const deviceID = await saveNotificationDevice(request.clientID, request.body);
    if (deviceID < 0) return next(new Exception(500, `Failed to insert notification device for user: ${request.clientID}`, 'Failed to Save'));
        log.event(`Notification device created for user ${request.clientID} by user ${request.jwtUserID}`);

    response.status(200).send(deviceID.toString());
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


/* ADMIN EDIT Database Routes */
export const GET_notificationDeviceDetailAdmin = async(request:NotificationDeviceClientRequest, response:Response, next:NextFunction) => {

    if(request.params.device === undefined || isNaN(parseInt(request.params.device))) 
        return next(new Exception(400, `Get Notification Device Failed - missing or invalid deviceID parameter: ${request.params.device}`, 'Missing DeviceID'));

    const details = await DB_SELECT_NOTIFICATION_DEVICE_DETAILED_BY_ID(parseInt(request.params.device)); 

    if(details)
        response.status(200).send(details);
    else 
        next(new Exception(404, `Notification Device: ${request.params.device} unavailable from database.`, 'Device Not Found'));
}


export const PATCH_notificationDeviceAdmin = async(request:NotificationDeviceAdminEditRequest, response:Response, next:NextFunction) => {
    const nameRegex: RegExp = EDIT_NOTIFICATION_DEVICE_FIELDS_ADMIN.find((input) => input.field === 'deviceName')?.validationRegex || new RegExp(/.{1,100}/);
    const endpointRegex:RegExp = EDIT_NOTIFICATION_DEVICE_FIELDS_ADMIN.find((input) => input.field === 'endpointARN')?.validationRegex || new RegExp(/.{1,255}/);
    let { deviceName, endpointARN, userID } = request.body;

    if(request.params.device === undefined || isNaN(parseInt(request.params.device))) 
        return next(new Exception(400, `Patch Notification Device Failed - missing or invalid deviceID parameter: ${request.params.device}`, 'Missing DeviceID'));

    //Optional fields, validate if provided
    else if (!deviceName && !endpointARN && !userID)
        return next(new Exception(400, 'Patch Notification Device Failed  - At least one of deviceName, endpointARN, or userID must be provided.', 'Invalid Inputs'));

    else if(userID && !(await DB_SELECT_USER(new Map([['userID', userID]]), false)).isValid)
        return next(new Exception(400, `Patch Notification Device Failed  - UserID ${userID} is invalid`, 'Invalid UserID'));

    else if(deviceName && !nameRegex.test(deviceName))
        return next(new Exception(400, `Patch Notification Device Failed  - Invalid deviceName: ${deviceName}`, 'Invalid deviceName'));

    else if(endpointARN && !endpointRegex.test(endpointARN))
        return next(new Exception(400, `Patch Notification Device Failed  - Invalid endpointARN: ${endpointARN}`, 'Invalid endpointARN'));
    
    deviceName = deviceName.replace(/’/g, "'").trim();
    if(await DB_UPDATE_NOTIFICATION_DEVICE({ deviceID: parseInt(request.params.device), userID, deviceName, endpointARN }) == false)
        return next(new Exception(500, `Patch Notification Device Failed  - Failed to update Database`, 'Update Failed'));
    else
        response.status(202).send(`Notification Device ${request.params.device} details updated successfully.`);
};


//Delete single record by deviceID
export const DELETE_notificationDevice = async (request:NotificationDeviceClientRequest, response:Response, next:NextFunction) => {
    let endpoints = [];

    if(request.params.device === undefined || isNaN(parseInt(request.params.device))) 
        return next(new Exception(400, `Notification Device Delete Failed :: missing deviceID parameter :: ${request.params.device}`, 'Missing DeviceID'));

    endpoints = await DB_SELECT_NOTIFICATION_ENDPOINT(parseInt(request.params.device));

    if(await DB_DELETE_NOTIFICATION_DEVICE_BY_USER({ deviceID: parseInt(request.params.device), userID: request.clientID }) === false)
        return next(new Exception(404, `Notification Device Delete Failed :: Failed to delete device with deviceID: ${request.params.device} for userID: ${request.clientID}`, 'Delete Failed'));

    else {
        await deleteNotificationOrphanedEndpoint(endpoints[0]);
        return response.status(204).send(`Notification Device with deviceID: ${request.params.device} successfully removed for userID: ${request.clientID}`);
    }
    //Event logging, handled in route
};


//Delete all notification device records associated with clientID
export const DELETE_allUserNotificationDevices = async (request:JwtClientRequest, response:Response, next:NextFunction) => {

    if(await DB_DELETE_NOTIFICATION_DEVICE_BY_USER({ userID: request.clientID }) === false)
        return next(new Exception(404, `Notification Device Delete Failed :: Failed to delete devices for userID: ${request.clientID}`, 'Delete Failed'));

    else 
        return response.status(204).send(`All Notification Devices successfully removed for userID: ${request.clientID}`);
    //Event logging, handled in route
};
