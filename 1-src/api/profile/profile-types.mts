
import express, {Router, Request, Response, NextFunction} from 'express';
import { IncomingHttpHeaders } from 'http';
import { Message } from '../chat/chat-types.mjs';
import { PrayerRequest } from '../prayer-request/prayer-request-types.mjs';

export enum StageEnum {
    LEARNING = 'LEARNING',
    GROWING = 'GROWING', 
    LIVING = 'LIVING'
}

export enum GenderEnum {
    MALE = 'MALE',
    FEMALE = 'FEMALE'
}

export enum RoleEnum {
    STUDENT = 'STUDENT',
    LEADER = 'LEADER',
    ADMIN = 'ADMIN',
}

export interface ProfileRequest extends Request {
    headers: IncomingHttpHeaders & {
        'jwt': string,
        'user-id': string
    }
}

export interface ProfilePublicRequest extends ProfileRequest {
    headers: ProfileRequest['headers'] & {
        'request-id': string
    }
}

export interface ProfilePartnerRequest extends ProfileRequest {
    headers: ProfileRequest['headers'] & {
        'partner-id': string,
    }
}


export interface ProfilePublicResponse {
    userId: number, 
    userRole: string, 
    displayName: string, 
    profileImage: string, 
    gender:string,
    dob:number,
    proximity?:number,
    circleList: {
        circleId: string,
        title: string,
        image: string,
        sameMembership: boolean
    }[],
};


export interface ProfileResponse extends ProfilePublicResponse  {
    email:string,
    phone: string, 
    zipcode: string, 
    stage: StageEnum, 
    dailyNotificationHour: number
};

export interface ProfilePartnerResponse extends ProfilePublicResponse  {
    zipcode: string, 
    stage: StageEnum, 
    dailyNotificationHour: number,
    pendingPrayerRequestList: PrayerRequest[],
    answeredPrayerRequestList: PrayerRequest[],
    messageList: Message[],
};

export interface ProfileEditRequest extends ProfileRequest {
    body: {
        userId: number,
        displayName?: string, 
        profileImage?: string, 
        gender?:string,
        dob?:number,
        phone?: string, 
        zipcode?: string, 
        stage?: StageEnum, 
        dailyNotificationHour?: number,
        circleList?: number[],
        userRole?: RoleEnum,
        email?: string,
        password?: string,
        verified?: boolean,
        partnerList?: number[],
        notes?: string
    }
}