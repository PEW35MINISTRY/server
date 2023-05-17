import { Request, Response, NextFunction} from "express";
import { IncomingHttpHeaders } from "http";
import { DB_USER } from "../../services/database/database-types.mjs";
import { GenderEnum, ProfileResponse, RoleEnum, StageEnum } from "../profile/profile-types.mjs";
import { JwtPayload } from "jsonwebtoken";


/*    Type Declarations     */
export interface JWTData extends JwtPayload {
    jwtUserId: number;
    jwtUserRole:RoleEnum;
    token?: string;
}


export interface SignupRequest extends Request {
    body: {
        email: string, 
        password: string,
        phone: string,
        userRole: RoleEnum,
        token: string,
        displayName: string,
        gender: GenderEnum,
        zipcode: string,
        dailyNotificationHour: number,
        stage: StageEnum,
        profileImage:string
    }
};

export interface LoginRequest extends Request {
    body: {
        'email': string, 
        'password': string
    }
};

export interface JWTRequest extends Request {
    headers: IncomingHttpHeaders & {
      'jwt': string
    },

    jwt?: string,
    jwtUserId?: number,
    jwtUserRole?: RoleEnum
}

export interface JWTClientRequest extends JWTRequest {
    params: {
        client:string
    },
    clientId?:number,
    clientProfile?: DB_USER,
};

export interface IdentityRequest extends JWTRequest {
      headers: JWTRequest['headers'] & {
        'jwt': string, 
        'user-id': number,
      },
      userId?: number,
      userRole?: RoleEnum,
      userProfile?: DB_USER
};

export interface IdentityClientRequest extends IdentityRequest {
    params: {
        client:string
    },
    clientId?:number,
    clientProfile?: DB_USER,
};

export interface IdentityCircleRequest extends IdentityRequest {
    params: {
        circle:string
    },
    circleId?: number,
    circleProfile?:any,
};

export interface IdentityCirclePrayerRequest extends IdentityCircleRequest {
    params: IdentityCircleRequest['params'] & {
        prayer:string
    },
    prayerRequestId?: number,
    prayerRequestProfile?:any
};

export interface IdentityPrayerRequest extends IdentityRequest {
    params: IdentityRequest['params'] & {
        prayer:string
    },
    prayerRequestId?: number,
    prayerRequestProfile?:any
};


export interface LoginResponseBody {
    JWT: string, 
    userId: number, 
    userProfile: ProfileResponse,
    service:string
};

export interface loginResponse extends Response, LoginResponseBody {};