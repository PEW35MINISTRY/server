import * as log from '../../2-services/10-utilities/logging/log.mjs';
import { NOTIFICATION_DEVICE_FIELDS } from '../../0-assets/field-sync/input-config-sync/notification-field-config.mjs';
import { ProfileListItem } from '../../0-assets/field-sync/api-type-sync/profile-types.mjs';
import { DB_SELECT_USER } from '../../2-services/2-database/queries/user-queries.mjs';
import {  DB_INSERT_NOTIFICATION_DEVICE, DB_SELECT_NOTIFICATION_BATCH_ENDPOINT_LIST, DB_SELECT_NOTIFICATION_BATCH_ENDPOINT_MAP, DB_SELECT_NOTIFICATION_DEVICE_BY_ENDPOINT, DB_SELECT_NOTIFICATION_DEVICE_ID, DB_SELECT_NOTIFICATION_ENDPOINT } from '../../2-services/2-database/queries/notification-queries.mjs';
import { CreatePlatformEndpointCommand, CreatePlatformEndpointCommandOutput, DeleteEndpointCommand, GetEndpointAttributesCommand, GetEndpointAttributesCommandOutput, PublishCommand, SetEndpointAttributesCommand, SNSClient } from '@aws-sdk/client-sns';
import { CircleNotificationType, NotificationType } from './notification-types.mjs';
import { DB_SELECT_CIRCLE } from '../../2-services/2-database/queries/circle-queries.mjs';
import { CircleListItem } from '../../0-assets/field-sync/api-type-sync/circle-types.mjs';
import { DeviceVerificationResponseType, NotificationDeviceSignup } from '../../0-assets/field-sync/api-type-sync/notification-types.mjs';
import { DeviceOSEnum, ENVIRONMENT_TYPE } from '../../0-assets/field-sync/input-config-sync/inputField.mjs';
import { getEnvironment } from '../../2-services/10-utilities/utilities.mjs';

const snsClient = new SNSClient({ region: process.env.SNS_REGION });

// SNS headers for Apple
const SNS_APNS_HEADERS = {
    "AWS.SNS.MOBILE.APNS.PUSH_TYPE":{"DataType":"String","StringValue":"alert"},
    "AWS.SNS.MOBILE.APNS.PRIORITY":{"DataType":"String","StringValue":"10"}
}


/********************************
 * NOTIFICATION TEMPLATE BODIES *
 ********************************/
const getIndividualPrayerRequestNotificationBody = (username: string) => `New prayer request from ${username}`;
const getCirclePrayerRequestNotificationBody = (username:string, circleName: string) => `New prayer request from ${username} in ${circleName}`;
const getNewPartnershipRequestNotificationBody = (username:string) => `You have a new prayer partner contract available with ${username}`;
const getPartnershipAcceptanceNotificationBody = (username:string) => `${username} accepted the prayer partner contract`;
const getCircleInviteNotificationBody = (username:string, circleName:string) => `${username} has sent an invite to join ${circleName}`;

const getStringifiedNotification = (body:string) => {
    return JSON.stringify({default: `${body}`, GCM: JSON.stringify({ "data": { "body": `${body}`, "priority": "high"}}), APNS: JSON.stringify({"aps":{"content-available":1, "alert": `${body}`}})});
}


/********************************
 *  AWS SNS ITERATION HANDLING  *
 ********************************/
//Send identical message to all recipients
const publishNotifications = async(endpointARNs:string[], message:string):Promise<boolean> => {
    const endPointMessageMap = new Map(endpointARNs.map(endpoint => [endpoint, message]));
    return await publishNotificationPairedMessages(endPointMessageMap);
};

