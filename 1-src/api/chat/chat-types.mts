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
    userId: number, 
    topic: MessageTypeEnum, 
    message: string,
    time: number,
}

export interface ConversationNewRequest extends CredentialRequest {
    body: {
        userId: number, 
        topic: MessageTypeEnum, 
        message: string,
    }
}

export interface ConversationResponse {
    prayerRequestList: Message[],
};


