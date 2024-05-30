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
    type: ContentTypeEnum|string, //Custom field populates
    source: ContentSourceEnum|string,  //Custom field populates
    url: string,
    keywordList: string[],
    title?: string,
    description?: string, 
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
    description?: string, 
    gender: GenderSelectionEnum,
    minimumAge: number,
    maximumAge: number,
    minimumWalkLevel: number,
    maximumWalkLevel: number,
    notes?: string
}

