import SQL from 'mysql2';
import { GenderEnum, RoleEnum } from "../models/Fields-Sync/profile-field-config.mjs";

export interface CommandResponseType extends SQL.ResultSetHeader {
    'COUNT(*)'?:number
};


/******************************************************************* 
*           Database `user` Table Created: 6/25/2023 
********************************************************************/
export const USER_TABLE_COLUMNS:string[] = [
    'userID', 'firstName', 'lastName', 'displayName', 'email', 'passwordHash', 'postalCode', 'dateOfBirth', 'gender', 'isActive', 'walkLevel', 'image', 'notes'
];

export const USER_TABLE_COLUMNS_REQUIRED:string[] = [ 'displayName', 'email', 'passwordHash'];

export type DATABASE_USER = { //Optional Fields for PATCH/UPDATE
    userID: number, 
    firstName?: string,
    lastName?: string,
    displayName?: string,  //Unique
    email?: string,        //Unique
    passwordHash?: string,
    postalCode?: string, 
    dateOfBirth?: Date, 
    gender?: GenderEnum,
    isActive?: boolean,
    walkLevel?: number,
    image?: string,
    notes?: string,
    userRole?: RoleEnum, //Top role from table user_role_defined
};

export enum DATABASE_GENDER_ENUM {
    MALE = 'MALE',
    FEMALE = 'FEMALE'
}

/******************************************************************* 
*           Database `circle` Table Created: 6/25/2023 
********************************************************************/
export const CIRCLE_TABLE_COLUMNS:string[] = [
    'circleID', 'leaderID', 'name', 'description', 'postalCode', 'isActive', 'inviteToken', 'image', 'notes'
];

export const CIRCLE_TABLE_COLUMNS_REQUIRED:string[] = [ 'leaderID', 'name'];

export type DATABASE_CIRCLE = {  //Optional Fields for PATCH/UPDATE
    circleID: number, 
    leaderID?: number,
    name?: string,
    description?: string,
    postalCode?: string, 
    isActive?: boolean,
    inviteToken?: string,
    image?: string,
    notes?: string
};

export enum DATABASE_CIRCLE_STATUS_ENUM {
    MEMBER = 'MEMBER',
    INVITE = 'INVITE',
    REQUEST = 'REQUEST'
}

/******************************************************************** 
*      Database `circle_announcement` Table Created: 7/30/2023 
*********************************************************************/
export const CIRCLE_ANNOUNCEMENT_TABLE_COLUMNS:string[] = [ //
    'announcementID', 'circleID', 'message', 'startDate', 'endDate'
];

export const CIRCLE_ANNOUNCEMENT_TABLE_COLUMNS_REQUIRED:string[] = [ //
    'circleID', 'message', 'endDate'
];

export type DATABASE_CIRCLE_ANNOUNCEMENT = {
    announcementID: number, 
    circleID: number, 
    message?: string,
    startDate?: Date,
    endDate?: Date, 
};

