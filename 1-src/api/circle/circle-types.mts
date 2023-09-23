import * as log from '../../services/log.mjs';
import { CircleStatus } from '../../services/models/Fields-Sync/circle-field-config.mjs';
import CIRCLE_ANNOUNCEMENT from '../../services/models/circleAnnouncementModel.mjs';
import { JwtCircleRequest } from '../auth/auth-types.mjs';
import { PrayerRequestListItem } from '../prayer-request/prayer-request-types.mjs';
import { ProfileListItem } from '../profile/profile-types.mjs';

/* Sync between Server and Portal "circle-types" */
export interface CircleListItem {
    circleID: number,
    name: string,
    image: string,
    status?: CircleStatus
}

export interface CircleAnnouncementCreateRequest extends JwtCircleRequest {
    body: {
        message: string,
        startDate: Date,
        EndDate: Date,
    } 
}

export interface CircleEventListItem {
    eventID: number,
    circleID: number, 
    name: string,
    description: string,
    startDate: Date,
    endDate: Date,
    image: string
}

/* Sync between Server and Portal "circle-types" */
export interface CircleResponse {
    circleID: number, 
    leader: ProfileListItem, 
    name: string,
    description: string, 
    postalCode: string,
    isActive: boolean,
    image: string,
    memberList: ProfileListItem[],
    eventList: CircleEventListItem[],
    announcementList: CIRCLE_ANNOUNCEMENT[],
    prayerRequestList: PrayerRequestListItem[]
};

/* Sync between Server and Portal "circle-types" */
export interface CircleLeaderResponse extends CircleResponse  {
    notes?: string,
    pendingRequestList: ProfileListItem[],
    pendingInviteList: ProfileListItem[],
};

export interface CircleEditRequest extends JwtCircleRequest {
    body: {
        circleID: number, 
        leaderID: number, 
        name: string,
        description: string, 
        postalCode: string,
        isActive: boolean,
        image: string,
    } 
}

export interface CircleAnnouncementCreateRequest extends JwtCircleRequest {
    body: {
        message: string,
        startDate: Date,
        EndDate: Date,
    } 
}

export interface CircleImageRequest extends JwtCircleRequest {
    params: JwtCircleRequest['params'] & {
        file:string
    },
    body: Blob
}