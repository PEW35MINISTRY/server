import { Exception, JwtSearchRequest } from '../api-types.mjs';
import * as log from '../../2-services/log.mjs';
import { EDIT_PROFILE_FIELDS, EDIT_PROFILE_FIELDS_ADMIN, NOTIFICATION_DEVICE_FIELDS, RoleEnum, SIGNUP_PROFILE_FIELDS, SIGNUP_PROFILE_FIELDS_USER, UserSearchRefineEnum } from '../../0-assets/field-sync/input-config-sync/profile-field-config.mjs';
import { NotificationDeviceSignup, NotificationDeviceVerify, ProfileListItem } from '../../0-assets/field-sync/api-type-sync/profile-types.mjs';
import { LIST_LIMIT, SEARCH_MIN_CHARS } from '../../0-assets/field-sync/input-config-sync/search-config.mjs';
import { DB_SELECT_USER, DB_SELECT_USER_SEARCH, DB_SELECT_USER_SEARCH_CACHE } from '../../2-services/2-database/queries/user-queries.mjs';
import { DB_DELETE_NOTIFICATION_DEVICE_BY_ENDPOINT, DB_INSERT_NOTIFICATION_DEVICE, DB_SELECT_NOTIFICATION_BATCH_ENDPOINT_LIST, DB_SELECT_NOTIFICATION_DEVICE_LIST, DB_SELECT_NOTIFICATION_ENDPOINT, DB_SELECT_NOTIFICATION_ENDPOINT_LIST, DB_SELELCT_NOTIFICATION_DEVICE_ID } from '../../2-services/2-database/queries/notification-queries.mjs';
import { CreatePlatformEndpointCommand, CreatePlatformEndpointCommandOutput, DeleteEndpointCommand, GetEndpointAttributesCommand, GetEndpointAttributesCommandOutput, PublishCommand, SetEndpointAttributesCommand, SNSClient } from '@aws-sdk/client-sns';
import { MultipleRecipientNotificationType, SingleRecipientNotificationType } from './profile-types.mjs';
import { DB_SELECT_CIRCLE, DB_SELECT_CIRCLE_SEARCH } from '../../2-services/2-database/queries/circle-queries.mjs';
import { CircleListItem } from '../../0-assets/field-sync/api-type-sync/circle-types.mjs';


const snsClient = new SNSClient({ region: process.env.SNS_REGION });

// SNS headers for Apple
const SNS_APNS_HEADERS = {
    "AWS.SNS.MOBILE.APNS.PUSH_TYPE":{"DataType":"String","StringValue":"alert"},
    "AWS.SNS.MOBILE.APNS.PRIORITY":{"DataType":"String","StringValue":"5"}
}

const getIndividualPrayerRequestNotificationBody = (username: string) => `New prayer request from ${username}`;
const getCirclePrayerRequestNotificationBody = (username:string, circleName: string) => `New prayer request from ${username} in ${circleName}`;
const getNewPartnershipRequestNotificationBody = (username:string) => `New partnership request from ${username}`;
const getPartnershipAcceptanceNotificationBody = (username:string) => `${username} accepted your partnership request!`;
const getCircleInviteNotificationBody = (username:string, circleName:string) => `${username} has sent an invite to join ${circleName}`;

const getStringifiedNotification = (body:string) => {
    return JSON.stringify({default: `${body}`, GCM: JSON.stringify({ "data": { "body": `${body}`, "priority": "high" }}), APNS: JSON.stringify({"aps":{"content-available":1, "alert": `${body}`}})});
}

export const editProfileFieldAllowed = (field:string, userRole:RoleEnum):boolean => {
    if(userRole === RoleEnum.ADMIN)
        return EDIT_PROFILE_FIELDS_ADMIN.some(inputField => inputField.field === field);
    else
        return EDIT_PROFILE_FIELDS.some(inputField => inputField.field === field);
}

export const signupProfileFieldAllowed = (field:string, userRole:RoleEnum):boolean => {
    if(userRole === RoleEnum.USER)
        return SIGNUP_PROFILE_FIELDS_USER.some(inputField => inputField.field === field);
    else
        return SIGNUP_PROFILE_FIELDS.some(inputField => inputField.field === field);
}


/**************************************************************
 *  CONTENT SEARCH FILTERING BY SEARCH                        *
 * Different from other SearchTypes, applying searchTerm here *
 **************************************************************/
