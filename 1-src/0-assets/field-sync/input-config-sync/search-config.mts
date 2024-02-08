/***** ONLY DEPENDENCY:./inputField - Define all other types locally *****/
import { CircleListItem, CircleAnnouncementListItem, CircleEventListItem } from '../api-type-sync/circle-types.mjs';
import { ContentListItem } from '../api-type-sync/content-types.mjs';
import { PrayerRequestListItem, PrayerRequestCommentListItem } from '../api-type-sync/prayer-request-types.mjs';
import { ProfileListItem } from '../api-type-sync/profile-types.mjs';
import { CircleSearchRefineEnum, CircleStatusEnum } from './circle-field-config.mjs';
import { ContentSearchRefineEnum } from './content-field-config.mjs';
import { RoleEnum, UserSearchRefineEnum } from './profile-field-config.mjs';



/*******************************************************
*            SEARCH CONFIGURATION FILE
* Sync across all repositories:server, portal, mobile
*******************************************************/

/* TYPE CONFIGURATIONS */

export type LabelListItem = string;

export type DisplayItemType = LabelListItem | ProfileListItem | CircleListItem | CircleAnnouncementListItem | CircleEventListItem | PrayerRequestListItem | PrayerRequestCommentListItem | ContentListItem;

export enum ListItemTypesEnum {
    LABEL = 'LABEL',
    USER = 'USER',
    CIRCLE = 'CIRCLE',
    CIRCLE_ANNOUNCEMENT = 'CIRCLE_ANNOUNCEMENT',
    CIRCLE_EVENT = 'CIRCLE_EVENT',
    PRAYER_REQUEST = 'PRAYER_REQUEST',
    PRAYER_REQUEST_COMMENT = 'PRAYER_REQUEST_COMMENT',
    CONTENT_ARCHIVE = 'CONTENT_ARCHIVE',
}

// export const extractItemID = (displayItem:DisplayItemType, displayType:ListItemTypesEnum|undefined):number =>
//     (displayType === ListItemTypesEnum.USER) ? (displayItem as ProfileListItem).userID
//     :(displayType === ListItemTypesEnum.CIRCLE) ? (displayItem as CircleListItem).circleID
//     :(displayType === ListItemTypesEnum.CIRCLE_ANNOUNCEMENT) ? (displayItem as CircleAnnouncementListItem).announcementID
//     :(displayType === ListItemTypesEnum.CIRCLE_EVENT) ? (displayItem as CircleEventListItem).eventID
//     :(displayType === ListItemTypesEnum.PRAYER_REQUEST) ? (displayItem as PrayerRequestListItem).prayerRequestID
//     :(displayType === ListItemTypesEnum.CONTENT_ARCHIVE) ? (displayItem as ContentListItem).contentID
//     :-1;


/* SEARCH CONFIGURATION */

export const SEARCH_MIN_CHARS:number = 3;

