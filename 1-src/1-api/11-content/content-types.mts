import { ContentMetaDataRequestBody } from '../../0-assets/field-sync/api-type-sync/content-types.mjs'
import { JwtContentRequest, JwtRequest } from '../2-auth/auth-types.mjs'



/******************************************************************************************
* SERVER SPECIFIC TYPES | CONTENT ARCHIVE TYPES                                                    *
* Server: Additional Types Declared in: 0-assets\field-sync\api-type-sync\content-types.ts *
*******************************************************************************************/


export interface ContentImageRequest extends JwtContentRequest {
    params: JwtContentRequest['params'] & {
        file:string
    },
    body: Blob
}

export interface ContentMetaDataRequest extends JwtRequest {
    body: ContentMetaDataRequestBody
}
