import { CircleAnnouncementCreateRequestBody } from '../../0-assets/field-sync/api-type-sync/circle-types.mjs'
import { JwtCircleRequest, JwtClientRequest, JwtRequest } from '../2-auth/auth-types.mjs'



/******************************************************************************************
* SERVER SPECIFIC TYPES | CIRCLE TYPES                                                    *
* Server: Additional Types Declared in: 0-assets\field-sync\api-type-sync\circle-types.ts *
*******************************************************************************************/


export interface JwtCircleSearchRequest extends JwtRequest {
    query: {
        search:string,
        filter:string,
        status:string,
        ignoreCache:string
    },
    circleID: number,
};

export interface JwtCircleClientRequest extends JwtClientRequest {
    params: JwtClientRequest['params'] & {
        circle:string,
    },
    circleID: number,
};

export interface CircleAnnouncementCreateRequest extends JwtCircleRequest {
    body: CircleAnnouncementCreateRequestBody
}

export interface CircleImageRequest extends JwtCircleRequest {
    params: JwtCircleRequest['params'] & {
        file:string
    },
    body: Blob
}
