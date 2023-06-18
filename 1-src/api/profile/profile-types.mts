
import { IdentityClientRequest } from '../auth/auth-types.mjs';
import { Message } from '../chat/chat-types.mjs';
import { PrayerRequest } from '../prayer-request/prayer-request-types.mjs';
import { GenderEnum, RoleEnum } from './Fields-Sync/profile-field-config.mjs';

export enum StageEnum {
    LEARNING = 'LEARNING',
    GROWING = 'GROWING', 
    LIVING = 'LIVING'
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

/* Sync between Server and Portal "profile-types" */
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

/* Sync between Server and Portal "profile-types" */
export interface ProfileResponse extends ProfilePublicResponse  {
    firstName: string, 
    lastName: string, 
    email:string,
    phone: string, 
    zipcode: string, 
    stage: StageEnum, 
    dailyNotificationHour: number
};

/* Sync between Server and Portal "profile-types" */
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