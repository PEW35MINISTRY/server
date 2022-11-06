import express, {Router, Request, Response, NextFunction} from 'express';
import { CredentialRequest } from '../auth/auth-types.mjs';
import { ProfilePublicRequest } from '../profile/profile-types.mjs';

export interface ConversationUserRequest extends ProfilePublicRequest {};

export interface ConversationCircleRequest extends ProfilePublicRequest {};

export enum MessageTypeEnum {
    DIRECT,
    GROUP,
}

export interface Message {
    userId: String, 
    topic: MessageTypeEnum, 
    message: String,
    time: number,
}

export interface ConversationNewRequest extends CredentialRequest {
    body: {
        userId: String, 
        topic: MessageTypeEnum, 
        message: String,
    }
}

export interface ConversationResponse {
    prayerRequestList: Message[],
};


