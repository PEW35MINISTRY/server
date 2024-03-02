/*********** ONLY DEPENDENCIES FROM DIRECTORY: /field-sync/ ***********/

import { GenderSelectionEnum } from '../input-config-sync/content-field-config.mjs';
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
    type: string,
    source: string,
    url: string,
    keywordList: string[],
    description?: string, 
}


export interface ContentResponseBody {
    contentID: number,
    recorderID: number,
    recorderProfile: ProfileListItem, 
    type: string,
    source: string,
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

