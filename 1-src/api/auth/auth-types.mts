import { Request, Response, NextFunction} from "express";
import { IncomingHttpHeaders } from "http";
import { ProfileResponse } from "../profile/profile-types.mjs";
import { JwtPayload } from "jsonwebtoken";
import { RoleEnum } from "../../services/models/Fields-Sync/profile-field-config.mjs";


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
    params: {
        search: string,
        role: string
    },
    jwt: string,
    jwtUserID: number,
    jwtUserRole: RoleEnum
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

export interface JwtPrayerRequest extends JwtRequest {
    params: JwtRequest['params'] & {
        prayer: string,
        comment?: string
    },
    prayerRequestID: number,
};

export interface JwtClientRequest extends JwtRequest {
    params: JwtRequest['params'] & {
        client:string
    },
    clientID:number,
};

export interface JwtCircleRequest extends JwtRequest {
    params: JwtRequest['params'] & {
        circle:string,
        announcement?:string
    },
    circleID: number,
};

export interface JwtCircleClientRequest extends JwtClientRequest {
    params: JwtClientRequest['params'] & {
        circle:string,
    },
    circleID: number,
};

export interface JwtAdminRequest extends JwtRequest {

};
