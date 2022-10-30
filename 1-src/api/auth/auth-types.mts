import { Request, Response, NextFunction } from "express";


/*    Type Declarations     */
export type loginRequest = Request & {
    header:{
        email: String, password: String
    }
};

export type credentialRequest = Request & {
      header:{
        JWT: String, userId: String
    }
};

export type loginResponse = {
        JWT: String, userId: String, userRole: String, displayName: String, profileImage: String, service:String
};