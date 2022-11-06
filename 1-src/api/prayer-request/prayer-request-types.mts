import express, {Router, Request, Response, NextFunction} from 'express';
import { IncomingHttpHeaders } from 'http';
import { CredentialRequest } from '../auth/auth-types.mjs';

export interface PrayerRequestRequest extends CredentialRequest {
    headers: CredentialRequest['headers'] & {
        'prayer-request-id': String
    }
};

export interface PrayerRequestUserRequest extends CredentialRequest {
    headers: CredentialRequest['headers'] & {
        'request-user-id': String
    }
};

export interface PrayerRequestCircleRequest extends CredentialRequest {
    headers: CredentialRequest['headers'] & {
        'circle-id': String
    }
};

export enum PrayerRequestTopicEnum {
    SELF,
    FAMILY,
}

export interface PrayerRequest {
    prayerRequestId: String,
    userId: String, 
    topic: PrayerRequestTopicEnum, 
    description: String,
    prayerCount: number,
    expiration: number, 
    answered?:boolean,
    comments?: {
        userId: String,
        message: String,
        likeCount: number
    }[],
}

export interface PrayerRequestNewRequest extends CredentialRequest {
    body: {
        userId: String, 
        topic: PrayerRequestTopicEnum, 
        description: String,
        expiration: number, 
        partnerShareList: String[],
        circleShareList: String[],
        communityShare?: boolean
    }
}

export interface PrayerRequestResponse {
    prayerRequestList: PrayerRequest[],
};


