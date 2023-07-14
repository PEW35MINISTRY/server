import SQL from 'mysql2';
import { GenderEnum, RoleEnum } from "../../api/profile/Fields-Sync/profile-field-config.mjs";

export interface CommandResponseType extends SQL.ResultSetHeader {
    'COUNT(*)'?:number
};


/******************************************************************* 
*           Database `user` Table Created: 6/25/2023 
********************************************************************/
export const USER_TABLE_COLUMNS:string[] = [
    'userID', 'firstName', 'lastName', 'displayName', 'email', 'passwordHash', 'postalCode', 'dateOfBirth', 'gender', 'isActive', 'createdDT', 'modifiedDT', 'image', 'notes'
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