//Send Individual messages to each recipient
const publishNotificationPairedMessages = async(endPointMessageMap: Map<string, string>):Promise<boolean> => {
    const publishPromises = Array.from(endPointMessageMap.entries()).map(async ([endpoint, message]:[string, string]) => {
        try {
            console.log("Sendong notification ", endpoint, message);
            await snsClient.send(new PublishCommand({
                TargetArn: endpoint,
                Message: message,
                MessageAttributes: SNS_APNS_HEADERS,
                MessageStructure: 'json'
            }));
            return true;

        } catch (error) {
            // endpoints in Amazon SNS may become disabled if GCM or APNS informs Amazon SNS that the device token used in the publish request was invalid or no longer in use
            if(error.name === "EndpointDisabledException") {         
                //cleanUpNotificationDevice(endpoint);
                return true;
            }
            await log.warn(`AWS SNS :: Server failed to connect to SNS or got invalid response when publishing a notification for: ${endpoint}.`, error, error.message);
            return false;
        }
    });

    return (await Promise.allSettled(publishPromises))
            .every(result => result.status === "fulfilled" && result.value === true);
};


export const createEndpoint = async(deviceToken:string, deviceOS:DeviceOSEnum):Promise<string> => {
    try {
        const response:CreatePlatformEndpointCommandOutput = await snsClient.send(new CreatePlatformEndpointCommand({
            PlatformApplicationArn: deviceOS === DeviceOSEnum.ANDROID ? process.env.FIREBASE_PLATFORM_APPLICATION_ARN : [ENVIRONMENT_TYPE.LOCAL, ENVIRONMENT_TYPE.DEVELOPMENT].includes(getEnvironment()) ? process.env.APNS_DEV_PLATFORM_APPLICATION_ARN : process.env.APNS_PROD_PLATFORM_APPLICATION_ARN,
            Token: deviceToken
        }));
        return response.EndpointArn;
    } catch (error) {
        await log.error(`AWS SNS :: Server failed to connect to SNS or got invalid response when creating endpoint for: ${deviceToken}.`, error, error.message);
        return null;
    }
}

const deleteEndpoint = async (endpointARN:string):Promise<void> => {
    try {
        const response = await snsClient.send(new DeleteEndpointCommand({
            EndpointArn: endpointARN
        }));
    } catch (error) {
        await log.warn(`AWS SNS :: Server failed to connect to SNS or got invalid response when deleting an endpoint: ${endpointARN}.`, error, error.message);
    }
}

const updateEndpointToken = async(endpointARN:string, deviceToken: string):Promise<void> => {
    try {
        const response = await snsClient.send(new SetEndpointAttributesCommand({
            EndpointArn: endpointARN,
            Attributes: {
                Token: deviceToken,
                Enabled: 'true'
            }
        }));
    } catch (error) {
        await log.warn(`AWS SNS :: Server failed to connect to SNS or got invalid response when updating endpoint for: ${deviceToken}, ${endpointARN}.`, error, error.message);
    }
}

const getEndpointToken = async(endpointARN:string):Promise<string> => {
    try {
        const response:GetEndpointAttributesCommandOutput = await snsClient.send(new GetEndpointAttributesCommand({
            EndpointArn: endpointARN,
        }));
        return response.Attributes.Token;
    } catch (error) {
        await log.warn(`AWS SNS :: Server failed to connect to SNS or got invalid response when getting device token from endpoint: ${endpointARN}.`, error, error.message);
    }
}


/********************************
 * NOTIFICATION EVENT PROCESSING *
 ********************************/

