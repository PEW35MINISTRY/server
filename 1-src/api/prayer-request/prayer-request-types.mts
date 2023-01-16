import express, {Router, Request, Response, NextFunction} from 'express';
import { IncomingHttpHeaders } from 'http';
import { IdentityRequest } from '../auth/auth-types.mjs';

export interface PrayerRequestRequest extends IdentityRequest {
    params: {
        prayer:string
    },
};

export interface PrayerRequestUserRequest extends IdentityRequest {
    headers: IdentityRequest['headers'] & {
        'request-user-id': string
    }
};

export interface PrayerRequestCircleRequest extends IdentityRequest {
    headers: IdentityRequest['headers'] & {
        'circle-id': string
    }
};

export enum PrayerRequestTopicEnum {
    SELF,
    FAMILY,
}

export interface PrayerRequest {
    prayerRequestId: string,
    userId: number, 
    topic: PrayerRequestTopicEnum, 
    description: string,
    prayerCount: number,
    expiration: number, 
    answered?:boolean,
    comments?: {
        userId: number,
        message: string,
        likeCount: number
    }[],
}

export interface PrayerRequestNewRequest extends IdentityRequest {
    body: {
        userId: number, 
        topic: PrayerRequestTopicEnum, 
        description: string,
        expiration: number, 
        partnerShareList: string[],
        circleShareList: string[],
        communityShare?: boolean
    }
}

export interface PrayerRequestResponse {
    prayerRequestList: PrayerRequest[],
};


