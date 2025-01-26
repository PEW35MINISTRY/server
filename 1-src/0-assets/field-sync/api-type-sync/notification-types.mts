import { DeviceOSEnum } from "../input-config-sync/inputField.mjs"

export type NotificationDeviceVerify = {
    deviceID?: number,
    deviceToken: string
}

export type NotificationDeviceSignup = {
    deviceToken: string,
    deviceName?: string,
    deviceOS?: DeviceOSEnum
}

export type NotificationDeviceListItem = {
    deviceID:number, //Readonly, record in Database
    userID:number,
    deviceName:string,
    modifiedDT:string //ISO string
}

export enum DeviceVerificationResponseType {
    FAILURE = "Failed to verify or update notification device :: Bad Request",
    DELETED = "Failed to verify or update notification device :: Notification Device deleted or missing",
    SUCCESS = "Notification device verified :: Success"
}