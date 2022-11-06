
import express, {Router, Request, Response, NextFunction} from 'express';
import { IncomingHttpHeaders } from 'http';
import { Message } from '../chat/chat-types.mjs';
import { PrayerRequest } from '../prayer-request/prayer-request-types.mjs';

export interface ProfileRequest extends Request {
    headers: IncomingHttpHeaders & {
        'jwt': String,
        'user-id': String
    }
}


export interface ProfilePublicRequest extends ProfileRequest {
    headers: ProfileRequest['headers'] & {
        'request-id': String
    }
}

export interface ProfilePartnerRequest extends ProfileRequest {
    headers: ProfileRequest['headers'] & {
        'partner-id': String,
    }
}

export interface ProfileEditRequest extends ProfileRequest {
    headers: ProfileRequest['headers'] & {
        displayName: String, 
        profileImage: String, 
        gender:String,
        dob:number,
        phone: String, 
        zipCode: String, 
        stage: String, 
        quietTime: String
    }
}


export interface ProfilePublicResponse {
    userId: String, 
    userRole: String, 
    displayName: String, 
    profileImage: String, 
    gender:String,
    dob:number,
    proximity?:number,
    circleIdList: {
        circleId: String,
        title: String,
        image: String,
        sameMembership: boolean
    }[],
};

export enum StageEnum {
    LEARNING,
    GROWING, 
    LIVING
}

export interface ProfileResponse extends ProfilePublicResponse  {
    email:String,
    phone: String, 
    zipCode: String, 
    stage: StageEnum, 
    quietTime: number
};

export interface ProfilePartnerResponse extends ProfilePublicResponse  {
    zipCode: String, 
    stage: StageEnum, 
    quietTime: number,
    pendingPrayerRequestList: PrayerRequest[],
    answeredPrayerRequestList: PrayerRequest[],
    messageList: Message[],
};

