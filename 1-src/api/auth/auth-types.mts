import { Request, Response, NextFunction} from "express";
import { IncomingHttpHeaders } from "http";
import { ProfileResponse } from "../profile/profile-types.mjs";
import { JwtPayload } from "jsonwebtoken";
import { GenderEnum, RoleEnum } from "../profile/Fields-Sync/profile-field-config.mjs";
import USER from "../../services/models/user.mjs";


/*    Type Declarations     */
export interface JwtData extends JwtPayload {
    jwtUserID: number;
    jwtUserRole:RoleEnum;
    token?: string;
}

export interface JwtRequest extends Request {
    headers: IncomingHttpHeaders & {
      'jwt': string
    },

    jwt?: string,
    jwtUserID?: number,
    jwtUserRole?: RoleEnum
}

export interface JwtResponseBody {
    jwt: string, 
    userID: number, 
    userRole: RoleEnum
};

export interface JWTResponse extends Response, JwtResponseBody {};

export interface LoginRequest extends Request {
    body: {
        'email': string, 
        'password': string
    }
};

export interface LoginResponseBody extends JwtResponseBody {
    userProfile: ProfileResponse,
    service:string
};

export interface LoginResponse extends Response, LoginResponseBody {};

export interface JWTClientRequest extends JwtRequest {
    params: {
        client:string
    },
    clientID?:number,
    clientProfile?: USER,
};

export interface IdentityRequest extends JwtRequest {
      headers: JwtRequest['headers'] & {
        'jwt': string, 
        'user-id': number,
      },
      userID?: number,
      userRole?: RoleEnum,
      userProfile?: USER
};

export interface IdentityClientRequest extends IdentityRequest {
    params: {
        client:string
    },
    clientID?:number,
    clientProfile?: USER,
};

export interface IdentityCircleRequest extends IdentityRequest {
    params: {
        circle:string
    },
    circleID?: number,
    circleProfile?:any,
};

export interface IdentityCirclePrayerRequest extends IdentityCircleRequest {
    params: IdentityCircleRequest['params'] & {
        prayer:string
    },
    prayerRequestID?: number,
    prayerRequestProfile?:any
};

export interface IdentityPrayerRequest extends IdentityRequest {
    params: IdentityRequest['params'] & {
        prayer:string
    },
    prayerRequestID?: number,
    prayerRequestProfile?:any
};
