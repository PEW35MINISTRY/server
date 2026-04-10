import { RoleEnum } from '../0-assets/field-sync/input-config-sync/profile-field-config.mjs';
import { JwtRequest } from "./2-auth/auth-types.mjs";


/************************************
* SERVER SPECIFIC TYPES | API TYPES *
*************************************/

export class Exception extends Error {
    status: number;
    message: string;
    notification: string;
    
    constructor(status: number, message: string, notification?: string) {
      super(message);
      this.status = status;
      this.message = message;
      this.notification = notification;
    }
  }

  export enum ImageTypeEnum {
    USER_PROFILE = 'USER_PROFILE',
    CIRCLE_PROFILE = 'CIRCLE_PROFILE',
    CIRCLE_EVENT = 'CIRCLE_EVENT',
    CONTENT_THUMBNAIL = 'CONTENT_THUMBNAIL',
  }

  //Mock HTTP JwtRequest for method calls
  export const generateJWTRequest = (userID:number, userRole:RoleEnum = RoleEnum.USER, query:Record<string, any> = {}, body:Record<string, any> = {}):JwtRequest => 
    ({
      jwtUserID: userID,
      jwtUserRole: userRole,
      params: {},
      query,
      body
    }) as JwtRequest;


  export interface JwtSearchRequest extends JwtRequest {
        query: {
            search:string,
            refine:string,
            filter:string,
            ignoreCache:string
        },
        params: JwtRequest['params'] & {
            type?: string
        },
    };
