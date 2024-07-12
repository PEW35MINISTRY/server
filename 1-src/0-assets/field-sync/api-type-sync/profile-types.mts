/************* ONLY DEPENDENCIES FROM DIRECTORY: /field-sync/ *************/

import { GenderEnum, PartnerStatusEnum, RoleEnum } from '../input-config-sync/profile-field-config.mjs'
import { CircleAnnouncementListItem, CircleListItem } from './circle-types.mjs'
import { ContentListItem } from './content-types.mjs';
import { PrayerRequestListItem } from './prayer-request-types.mjs'

/**************************************************************************
*                   PROFILE TYPES                                         *
* Sync across all repositories: server, portal, mobile                    *
* Server: Additional Types Declared in: 1-api/3-profile/profile-types.mts *
* Portal:                                                                 *
* Mobile:                                                                 *
***************************************************************************/

/* [TEMPORARY] Credentials fetched for Debugging */
export type CredentialProfile = { 
    userID: number,
    displayName: string,
    userRole: RoleEnum,
    email: string,
    passwordHash: string,
}

export interface ProfileListItem {
    userID: number,
    firstName: string,
    displayName: string,
    image?: string,
}

export interface PartnerListItem extends ProfileListItem {
    status: PartnerStatusEnum, //Transformed in reference to requesting userID
    contractDT?: Date|string,
    partnershipDT?: Date|string,
}

export const PROFILE_NEW_PARTNER_PROPERTY_LIST = [ //Sync to NewPartnerListItem
    'userID', 'displayName', 'firstName', 'image', 'gender', 'postalCode', 'dateOfBirth', 'maxPartners', 'walkLevel',
    'status', 'contractDT', 'partnershipDT'
];

export interface NewPartnerListItem extends PartnerListItem {
    maxPartners: number,
    gender: GenderEnum,
    dateOfBirth: Date|string,
    walkLevel: number,
    postalCode: string,
}

export interface PartnerCountListItem extends NewPartnerListItem {
    partnerCountMap: Map<PartnerStatusEnum, number> | [PartnerStatusEnum, number][]
}

export const PROFILE_PUBLIC_PROPERTY_LIST = [ //Sync to ProfilePublicResponse
    'userID', 'displayName', 'firstName', 'image', 'userRole', 'circleList'
];

export interface ProfilePublicResponse extends ProfileListItem {
    userRole: RoleEnum, 
    circleList?: CircleListItem[],
};

export const PROFILE_PROPERTY_LIST = [ //Sync to ProfileResponse
    'userID', 'displayName', 'firstName', 'lastName', 'email', 'gender', 'postalCode', 'dateOfBirth', 'isActive', 'maxPartners', 'walkLevel', 'notes', 'image',
    'userRole', 'userRoleList',
    'circleList', 'circleInviteList', 'circleRequestList', 'circleAnnouncementList',
    'partnerList', 'partnerPendingUserList', 'partnerPendingPartnerList',
    'newPrayerRequestList', 'recommendedContentList', 'contactList', 'profileAccessList'
];

export interface ProfileResponse {
    userID: number, 
    userRole: RoleEnum,
    displayName: string,
    firstName: string,    
    lastName: string, 
    email:string,
    gender: GenderEnum,
    postalCode: string, 
    dateOfBirth: string,
    isActive: boolean,
    maxPartners: number,
    walkLevel: number,
    notes?: string,
    image?: string,
    userRoleList: RoleEnum[],
    circleList?: CircleListItem[],
    circleInviteList?: CircleListItem[],
    circleRequestList?: CircleListItem[],
    circleAnnouncementList?: CircleAnnouncementListItem[],
    partnerList?: PartnerListItem[],
    partnerPendingUserList?: PartnerListItem[],
    partnerPendingPartnerList?: PartnerListItem[],
    newPrayerRequestList?: PrayerRequestListItem[], //Recipient for dashboard
    recommendedContentList?: ContentListItem[],
    contactList?: ProfileListItem[],
    profileAccessList?: ProfileListItem[], //Leaders
};

export interface ProfileEditRequestBody {
    firstName?: string, 
    lastName?: string, 
    displayName?: string, 
    email?: string,
    password?: string,
    passwordVerify?: string,
    postalCode?: string, 
    dateOfBirth?: string, 
    gender?: GenderEnum,
    isActive?: boolean,
    maxPartners?: number,
    walkLevel?: number,
    image?: string,
    notes?: string,
    userRoleTokenList?: [{role: RoleEnum, token: string}]
}
