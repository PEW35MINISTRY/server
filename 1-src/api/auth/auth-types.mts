import { Request, Response, NextFunction} from "express";
import { IncomingHttpHeaders } from "http";
import { DB_USER } from "../../services/database-types.mjs";
import { GenderEnum, ProfileResponse, RoleEnum, StageEnum } from "../profile/profile-types.mjs";


/*    Type Declarations     */
export interface SignupRequest extends Request {
    body: {
        email: string, 
        password: string,
        phone: string,
        userRole: RoleEnum,
        displayName: string,
        gender: GenderEnum,
        zipcode: string,
        dailyNotificationHour: number,
        stage: StageEnum,
        profileImage:string
    }
};

export interface LoginRequest extends Request {
    headers: IncomingHttpHeaders & {
        'email': string, 
        'password': string
    }
};

export interface CredentialRequest extends Request {
      headers: IncomingHttpHeaders & {
        'jwt': string, 
        'user-id': number,
      },
      userId?: number,
      userProfile?: DB_USER,
};

export interface CircleRequest extends CredentialRequest {
    params: {
        circle:string
    },
    circleId?: number,
    circleProfile?:any,
};

export interface CirclePrayerRequest extends CircleRequest {
    params: CircleRequest['params'] & {
        prayer:string
    },
    prayerRequestId?: number,
    prayerRequestProfile?:any
};

export interface ProfileRequest extends CredentialRequest {
    params: {
        client:string
    },
    clientId?:number,
    clientProfile?: DB_USER,
};

export interface ProfilePrayerRequest extends ProfileRequest {
    params: ProfileRequest['params'] & {
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