import { Request } from 'express'
import { NotificationDeviceSignup, NotificationDeviceVerify, ProfileEditRequestBody } from '../../0-assets/field-sync/api-type-sync/profile-types.mjs'
import { JwtClientRequest, JwtRequest } from '../2-auth/auth-types.mjs'
import { DeviceOSEnum } from '../../0-assets/field-sync/input-config-sync/inputField.mjs'



/****************************************************************************************
* SERVER SPECIFIC TYPES | PROFILE TYPES                                                    *
* Server: Additional Types Declared in: 0-assets\field-sync\api-type-sync\profile-types.ts *
*****************************************************************************************/

export interface ProfileEditRequest extends JwtClientRequest {
    body: ProfileEditRequestBody
}

export interface CreateDemoRequest extends JwtRequest {
    query: {
        populate?:string
    }
}

export interface ProfileSignupRequest extends CreateDemoRequest {
    body:Request['body'] & ProfileEditRequestBody & NotificationDeviceSignup 
    query: {
        populate?:string
    }
}

export interface ProfileImageRequest extends JwtClientRequest {
    params: JwtClientRequest['params'] & {
        file:string
    }
    body: Blob
}

export interface ProfileEditWalkLevelRequest extends JwtClientRequest {
    body: {
        walkLevel:number
    }
}


/********************* 
* Notification Types *
**********************/
//Admin Insert Manually
export interface NotificationDeviceSignupRequest extends JwtClientRequest {
    body: NotificationDeviceSignup; //Defined in: 1-src\0-assets\field-sync\api-type-sync\profile-types.mts
}

export interface NotificationDeviceVerifyRequest extends JwtClientRequest {
    body: NotificationDeviceVerify;
}

export enum SingleRecipientNotificationType {
    PARTNERSHIP_REQUEST = "PARTNERSHIP_REQUEST",
    PARTNERSHIP_ACCEPT = "PARTNERSHIP_ACCEPT",
    CIRCLE_INVITE = "CIRCLE_INVITE"
}

export enum MultipleRecipientNotificationType {
    PRAYER_REQUEST_USER = "PRAYER_REQUEST_USER",
    PRAYER_REQUEST_CIRCLE = "PRAYER_REQUEST_CIRCLE"
}

export interface NotificationDeviceDeleteRequest extends JwtClientRequest {
    params: JwtClientRequest['params'] & {
        device:string,
    }
}

export interface NotificationDeviceNameRequest extends NotificationDeviceDeleteRequest {
    params: NotificationDeviceDeleteRequest['params'] & {
        device:string,
    },
    body: {
        deviceName:string
    }
}
