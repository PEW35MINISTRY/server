/************* ONLY DEPENDENCIES FROM DIRECTORY: /field-sync/ *************/

import { GenderEnum, PartnerStatusEnum, RoleEnum } from '../input-config-sync/profile-field-config.mjs'
import { CircleListItem } from './circle-types.mjs'
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
    userRole: string,
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
    userContractDT?: Date,
    partnerContractDT?: Date,
    partnershipDT?: Date,
}

export interface ProfilePartnerCountListItem extends ProfileListItem {
    maxPartners: number,
    partnerCountMap: Map<PartnerStatusEnum, number> | [PartnerStatusEnum, number][]
}

export interface ProfilePublicResponse {
    userID: number, 
    userRole: string, 
    firstName: string,
    displayName: string, 
    gender: GenderEnum,
    image?: string,
    circleList?: CircleListItem[],
};

export interface ProfilePartnerResponse extends ProfilePublicResponse {
    walkLevel: number,
};

export interface ProfileResponse extends ProfilePartnerResponse  {
    lastName: string, 
    email:string,
    postalCode: string, 
    dateOfBirth: string,
    isActive: boolean,
    notes?: string,
    userRoleList: RoleEnum[],
    partnerList?: PartnerListItem[],
    pendingPartnerList?: PartnerListItem[],
    prayerRequestList?: PrayerRequestListItem[],
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
    walkLevel?: number,
    image?: string,
    notes?: string,
    userRoleTokenList?: [{role: RoleEnum, token: string}]
}
