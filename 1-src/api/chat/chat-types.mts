import express, {Router, Request, Response, NextFunction} from 'express';
import { JwtRequest } from '../auth/auth-types.mjs';

export interface ConversationUserRequest extends JwtRequest {};

export interface ConversationCircleRequest extends JwtRequest {};

export enum MessageTypeEnum {
    DIRECT,
    GROUP,
}

export interface Message {
    userID: number, 
    topic: MessageTypeEnum, 
    message: string,
    time: number,
}

export interface ConversationNewRequest extends JwtRequest {
    body: {
        userID: number, 
        topic: MessageTypeEnum, 
        message: string,
    }
}

export interface ConversationResponse {
    prayerRequestList: Message[],
};

export type Contact = {
    ID: number,
    name: string
}