export const sendNotificationCircle = async (senderID:number, recipientIDList: number[], circleID:number, notificationType:CircleNotificationType, requestSenderDisplayName?:string):Promise<boolean> => {
    const senderListItem:ProfileListItem | undefined = requestSenderDisplayName !== undefined ? undefined : await DB_SELECT_USER(new Map([['userID', senderID]])).then((user) => user.toListItem());
    const senderDisplayName = senderListItem !== undefined ? senderListItem.displayName : requestSenderDisplayName;

    const circleListItem:CircleListItem = await DB_SELECT_CIRCLE(circleID || -1).then((circle) => circle.toListItem());
    const circleName = circleListItem.name;

    let message = undefined;
    switch (notificationType) {
        case CircleNotificationType.PRAYER_REQUEST_RECIPIENT:
            message = getCirclePrayerRequestNotificationBody(senderDisplayName, circleName);
            break;
        case CircleNotificationType.CIRCLE_INVITE:
            message = getCircleInviteNotificationBody(senderDisplayName, circleName);
            break;
        default:
            log.warn(`NOTIFICATION :: Invalid notification type ${notificationType} for circle [${circleID}] for users [${recipientIDList.join(', ')}] from user ${senderID}`);
            message = `${senderDisplayName} has an update for you`;
            break;
    }

    return await sendNotificationMessage(recipientIDList, message);
}

export const sendTemplateNotification = async (senderID:number, recipientIDList: number[], notificationType: NotificationType, requestSenderDisplayName?:string):Promise<boolean> => {
    const senderListItem:ProfileListItem | undefined = requestSenderDisplayName !== undefined ? undefined : await DB_SELECT_USER(new Map([['userID', senderID]])).then((user) => user.toListItem());
    const senderDisplayName = senderListItem !== undefined ? senderListItem.displayName : requestSenderDisplayName;

    let message = undefined;
    switch(notificationType) {
        case NotificationType.PARTNERSHIP_ACCEPT:
            message = getPartnershipAcceptanceNotificationBody(senderDisplayName);
            break;
        case NotificationType.PARTNERSHIP_REQUEST:
            message = getNewPartnershipRequestNotificationBody(senderDisplayName);
            break;
        case NotificationType.PRAYER_REQUEST_RECIPIENT:
            message = getIndividualPrayerRequestNotificationBody(senderDisplayName);
            break;
        default:
            log.warn(`NOTIFICATION :: Invalid notification type ${notificationType} for users [${recipientIDList.join(', ')}] from user ${senderID}`);
            message = `${senderDisplayName} has an update for you`;
            break
    }
    return await sendNotificationMessage(recipientIDList, message);
}

export const sendNotificationMessage = async(recipientIDList:number[], message:string):Promise<boolean> => {
    const recipientEndpointARNs:string[] = await DB_SELECT_NOTIFICATION_BATCH_ENDPOINT_LIST(recipientIDList);
    return publishNotifications(recipientEndpointARNs, getStringifiedNotification(message));
}

export const sendNotificationPairedMessage = async(messageMap:Map<number, string>):Promise<boolean> => {
    const userIDEndpointMap:Map<number, string> = await DB_SELECT_NOTIFICATION_BATCH_ENDPOINT_MAP(Array.from(messageMap.keys()));

    const endpointMessageMap = new Map(
        Array.from(userIDEndpointMap.entries())
            .filter(([userID, endpointARN]) => messageMap.has(userID) && endpointARN.length > 0)
            .map(([userID, endpointARN]) => [endpointARN, getStringifiedNotification(messageMap.get(userID)!)])
    );

    return await publishNotificationPairedMessages(endpointMessageMap); //<endpointARN, message>
}


/********************************
 * NOTIFICATION DEVICE HANDLING *
 ********************************/

export const deleteNotificationOrphanedEndpoint = async (endpointArn:string):Promise<void> => {
    // check to see if any notification devices are still using a endpoint ARN. if not, delete it
    const endpoints = await DB_SELECT_NOTIFICATION_DEVICE_BY_ENDPOINT(endpointArn);
    if (endpoints.length === 0) await deleteEndpoint(endpointArn);
}

