import { JwtRequest } from "../2-auth/auth-types.mjs";



/*******************************************************************************************
* SERVER SPECIFIC TYPES | CONTENT TYPES                                                    *
* Server: Additional Types Declared in: 0-assets\field-sync\api-type-sync\content-types.ts *
********************************************************************************************/


export interface JwtContentSearchRequest extends JwtRequest {
    query: {
        search:string,
        filter:string,
        ignoreCache:string
    },
    contentID: number,
};
