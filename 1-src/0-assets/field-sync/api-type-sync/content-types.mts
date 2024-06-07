/*********** ONLY DEPENDENCIES FROM DIRECTORY: /field-sync/ ***********/

import { ContentSourceEnum, ContentTypeEnum, GenderSelectionEnum } from '../input-config-sync/content-field-config.mjs';
import { ProfileListItem } from './profile-types.mjs';


/***********************************************************************
*                   CONTENT TYPES                                      *
* Sync across all repositories: server, portal, mobile                 *
* Sever:                                                               *
* Portal:                                                              *
* Mobile:                                                              *
************************************************************************/

export interface ContentListItem {
    contentID: number,
    type: ContentTypeEnum,
    source: ContentSourceEnum,
    url: string,
    keywordList: string[],
    title?: string,
    description?: string, 
    image?: string,
    likeCount: number,
}


export interface ContentResponseBody {
    contentID: number,
    recorderID: number,
    recorderProfile: ProfileListItem, 
    type: ContentTypeEnum,
    source: ContentSourceEnum,
    url: string,
    keywordList: string,
    title?: string,
    description?: string,
    image?: string,
    likeCount: number,
    gender: GenderSelectionEnum,
    minimumAge: number,
    maximumAge: number,
    minimumWalkLevel: number,
    maximumWalkLevel: number,
    notes?: string
}

export interface ContentMetaDataRequestBody {
    url:string,
    type: ContentTypeEnum
    source: ContentSourceEnum
}

export type ContentMetaDataResponseBody = {
    title:string|undefined,
    description:string|undefined,
    imageURL:string|undefined,
}