export const saveNotificationDevice = async(userID:number, notificationDevice:NotificationDeviceSignup):Promise<number> => {
    let { deviceToken, deviceName, deviceOS } = notificationDevice;

    const nameRegex: RegExp = NOTIFICATION_DEVICE_FIELDS.find((input) => input.field === 'deviceName')?.validationRegex || new RegExp(/.{1,100}/);
    const tokenRegex: RegExp = NOTIFICATION_DEVICE_FIELDS.find((input) => input.field === 'deviceToken')?.validationRegex || new RegExp(/.{1,255}/);
    const deviceOSRegex: RegExp = NOTIFICATION_DEVICE_FIELDS.find((input) => input.field === 'deviceOS')?.validationRegex || new RegExp(/^ANDROID|IOS$/);

    //Configure Defaults & Custom Settings
    if(!deviceName || deviceName.length <= 1) deviceName = `User ${userID} ${String(deviceOS ?? 'Device').toLowerCase()}`;
    else deviceName = deviceName.replace(/’/g, "'").trim(); //Two types of apostrophes 

    //Validate Device Information
    if(!deviceName || !nameRegex.test(deviceName)) {
        log.warn('Invalid notification device detail for user:', userID, 'Invalid deviceName', deviceName);
        return -1;
    } else if(!deviceToken || !tokenRegex.test(deviceToken)) {
        log.warn('Invalid notification device detail for user:', userID, 'Invalid deviceToken', deviceToken);
        return -1;
    } else if (!deviceOS || !deviceOSRegex.test(deviceOS)) {
        log.warn('Invalid notification device detail for user:', userID, 'Invalid deviceOS', deviceOS);
        return -1;
    } else {
        const endpointArn = await createEndpoint(deviceToken, deviceOS);
        await DB_INSERT_NOTIFICATION_DEVICE(userID, deviceName, endpointArn);

        const deviceIDPromise = await DB_SELECT_NOTIFICATION_DEVICE_ID({userID, endpointArn});
        const deviceID = deviceIDPromise[0];

        log.event(`Notification device ${deviceID} setup for user ${userID}: ${deviceName}`);
        return deviceID;
    }
};

// Query the endpointARN on AWS to see if the user's deviceToken has changed since they last logged in through email and update it if is has
export const verifyNotificationDevice = async(userID:number, device:string, deviceToken:string):Promise<DeviceVerificationResponseType> => {
    const tokenRegex: RegExp = NOTIFICATION_DEVICE_FIELDS.find((input) => input.field === 'deviceToken')?.validationRegex || new RegExp(/.{1,255}/);
    const deviceID = parseInt(device);

    //Validate Device Information
    if(!deviceID || deviceID <= 0) {
        log.warn('Invalid deviceID, unable to verify a notification device', 'Invalid deviceID', userID);
        return DeviceVerificationResponseType.FAILURE;
    } else if(!deviceToken || !tokenRegex.test(deviceToken)) {
        log.warn('Invalid notification device detail for user:', userID, 'Invalid deviceToken', deviceToken);
        return DeviceVerificationResponseType.FAILURE;
    } else {
        const endpointArnList = await DB_SELECT_NOTIFICATION_ENDPOINT(deviceID)
        if (endpointArnList.length !== 1) {
            // Check to see if the user logged into a different deleted to this device
            const devices = await DB_SELECT_NOTIFICATION_DEVICE_ID({deviceID});
            if (devices.length === 0) {
                log.event(`Cannot update deviceToken for a notification device [${deviceID}] that no longer exists. Register a new notification device to receive notifications.`);
                return DeviceVerificationResponseType.DELETED;
            }
            else {
                log.error('Invalid notification device endpoint for user:', userID, 'Invalid Endpoint', endpointArnList);
                return DeviceVerificationResponseType.FAILURE;
            }
        }

        const currentDeviceToken = await getEndpointToken(endpointArnList[0]);
        if (currentDeviceToken !== deviceToken) {
            updateEndpointToken(endpointArnList[0], deviceToken);
            log.event(`Notification device token updated for deviceID ${deviceID} belonging to user ${userID}`);

        } else log.event(`Notification device verified for deviceID ${deviceID} belonging to user ${userID}`);
        return DeviceVerificationResponseType.SUCCESS;
    }
}
