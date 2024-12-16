import { Exception, JwtSearchRequest } from '../api-types.mjs';
import * as log from '../../2-services/log.mjs';
import { EDIT_PROFILE_FIELDS, EDIT_PROFILE_FIELDS_ADMIN, NOTIFICATION_DEVICE_FIELDS, RoleEnum, SIGNUP_PROFILE_FIELDS, SIGNUP_PROFILE_FIELDS_USER } from '../../0-assets/field-sync/input-config-sync/profile-field-config.mjs';
import { NotificationDeviceSignup, NotificationDeviceVerify, ProfileListItem } from '../../0-assets/field-sync/api-type-sync/profile-types.mjs';
import { LIST_LIMIT, SEARCH_MIN_CHARS } from '../../0-assets/field-sync/input-config-sync/search-config.mjs';
import { DB_SELECT_USER_SEARCH } from '../../2-services/2-database/queries/user-queries.mjs';
import { DATABASE_DEVICE_OS_ENUM } from '../../2-services/2-database/database-types.mjs';
import { DeviceOSEnum, InputSelectionField } from '../../0-assets/field-sync/input-config-sync/inputField.mjs';
import { DB_INSERT_NOTIFICATION_DEVICE, DB_SELECT_NOTIFICATION_DEVICE_LIST, DB_SELECT_NOTIFICATION_ENDPOINT, DB_SELELCT_NOTIFICATION_DEVICE_ID } from '../../2-services/2-database/queries/notification-queries.mjs';
import { CreatePlatformEndpointCommand, CreatePlatformEndpointCommandOutput, GetEndpointAttributesCommand, GetEndpointAttributesCommandOutput, SetEndpointAttributesCommand, SNSClient } from '@aws-sdk/client-sns';



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

const createEndpoint = async(deviceToken:string):Promise<string> => {
    try {
        const client = new SNSClient({ region: process.env.SNS_REGION });
        const response:CreatePlatformEndpointCommandOutput = await client.send(new CreatePlatformEndpointCommand({
            PlatformApplicationArn: process.env.PLATFORM_APPLICATION_ARN,
            Token: deviceToken
        }));
        return JSON.parse(response.EndpointArn);
    } catch (error) {
        await log.alert(`AWS SNS | Server failed to connect to SNS or got invalid response when creating endpoint for: ${deviceToken}.`, error);
        throw error;
    }
}

const updateEndpointToken = async(endpointARN:string, deviceToken: string):Promise<void> => {
    try {
        const client = new SNSClient({ region: process.env.SNS_REGION });
        const response = await client.send(new SetEndpointAttributesCommand({
            EndpointArn: endpointARN,
            Attributes: {
                Token: deviceToken
            }
        }));
    } catch (error) {
        await log.alert(`AWS SNS | Server failed to connect to SNS or got invalid response when updating endpoint for: ${deviceToken}, ${endpointARN}.`, error);
        throw error;
    }
}

const getEndpointToken = async(endpointARN:string):Promise<string> => {
    try {
        const client = new SNSClient({ region: process.env.SNS_REGION });
        const response:GetEndpointAttributesCommandOutput = await client.send(new GetEndpointAttributesCommand({
            EndpointArn: endpointARN,
        }));
        return JSON.parse(response.Attributes.Token);
    } catch (error) {
        await log.alert(`AWS SNS | Server failed to connect to SNS or got invalid response when getting device token from endpoint: ${endpointARN}.`, error);
        throw error;
    }
}

/********************************
 * NOTIFICATION DEVICE HANDLING *
 ********************************/

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

        const deviceID = await DB_SELELCT_NOTIFICATION_DEVICE_ID(userID, endpointArn)[0];

        log.event(`Notification device setup for user ${userID}: ${deviceName}`);
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
