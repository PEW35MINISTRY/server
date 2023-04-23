
import express, {Router, Request, Response, NextFunction} from 'express';
import { IncomingHttpHeaders } from 'http';
import { IdentityClientRequest, IdentityRequest } from '../auth/auth-types.mjs';
import { Message } from '../chat/chat-types.mjs';
import { PrayerRequest } from '../prayer-request/prayer-request-types.mjs';

export enum StageEnum {
    LEARNING = 'LEARNING',
    GROWING = 'GROWING', 
    LIVING = 'LIVING'
}

export enum GenderEnum {
    MALE = 'MALE',
    FEMALE = 'FEMALE'
}

export enum RoleEnum {
    STUDENT = 'STUDENT',
    LEADER = 'LEADER',
    ADMIN = 'ADMIN',
    SIGNUP = 'SIGNUP' //Only Used for UI Role List
}

export const getRoleList = ():string[] => 
    ([...Object.values(RoleEnum)].filter(role => role != RoleEnum.SIGNUP));

//Profile Privilege Lists
//using UI JSON Names
export const ALL_PROFILE_FIELDS_EDIT_LIST = [
    'userRole', 'email', 'displayName', 'password', 'phone', 'zipcode', 'dob', 'gender', 'dailyNotificationHour',
    'stage', 'notes'
];

//Also required Fields for Profile Edit
export const SIGNUP_PROFILE_FIELDS_CREATE_LIST = [
    'userRole', 'email', 'displayName', 'password', 'phone', 'zipcode', 'dob', 'gender', 'dailyNotificationHour'];

export const STUDENT_PROFILE_FIELDS_EDIT_LIST:string[] = ['zipcode', 'dailyNotificationHour', 'circleList', 'profileList'];

export const LEADER_PROFILE_FIELDS_EDIT_LIST:string[] = [...STUDENT_PROFILE_FIELDS_EDIT_LIST, 'phone', 'stage', 'notes'];

export const getUserRoleProfileAccessList = (userRole:RoleEnum):string[] => {
    switch (userRole) {
        case RoleEnum.SIGNUP:
            return SIGNUP_PROFILE_FIELDS_CREATE_LIST;
        case RoleEnum.ADMIN:
            return ALL_PROFILE_FIELDS_EDIT_LIST;
        case RoleEnum.LEADER:
            return LEADER_PROFILE_FIELDS_EDIT_LIST;
        default:
            return STUDENT_PROFILE_FIELDS_EDIT_LIST;        
    }
}

//Used for Inserting new profile into to Database; provided fields then overwrite
export const getDatabaseDefaultProfileFields = ():Map<string, any> => new Map<string, any>([
    //excludes required like email, username, password
    ['user_role', RoleEnum.STUDENT],
    ['verified', true],
    ['phone', '000-000-0000'],
    ['dob', new Date().getTime()-(15 * 31556952000)], //15 years old
    ['gender', GenderEnum.MALE],
    ['zipcode', 55060],
    ['daily_notification_hour', 9],    
]);

export const editProfileAllowed = (field:string, userRole:RoleEnum):boolean => {
    if(!field.length || !ALL_PROFILE_FIELDS_EDIT_LIST.includes(field))
        return false;
    else
        return getUserRoleProfileAccessList(userRole).includes(field);
}

//sync with Portal app-types.tsx
export interface ProfilePublicResponse {
    userId: number, 
    userRole: string, 
    displayName: string, 
    profileImage: string, 
    gender:string,
    dob:number,
    proximity?:number,
    circleList: {
        circleId: string,
        title: string,
        image: string,
        sameMembership: boolean
    }[],
};

//sync with Portal app-types.tsx
export interface ProfileResponse extends ProfilePublicResponse  {
    firstName: string, 
    lastName: string, 
    email:string,
    phone: string, 
    zipcode: string, 
    stage: StageEnum, 
    dailyNotificationHour: number
};

export interface ProfilePartnerResponse extends ProfilePublicResponse  {
    zipcode: string, 
    stage: StageEnum, 
    dailyNotificationHour: number,
    pendingPrayerRequestList: PrayerRequest[],
    answeredPrayerRequestList: PrayerRequest[],
    messageList: Message[],
};

export interface ProfileEditRequest extends IdentityClientRequest {
    body: {
        userId: number,
        displayName?: string, 
        firstName?: string, 
        lastName?: string, 
        profileImage?: string, 
        gender?:string,
        dob?:number,
        phone?: string, 
        zipcode?: string, 
        stage?: StageEnum, 
        dailyNotificationHour?: number,
        circleList?: number[],
        userRole?: RoleEnum,
        email?: string,
        password?: string,
        verified?: boolean,
        partnerList?: number[],
        notes?: string
    }
}