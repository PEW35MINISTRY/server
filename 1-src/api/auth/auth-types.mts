import { Request, Response, NextFunction } from "express";
import { IncomingHttpHeaders } from "http";


/*    Type Declarations     */
export interface loginRequest extends Request {
    headers: IncomingHttpHeaders & {
        'email': String, 
        'password': String
    }
};

export interface CredentialRequest extends Request {
      headers: IncomingHttpHeaders & {
        'jwt': String, 
        'user-id': String
    }
};

export interface loginResponseBody {
    JWT: String, 
    userId: String, 
    userRole: String, 
    displayName: String, 
    profileImage: String, 
    service:String
};

export interface loginResponse extends Response, loginResponseBody {};