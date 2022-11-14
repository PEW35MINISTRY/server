import express, {Router, Request, Response, NextFunction} from 'express';
import { IncomingHttpHeaders } from 'http';
import { CredentialRequest } from '../auth/auth-types.mjs';

export interface PrayerRequestRequest extends CredentialRequest {
    params: {
        prayer:string
    },
};

export interface PrayerRequestUserRequest extends CredentialRequest {
    headers: CredentialRequest['headers'] & {
        'request-user-id': string
    }
};

export interface PrayerRequestCircleRequest extends CredentialRequest {
    headers: CredentialRequest['headers'] & {
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

export interface PrayerRequestNewRequest extends CredentialRequest {
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


