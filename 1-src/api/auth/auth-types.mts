import { Request, Response, NextFunction } from "express";
import { IncomingHttpHeaders } from "http";


/*    Type Declarations     */
export interface loginRequest extends Request {
    headers: IncomingHttpHeaders & {
        'email': string, 
        'password': string
    }
};

export interface CredentialRequest extends Request {
      headers: IncomingHttpHeaders & {
        'jwt': string, 
        'user-id': string
    }
};

export interface loginResponseBody {
    JWT: string, 
    userId: number, 
    userRole: string, 
    displayName: string, 
    profileImage: string, 
    service:string
};

export interface loginResponse extends Response, loginResponseBody {};