export const filterContactList = async(request:JwtSearchRequest, contactList:ProfileListItem[], statusFilter:string):Promise<ProfileListItem[]> => {
    const searchTerm:string = request.query.search || '';

    if(searchTerm.length >= SEARCH_MIN_CHARS) {
        const resultList = contactList.filter((contact:ProfileListItem) => `${contact.displayName} ${contact.firstName}`.includes(searchTerm));

        //Indicates hit cache limit -> redirect to USER database search
        if(resultList.length === 0 && contactList.length === LIST_LIMIT) {
            log.warn(`Contact Search for user ${request.jwtUserID} exceeded limit of ${LIST_LIMIT}, redirecting to USER search which is global.`, searchTerm);

            return DB_SELECT_USER_SEARCH({searchTerm,  columnList: ['firstName', 'lastName', 'displayName'], excludeGeneralUsers: false, searchInactive: false});
        } else 
            return resultList;
    } else
        return contactList;
}

/********************************
 * AWS SNS ITEGRATION HANDLING *
 ********************************/

const publishNotifications = async (endpointARNs:string[], message:string) => {
    for (const endpoint of endpointARNs) {
        try {
            await snsClient.send(new PublishCommand({
                TargetArn: endpoint,
                Message: message,
                MessageAttributes: SNS_APNS_HEADERS,
                MessageStructure: 'json'
            }));
        } catch (error) {
            // endpoints in Amazon SNS may become disabled if GCM or APNS informs Amazon SNS that the device token used in the publish request was invalid or no longer in use
            if (error.name === "EndpointDisabledException") continue; //cleanUpNotificationDevice(endpoint);

            await log.alert(`AWS SNS :: Server failed to connect to SNS or got invalid response when publishing a notification for: ${endpoint}.`, error);
            throw error;
        }
    }
}

const createEndpoint = async(deviceToken:string):Promise<string> => {
    try {
        const response:CreatePlatformEndpointCommandOutput = await snsClient.send(new CreatePlatformEndpointCommand({
            PlatformApplicationArn: process.env.PLATFORM_APPLICATION_ARN,
            Token: deviceToken
        }));
        return response.EndpointArn;
    } catch (error) {
        await log.alert(`AWS SNS :: Server failed to connect to SNS or got invalid response when creating endpoint for: ${deviceToken}.`, error);
        throw error;
    }
}

const deleteEndpoint = async (endpointARN:string):Promise<void> => {
    try {
        const response = await snsClient.send(new DeleteEndpointCommand({
            EndpointArn: endpointARN
        }));
    } catch (error) {
        await log.alert(`AWS SNS :: Server failed to connect to SNS or got invalid response when deleting an endpoint: ${endpointARN}.`, error);
        throw error;
    }
}

const updateEndpointToken = async(endpointARN:string, deviceToken: string):Promise<void> => {
    try {
        const response = await snsClient.send(new SetEndpointAttributesCommand({
            EndpointArn: endpointARN,
            Attributes: {
                Token: deviceToken
            }
        }));
    } catch (error) {
        await log.alert(`AWS SNS :: Server failed to connect to SNS or got invalid response when updating endpoint for: ${deviceToken}, ${endpointARN}.`, error);
        throw error;
    }
}

const getEndpointToken = async(endpointARN:string):Promise<string> => {
    try {
        const response:GetEndpointAttributesCommandOutput = await snsClient.send(new GetEndpointAttributesCommand({
            EndpointArn: endpointARN,
        }));
        return response.Attributes.Token;
    } catch (error) {
        await log.alert(`AWS SNS :: Server failed to connect to SNS or got invalid response when getting device token from endpoint: ${endpointARN}.`, error);
        throw error;
    }
}


/********************************
 * NOTIFICATION EVENT PROCESSING *
 ********************************/

export const sendNotificationSingleRecipient = async (sender:number, recipient: number, notificationType: SingleRecipientNotificationType, requestSenderDisplayName?:string, circleID?:number) => {
    const senderListItem:ProfileListItem | undefined = requestSenderDisplayName !== undefined ? undefined : await DB_SELECT_USER(new Map([['userID', sender]])).then((user) => user.toListItem());
    const senderDisplayName = senderListItem !== undefined ? senderListItem.displayName : requestSenderDisplayName;

    let message = undefined;
    switch(notificationType) {
        case SingleRecipientNotificationType.CIRCLE_INVITE:
            const circleListItem:CircleListItem = await DB_SELECT_CIRCLE(circleID || -1).then((circle) => circle.toListItem());
            const circleName = circleListItem.name;
            message = getStringifiedNotification(getCircleInviteNotificationBody(senderDisplayName, circleName));
            break;
        case SingleRecipientNotificationType.PARTNERSHIP_ACCEPT:
            message = getStringifiedNotification(getPartnershipAcceptanceNotificationBody(senderDisplayName));
            break;

        case SingleRecipientNotificationType.PARTNERSHIP_REQUEST:
            message = getStringifiedNotification(getNewPartnershipRequestNotificationBody(senderDisplayName));
            break;
        default:
            log.warn(`NOTIFICATION :: Invalid message type ${notificationType} for user ${recipient} from user ${sender}`);
            message = getStringifiedNotification(`${senderDisplayName} has an update for you`);
            break
    }
    const recipientEndpointARNs = await DB_SELECT_NOTIFICATION_ENDPOINT_LIST(recipient);
    await publishNotifications(recipientEndpointARNs, message);
}

