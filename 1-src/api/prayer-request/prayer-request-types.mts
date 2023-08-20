import express, {Router, Request, Response, NextFunction} from 'express';
import { JwtPrayerRequest, JwtRequest } from '../auth/auth-types.mjs';
import { ProfileListItem } from '../profile/profile-types.mjs';
import { PrayerRequestTagEnum } from '../../services/models/Fields-Sync/prayer-request-field-config.mjs';

export interface PrayerRequestListItem {
    prayerRequestID: number,
    requestorProfile: ProfileListItem, 
    topic: string,
    prayerCount: number,
    tagList: PrayerRequestTagEnum[], 
}

export interface PrayerRequestCommentListItem {
    commentID: number,
    prayerRequestID?: number,
    commenterProfile: ProfileListItem, 
    message: string,
    likeCount: number
}

export interface PrayerRequestPostRequest extends JwtRequest {
    body: {
        requestorID?: number, 
        topic: string,
        description: string,
        expirationDate: Date
        prayerCount?: number,
        isOnGoing?: boolean,
        isResolved?: boolean,
        tagList?: string[],
        userRecipientIDList: number[],
        circleRecipientIDList: number[]
    }
}

export interface PrayerRequestPatchRequest extends JwtPrayerRequest {
    body: PrayerRequestPostRequest['body'] & {
        addUserRecipientIDList: number[],
        removeUserRecipientIDList: number[],
        addCircleRecipientIDList: number[],
        removeCircleRecipientIDList: number[]
    }
}

export interface PrayerRequestCommentRequest extends JwtPrayerRequest {
    body: {
        comment: string
    }
}

