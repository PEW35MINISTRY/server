/*********** ONLY DEPENDENCIES FROM DIRECTORY: /field-sync/ ***********/

import { CircleStatusEnum } from '../input-config-sync/circle-field-config.mjs'
import { PrayerRequestListItem } from './prayer-request-types.mjs'
import { ProfileListItem } from './profile-types.mjs'

/***********************************************************************
*                   CIRCLE TYPES                                       *
* Sync across all repositories: server, portal, mobile                 *
* Sever: Additional Types Declared in: 1-api/4-circle/circle-types.mts *
* Portal:                                                              *
* Mobile:                                                              *
************************************************************************/

export interface CircleListItem {
    circleID: number,
    name: string,
    image?: string,
    status?: CircleStatusEnum
}

export interface CircleAnnouncementCreateRequestBody {
    message: string,
    startDate: string,
    endDate: string,
}

export interface CircleAnnouncementListItem {
    announcementID: number, 
    circleID: number, 
    message?: string,
    startDate?: string,
    endDate?: string, 
};

export interface CircleEventListItem {
    eventID: number,
    circleID: number, 
    name: string,
    description: string,
    startDate: string,
    endDate: string,
    image?: string
}

export interface CircleResponse {
    circleID: number, 
    leaderID: number,
    leaderProfile: ProfileListItem, 
    name: string,
    description: string, 
    postalCode: string,
    isActive: boolean,
    memberList?: ProfileListItem[],
    eventList?: CircleEventListItem[],
    announcementList?: CircleAnnouncementListItem[],
    prayerRequestList?: PrayerRequestListItem[],
    requestorID: number,
    requestorStatus?: CircleStatusEnum
    image?: string,
};

export interface CircleLeaderResponse extends CircleResponse  {
    pendingRequestList?: ProfileListItem[],
    pendingInviteList?: ProfileListItem[],
    inviteToken: string,
    notes?: string,
};

export interface CircleEditRequestBody {
    circleID: number, 
    leaderID: number, 
    name: string,
    description: string, 
    postalCode: string,
    isActive: boolean,
    inviteToken: string,
    image?: string,
    notes?: string,
}

export interface CircleAnnouncementCreateRequestBody {
    message: string,
    startDate: string,
    endDate: string,
}
