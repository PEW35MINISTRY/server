
/********************* 
* Notification Types *
**********************/

import { NotificationDeviceSignup, NotificationDeviceVerify } from "../../0-assets/field-sync/api-type-sync/notification-types.mjs";
import { JwtClientRequest } from "../2-auth/auth-types.mjs";

//Admin Insert Manually
export interface NotificationDeviceSignupRequest extends JwtClientRequest {
    body: NotificationDeviceSignup; //Defined in: 1-src\0-assets\field-sync\api-type-sync\profile-types.mts
}

export interface NotificationDeviceVerifyRequest extends JwtClientRequest {
    params: JwtClientRequest['params'] & {
        device:string,
    }
    body: NotificationDeviceVerify;
}

export enum NotificationType {
    PARTNERSHIP_REQUEST = "PARTNERSHIP_REQUEST",
    PARTNERSHIP_ACCEPT = "PARTNERSHIP_ACCEPT",
    PRAYER_REQUEST_RECIPIENT = "PRAYER_REQUEST_RECIPIENT",
}

export enum CircleNotificationType {
    CIRCLE_INVITE = "CIRCLE_INVITE",
    PRAYER_REQUEST_RECIPIENT = "PRAYER_REQUEST_RECIPIENT",
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
