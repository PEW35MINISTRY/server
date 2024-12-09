import { Request } from 'express'
import { Mobile_Device, ProfileEditRequestBody } from '../../0-assets/field-sync/api-type-sync/profile-types.mjs'
import { JwtClientRequest, JwtRequest } from '../2-auth/auth-types.mjs'
import { DeviceOSEnum } from '../../0-assets/field-sync/input-config-sync/inputField.mjs'



/****************************************************************************************
* SERVER SPECIFIC TYPES | PROFILE TYPES                                                    *
* Server: Additional Types Declared in: 0-assets\field-sync\api-type-sync\profile-types.ts *
*****************************************************************************************/

export interface ProfileEditRequest extends JwtClientRequest {
    body: ProfileEditRequestBody & { device?:Mobile_Device }
}

export interface CreateDemoRequest extends JwtRequest {
    query: {
        populate?:string
    }
}

export interface ProfileSignupRequest extends CreateDemoRequest {
    body:Request['body'] & ProfileEditRequestBody & { device?:Mobile_Device }
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
export interface NotificationDeviceRequest extends JwtClientRequest {
    body: Mobile_Device; //Defined in: 1-src\0-assets\field-sync\api-type-sync\profile-types.mts
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
