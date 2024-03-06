
import { NextFunction, Request, Response } from 'express';
import { IncomingHttpHeaders } from 'http';
import { RoleEnum } from '../../0-assets/field-sync/input-config-sync/profile-field-config.mjs';
import { JwtPayload } from 'jsonwebtoken';
import { ProfileResponse } from '../../0-assets/field-sync/api-type-sync/profile-types.mjs';
import { JwtResponseBody, LoginRequestBody } from '../../0-assets/field-sync/api-type-sync/auth-types.mjs';


/****************************************************************************************
* SERVER SPECIFIC TYPES | AUTH TYPES                                          *
* Server: Additional Types Declared in: 0-assets\field-sync\api-type-sync\auth-types.ts *
*****************************************************************************************/

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
        role: string
    },
    jwt: string,
    jwtUserID: number,
    jwtUserRole: RoleEnum
}

export interface LoginRequest extends Request {
    body: LoginRequestBody
};

export interface LoginResponseBody extends JwtResponseBody {
    userProfile: ProfileResponse,
    service:string
};

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

export interface JwtClientStatusRequest extends JwtClientRequest {
    params: JwtClientRequest['params'] & {
        status?: string
    },
};

export interface JwtClientPartnerRequest extends JwtClientRequest {
    params: JwtClientRequest['params'] & {
        partner:string,
        status?: string
    },
    partnerID:number,
};

export interface JwtCircleRequest extends JwtRequest {
    params: JwtRequest['params'] & {
        circle:string,
        announcement?:string
    },
    circleID: number,
};

export interface JwtContentRequest extends JwtRequest {
    params: JwtRequest['params'] & {
        content:string,
    },
    contentID: number,
};

export interface JwtAdminRequest extends JwtRequest {

};
