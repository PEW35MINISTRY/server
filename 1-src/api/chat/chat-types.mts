import express, {Router, Request, Response, NextFunction} from 'express';
import { IdentityRequest } from '../auth/auth-types.mjs';

export interface ConversationUserRequest extends IdentityRequest {};

export interface ConversationCircleRequest extends IdentityRequest {};

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

export interface ConversationNewRequest extends IdentityRequest {
    body: {
        userId: number, 
        topic: MessageTypeEnum, 
        message: string,
    }
}

export interface ConversationResponse {
    prayerRequestList: Message[],
};

export type Contact = {
    id: number,
    name: string
}


