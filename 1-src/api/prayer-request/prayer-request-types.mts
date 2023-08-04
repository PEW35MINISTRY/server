import express, {Router, Request, Response, NextFunction} from 'express';
import { IncomingHttpHeaders } from 'http';
import { IdentityRequest } from '../auth/auth-types.mjs';
import { ProfileListItem } from '../profile/profile-types.mjs';

export interface PrayerRequestRequest extends IdentityRequest {
    params: IdentityRequest['params'] & {
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
    SELF = 'SELF',
    FAMILY = 'FAMILY',
    SCHOOL = 'SCHOOL',
    HEALING = 'HEALING',
    PRAISE = 'PRAISE',
    GLOBAL = 'GLOBAL'
}

export interface PrayerRequestListItem {
    prayerRequestID: number,
    sender: ProfileListItem, 
    description: string,
    prayerCount: number,
    tags: PrayerRequestTopicEnum[], 
}

export interface CommentListItem {
    commentID: number,
    prayerRequestID?: number,
    sender: ProfileListItem, 
    message: string,
    likeCount: number
}

export interface PrayerRequest {
    prayerRequestID: number,
    sender?: ProfileListItem, 
    description: string,
    prayerCount: number,
    tags: PrayerRequestTopicEnum[], 
    expiration: Date, 
    answered?:boolean,
    comments?: CommentListItem[],
}

export interface PrayerRequestNewRequest extends IdentityRequest {
    body: {
        userID: number, 
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


