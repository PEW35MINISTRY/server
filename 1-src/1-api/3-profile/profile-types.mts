import { Request } from 'express'
import { ProfileEditRequestBody } from '../../0-assets/field-sync/api-type-sync/profile-types.mjs'
import { JwtClientRequest, JwtRequest } from '../2-auth/auth-types.mjs'



/****************************************************************************************
* SERVER SPECIFIC TYPES | PROFILE TYPES                                                    *
* Server: Additional Types Declared in: 0-assets\field-sync\api-type-sync\profile-types.ts *
*****************************************************************************************/

export interface ProfileEditRequest extends JwtClientRequest {
    body: ProfileEditRequestBody
}

export interface ProfileSignupRequest extends Request  {
    body: Request['body'] & ProfileEditRequestBody
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