export const sendNotificationMultipleRecipient = async (sender:number, recipients:number[], notificationType:MultipleRecipientNotificationType, requestSenderDisplayName?:string, circleID?:number) => {
    const senderListItem:ProfileListItem | undefined = requestSenderDisplayName !== undefined ? undefined : await DB_SELECT_USER(new Map([['userID', sender]])).then((user) => user.toListItem());
    const senderDisplayName = senderListItem !== undefined ? senderListItem.displayName : requestSenderDisplayName;

    let message = undefined;
    switch(notificationType) {
        case MultipleRecipientNotificationType.PRAYER_REQUEST_USER:
            message = getStringifiedNotification(getIndividualPrayerRequestNotificationBody(senderDisplayName));
            break;
        case MultipleRecipientNotificationType.PRAYER_REQUEST_CIRCLE:
            const circleListItem:CircleListItem = await DB_SELECT_CIRCLE(circleID || -1).then((circle) => circle.toListItem());
            const circleName = circleListItem.name;
            message = getStringifiedNotification(getCirclePrayerRequestNotificationBody(senderDisplayName, circleName));
            break;
        default:
            log.warn(`NOTIFICATION :: Invalid message type ${notificationType} for multiple users from user ${sender}`);
            message = getStringifiedNotification(`${senderDisplayName} has an update for you`);
            break
    }
    const recipientARNs = await DB_SELECT_NOTIFICATION_BATCH_ENDPOINT_LIST(recipients);
    await publishNotifications(recipientARNs, message);
}

/********************************
 * NOTIFICATION DEVICE HANDLING *
 ********************************/

const cleanUpNotificationDevice = async (endpointArn:string) => {
    await deleteEndpoint(endpointArn);
    if (!await DB_DELETE_NOTIFICATION_DEVICE_BY_ENDPOINT(endpointArn)) log.warn(`FAILED TO DELETE NOTIFICATION DEVICE FOR ENDPOINT ARN ${endpointArn}`);
}

export const saveNotificationDevice = async(userID:number, notificationDevice:NotificationDeviceSignup):Promise<number> => {
    let { deviceToken, deviceName, deviceOS } = notificationDevice;

    const nameRegex: RegExp = NOTIFICATION_DEVICE_FIELDS.find((input) => input.field === 'deviceName')?.validationRegex || new RegExp(/.{1,255}/);
    const tokenRegex: RegExp = NOTIFICATION_DEVICE_FIELDS.find((input) => input.field === 'deviceToken')?.validationRegex || new RegExp(/.{1,255}/);

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

    } else {
        const endpointArn = await createEndpoint(deviceToken);
        await DB_INSERT_NOTIFICATION_DEVICE(userID, deviceName, endpointArn);

        const deviceIDPromise = await DB_SELELCT_NOTIFICATION_DEVICE_ID(userID, endpointArn);
        const deviceID = deviceIDPromise[0];

        log.event(`Notification device ${deviceID} setup for user ${userID}: ${deviceName}`);
        return deviceID;
    }
};

export const verifyNotificationDevice = async(userID:number, notificationDevice:NotificationDeviceVerify):Promise<boolean> => {
    const { deviceID, deviceToken } = notificationDevice;
    const tokenRegex: RegExp = NOTIFICATION_DEVICE_FIELDS.find((input) => input.field === 'deviceToken')?.validationRegex || new RegExp(/.{1,255}/);

    //Validate Device Information
    if(!deviceID || deviceID <= 0) {
        log.warn('Invalid deviceID, unable to verify a notification device', 'Invalid deviceID', userID);
        return false;
    } else if(!deviceToken || !tokenRegex.test(deviceToken)) {
        log.warn('Invalid notification device detail for user:', userID, 'Invalid deviceToken', deviceToken);
        return false;
    } else {
        const endpointArnList = await DB_SELECT_NOTIFICATION_ENDPOINT(deviceID)
        if (endpointArnList.length !== 1) {
            log.warn('Invalid notification device endpoint for user:', userID, 'Invalid Endpoint', endpointArnList);
            return false;
        }

        const currentDeviceToken = await getEndpointToken(endpointArnList[0]);
        if (currentDeviceToken !== deviceToken) {
            updateEndpointToken(endpointArnList[0], deviceToken);
            log.event(`Notification device token updated for deviceID ${deviceID} belonging to user ${userID}`);

        } else log.event(`Notification device verified for deviceID ${deviceID} belonging to user ${userID}`);
        return true;
    }
}
