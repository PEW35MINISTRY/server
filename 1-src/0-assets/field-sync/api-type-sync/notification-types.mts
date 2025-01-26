
/*********** ONLY DEPENDENCIES FROM DIRECTORY: /field-sync/ ***********/


/************************************************************
*    NOTIFICATION DEVICE TYPE CONFIGURATION FILE            *
* Sync across all repositories: server, portal, mobile      *
* Server: 1-src\1-api\8-notification\notification-types.mts *
*************************************************************/

export type NotificationDeviceVerify = {
    deviceID?: number,
    deviceToken: string
}

export type NotificationDeviceSignup = {
    deviceToken: string,
    deviceName?: string,
    deviceOS?: string
}

export interface NotificationDeviceListItem {
    deviceID:number, //Readonly, record in Database
    userID:number,
    deviceName:string,
    modifiedDT:string, //ISO string
    endpointARN?:string //ADMIN detailed
}

export enum DeviceVerificationResponseType {
    FAILURE = "Failed to verify or update notification device :: Bad Request",
    DELETED = "Failed to verify or update notification device :: Notification Device deleted or missing",
    SUCCESS = "Notification device verified :: Success"
}