export enum SearchType {
    NONE = 'NONE',
    USER = 'USER',
    CIRCLE = 'CIRCLE',
    CONTENT_ARCHIVE = 'CONTENT_ARCHIVE',
  }
  

  export class SearchTypeInfo {
    searchType:SearchType;
    displayTitle:string;    
    itemType:ListItemTypesEnum;
    getID:(item:any)=>number;
    route:string; //Still authentication dependent

    roleList:RoleEnum[]; //Sync with route
    searchRefineList:string[];
    refineDatabaseMapping:Map<string, string[]>;
    searchFilterList:string[];
    cacheAvailable:boolean;

    constructor(props:{ searchType:SearchType, displayTitle:string, itemType:ListItemTypesEnum, getID:(item:any) => number, route:string, 
                        roleList?:RoleEnum[], refineDatabaseMapping?:Map<string, string[]>, searchFilterList?:string[], cacheAvailable?:boolean }) {
        this.searchType = props.searchType;
        this.displayTitle = props.displayTitle;
        this.itemType = props.itemType;
        this.getID = props.getID;
        this.route = props.route;
        this.roleList = props.roleList || [];
        this.roleList.push(RoleEnum.ADMIN);
        this.refineDatabaseMapping = new Map(props.refineDatabaseMapping || []);
        this.searchRefineList = [...this.refineDatabaseMapping.keys()];
        this.searchFilterList = props.searchFilterList || []
        this.cacheAvailable = props.cacheAvailable || false;

        /* Validations */
        if(this.searchRefineList.includes.length > 0 && !this.searchRefineList.includes('ALL')) throw new Error(`Search Type:${this.searchType} does not include 'ALL' in searchRefineList.`);
    }
  }
  
  export const SearchDetail:Record<SearchType, SearchTypeInfo> = {
    [SearchType.NONE]: new SearchTypeInfo({ searchType:SearchType.NONE, displayTitle:'ERROR', itemType:ListItemTypesEnum.LABEL, route:'/error', getID:() => -1 }),
  
    [SearchType.USER]: new SearchTypeInfo({ searchType:SearchType.USER, displayTitle:'User Search', roleList:Object.values(RoleEnum), itemType:ListItemTypesEnum.USER, 
                                                route:'/api/user-list', getID:(item:ProfileListItem) => item.userID, cacheAvailable:true,
                                                refineDatabaseMapping: new Map([[UserSearchRefineEnum.NAME, ['firstName', 'lastName', 'displayName']],
                                                    [UserSearchRefineEnum.EMAIL, ['email']], [UserSearchRefineEnum.NOTES, ['notes']], [UserSearchRefineEnum.LOCATION, ['postalCode']],
                                                    [UserSearchRefineEnum.ALL, ['firstName', 'lastName', 'displayName', 'email', 'postalCode']]
                                                ])}),
  
    [SearchType.CIRCLE]: new SearchTypeInfo({ searchType:SearchType.CIRCLE, displayTitle:'Circle Search', roleList:Object.values(RoleEnum), itemType:ListItemTypesEnum.CIRCLE, 
                                                route:'/api/circle-list', getID:(item:CircleListItem) => item.circleID, searchFilterList:Object.values(CircleStatusEnum), cacheAvailable:true,
                                                refineDatabaseMapping: new Map([[CircleSearchRefineEnum.LEADER, ['firstName', 'lastName', 'displayName', 'email']],
                                                    [CircleSearchRefineEnum.NAME, ['name']], [CircleSearchRefineEnum.DESCRIPTION, ['description']], [CircleSearchRefineEnum.NAME_DESCRIPTION, ['name', 'description']], 
                                                    [CircleSearchRefineEnum.LOCATION, ['postalCode']],
                                                    [CircleSearchRefineEnum.ALL, ['name', 'description', 'circle.postalCode', 'firstName', 'lastName', 'displayName', 'email']]
                                                ])}),

    [SearchType.CONTENT_ARCHIVE]: new SearchTypeInfo({ searchType:SearchType.CONTENT_ARCHIVE, displayTitle:'Content Search', roleList:[RoleEnum.DEVELOPER, RoleEnum.CONTENT_APPROVER], itemType:ListItemTypesEnum.USER, 
                                                        route:'/api/content-archive/content-list', getID:(item:ContentListItem) => item.contentID,
                                                        refineDatabaseMapping: new Map([[ContentSearchRefineEnum.TYPE, ['type', 'customType']], [ContentSearchRefineEnum.SOURCE, ['source', 'customSource']],
                                                            [ContentSearchRefineEnum.KEYWORD, ['keywordListStringified']], [ContentSearchRefineEnum.DESCRIPTION, ['description']], [ContentSearchRefineEnum.NOTES, ['notes']],
                                                            [ContentSearchRefineEnum.ALL, ['url', 'keywordListStringified', 'description']]
                                                        ])}),
  };
  
export default SearchDetail;
