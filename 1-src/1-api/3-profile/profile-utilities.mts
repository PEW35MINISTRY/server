import { Exception, JwtSearchRequest } from '../api-types.mjs';
import * as log from '../../2-services/log.mjs';
import { EDIT_PROFILE_FIELDS, EDIT_PROFILE_FIELDS_ADMIN, NOTIFICATION_DEVICE_FIELDS, RoleEnum, SIGNUP_PROFILE_FIELDS, SIGNUP_PROFILE_FIELDS_USER } from '../../0-assets/field-sync/input-config-sync/profile-field-config.mjs';
import { Mobile_Device, ProfileListItem } from '../../0-assets/field-sync/api-type-sync/profile-types.mjs';
import { LIST_LIMIT, SEARCH_MIN_CHARS } from '../../0-assets/field-sync/input-config-sync/search-config.mjs';
import { DB_SELECT_USER_SEARCH } from '../../2-services/2-database/queries/user-queries.mjs';
import { DATABASE_DEVICE_OS_ENUM } from '../../2-services/2-database/database-types.mjs';
import { DeviceOSEnum, InputSelectionField } from '../../0-assets/field-sync/input-config-sync/inputField.mjs';
import { DB_INSERT_NOTIFICATION_DEVICE, DB_SELECT_NOTIFICATION_DEVICE_TOKEN, DB_UPDATE_NOTIFICATION_DEVICE } from '../../2-services/2-database/queries/notification-queries.mjs';


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
 * NOTIFICATION DEVICE HANDLING *
 ********************************/
export const saveNotificationDevice = async(userID:number, notificationDevice:Mobile_Device):Promise<boolean> => {
    let { deviceOS, deviceToken, deviceName } = notificationDevice;

    const nameRegex: RegExp = NOTIFICATION_DEVICE_FIELDS.find((input) => input.field === 'deviceName')?.validationRegex || new RegExp(/.{1,255}/);
    const tokenRegex: RegExp = NOTIFICATION_DEVICE_FIELDS.find((input) => input.field === 'deviceToken')?.validationRegex || new RegExp(/.{1,255}/);
    const operatingSystemOptionList: string[] = (NOTIFICATION_DEVICE_FIELDS.find((input) => input.field === 'deviceOS') as InputSelectionField)?.selectOptionList || Object.values(DeviceOSEnum);

    //Configure Defaults & Custom Settings
    if(!deviceName || deviceName.length <= 1) deviceName = `User ${userID} ${String(deviceOS ?? 'Device').toLowerCase()}`;
    else deviceName = deviceName.replace(/’/g, "'").trim(); //Two types of apostrophes 

    //Validate Device Information
    if(!userID || userID <= 0) {
        log.warn('Invalid userID, unable to assign a notification device', 'Invalid userID', userID);
        return false;

    } else if(!deviceName || !nameRegex.test(deviceName)) {
        log.warn('Invalid notification device detail for user:', userID, 'Invalid deviceName', deviceName);
        return false;

    } else if(!deviceToken || !tokenRegex.test(deviceToken)) {
        log.warn('Invalid notification device detail for user:', userID, 'Invalid deviceToken', deviceToken);
        return false;

    } else if(!deviceOS || !operatingSystemOptionList.includes(deviceOS) || DATABASE_DEVICE_OS_ENUM[deviceOS] === undefined) {
        log.warn('Invalid notification device detail for user:', userID, 'Invalid deviceOS', deviceOS);
        return false;

    } else if(await DB_INSERT_NOTIFICATION_DEVICE(userID, deviceName, deviceToken, DATABASE_DEVICE_OS_ENUM[deviceOS]) === false) {
        log.error('Failed to setup notifications for user:', userID, JSON.stringify(notificationDevice));
        return false;

    } else {
        log.event(`Notification device setup for user ${userID}: ${deviceName}`);
        return true;
    }
};

export const verifyNotificationDevice = async(userID:number, deviceID: number, deviceToken:string):Promise<boolean> => {
    const tokenRegex: RegExp = NOTIFICATION_DEVICE_FIELDS.find((input) => input.field === 'deviceToken')?.validationRegex || new RegExp(/.{1,255}/);

    //Validate Device Information
    if(!userID || userID <= 0) {
        log.warn('Invalid userID, unable to verify a notification device', 'Invalid userID', userID);
        return false;
    } if(!deviceID || deviceID <= 0) {
        log.warn('Invalid deviceID, unable to verify a notification device', 'Invalid deviceID', userID);
        return false;
    } else if(!deviceToken || !tokenRegex.test(deviceToken)) {
        log.warn('Invalid notification device detail for user:', userID, 'Invalid deviceToken', deviceToken);
        return false;
    } else if (DB_SELECT_NOTIFICATION_DEVICE_TOKEN(deviceID)[0] !== deviceToken) {
        const result = DB_UPDATE_NOTIFICATION_DEVICE(deviceID, deviceToken);
        log.event(`Notification device token updated for deviceID ${deviceID} belonging to user ${userID}`);
        return result;
    } else {
        log.event(`Notification device verified for deviceID ${deviceID} belonging to user ${userID}`);
        return true;
    }
}
