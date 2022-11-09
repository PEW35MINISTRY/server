import express, {Router, Request, Response, NextFunction} from 'express';
import { CredentialRequest } from '../auth/auth-types.mjs';

export interface ConversationUserRequest extends CredentialRequest {};

export interface ConversationCircleRequest extends CredentialRequest {};

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


