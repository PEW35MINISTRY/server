
import { Request, Response, NextFunction} from "express";
import { IdentityClientRequest } from '../auth/auth-types.mjs';
import { GenderEnum, RoleEnum } from './Fields-Sync/profile-field-config.mjs';
import { CircleListItem } from '../circle/circle-types.mjs';


/* [TEMPORARY] Credentials fetched for Debugging */
export type CredentialProfile = { 
    userID: number,
    displayName: string,
    userRole: string,
    email: string,
    passwordHash: string,
}

/* Sync between Server and Portal "profile-types" */
export interface ProfileListItem {
    userID: number,
    firstName: string,
    displayName: string,
    image: string,
}

/* Sync between Server and Portal "profile-types" */
export interface ProfilePublicResponse {
    userID: number, 
    userRole: string, 
    firstName: string,
    displayName: string, 
    gender: GenderEnum,
    image: string,
    circleList: CircleListItem[],
};

/* Sync between Server and Portal "profile-types" */
export interface ProfilePartnerResponse extends ProfilePublicResponse {
    walkLevel: number,
};

/* Sync between Server and Portal "profile-types" */
export interface ProfileResponse extends ProfilePartnerResponse  {
    lastName: string, 
    email:string,
    postalCode: string, 
    dateOfBirth: Date,
    isActive: boolean,
    partnerList: ProfileListItem[],
};

export interface ProfileEditRequest extends IdentityClientRequest {
    body: {
        userID: number,
        firstName?: string, 
        lastName?: string, 
        displayName?: string, 
        profileImage?: string, 
        email?: string,
        password?: string,
        passwordVerify?: string,
        postalCode?: string, 
        dateOfBirth?: Date, 
        gender?: GenderEnum,
        isActive?: boolean,
        walkLevel?: number,
        image?: string,
        notes?: string,
        userRoleTokenList?: [{role: RoleEnum, token: string}]
    } 
}

export interface ProfileSignupRequest extends Request  {
    body: Request['body'] & ProfileEditRequest['body']
}
