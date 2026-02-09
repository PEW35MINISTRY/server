/***** ONLY DEPENDENCY:./inputField - Define all other types locally *****/
import { RecipientFormProfileListItem, RecipientFormCircleListItem } from '../api-type-sync/recipient-types.mjs';
import { CircleListItem, CircleAnnouncementListItem, CircleEventListItem } from '../api-type-sync/circle-types.mjs';
import { ContentListItem } from '../api-type-sync/content-types.mjs';
import { PrayerRequestListItem, PrayerRequestCommentListItem } from '../api-type-sync/prayer-request-types.mjs';
import { ProfileListItem } from '../api-type-sync/profile-types.mjs';
import { CircleSearchRefineEnum, CircleStatusEnum } from './circle-field-config.mjs';
import { ContentSearchRefineEnum } from './content-field-config.mjs';
import { RoleEnum, UserSearchRefineEnum } from './profile-field-config.mjs';
import { PrayerRequestSearchRefineEnum } from './prayer-request-field-config.mjs';



/******************************************************
*          SEARCH CONFIGURATION FILE                  *
* Sync across all repositories:server, portal, mobile *
* Server sync: /api/api-search-utilities.mts          * 
*******************************************************/

/* TYPE CONFIGURATIONS */

export type LabelListItem = string;

export type DisplayItemType = LabelListItem | ProfileListItem | CircleListItem | CircleAnnouncementListItem | CircleEventListItem | PrayerRequestListItem | PrayerRequestCommentListItem | ContentListItem | RecipientFormProfileListItem | RecipientFormCircleListItem;

/* Used for Mapping UI Components */
export enum ListItemTypesEnum {
    LABEL = 'LABEL',
    USER = 'USER',
    PARTNER = 'PARTNER',
    PENDING_PARTNER = 'PENDING_PARTNER',
    CIRCLE = 'CIRCLE',
    CIRCLE_ANNOUNCEMENT = 'CIRCLE_ANNOUNCEMENT',
    CIRCLE_EVENT = 'CIRCLE_EVENT',
    PRAYER_REQUEST = 'PRAYER_REQUEST',
    PRAYER_REQUEST_COMMENT = 'PRAYER_REQUEST_COMMENT',
    CONTENT_ARCHIVE = 'CONTENT_ARCHIVE',
    PROFILE_CONTACT = 'PROFILE_CONTACT',
    CIRCLE_CONTACT = 'CIRCLE_CONTACT'
}

/* SEARCH CONFIGURATION */

export const SEARCH_MIN_CHARS:number = 3;
export const LIST_LIMIT:number = 100;

export enum SearchType {
    NONE = 'NONE',
    USER = 'USER',
    CONTACT = 'CONTACT',
    CIRCLE = 'CIRCLE',
    CONTENT_ARCHIVE = 'CONTENT_ARCHIVE',
    PRAYER_REQUEST = 'PRAYER_REQUEST',
    PRAYER_REQUEST_OWNED = 'PRAYER_REQUEST_OWNED'
  }
  

  export class SearchTypeInfo<T> {
    searchType:SearchType;
    displayTitle:string;    
    itemType:ListItemTypesEnum;
    getID:(item:T)=>number;
    IDProperty:string;

    route:string;
    roleList:RoleEnum[]; //Authentication
    searchRefineList:string[];
    searchFilterList:string[];
    cacheAvailable:boolean;
    adminFlushCacheRoute:string;

    constructor(props:{ searchType:SearchType, displayTitle:string, itemType:ListItemTypesEnum, getID:(item:any) => number, IDProperty:string, route?:string, 
                        roleList?:RoleEnum[], searchRefineList?:string[], searchFilterList?:string[], cacheAvailable?:boolean, adminFlushCacheRoute?:string }) {
        this.searchType = props.searchType;
        this.displayTitle = props.displayTitle;
        this.itemType = props.itemType;
        this.getID = props.getID;
        this.IDProperty = props.IDProperty;

        this.route = props.route || `/api/search-list/${this.searchType}`;
        this.roleList = props.roleList || [];
        this.roleList.push(RoleEnum.ADMIN);
        this.searchRefineList = props.searchRefineList || []
        this.searchFilterList = props.searchFilterList || []
        this.cacheAvailable = props.cacheAvailable || false;
        this.adminFlushCacheRoute = props.adminFlushCacheRoute || `/api/admin/flush-search-cache${this.searchType}`; //UI utility, route's don't reflect config


        /* Validations */
        if(this.searchRefineList.length > 0 && !this.searchRefineList.includes('ALL')) throw new Error(`Search Type:${this.searchType} does not include 'ALL' in searchRefineList.`);
        if(this.searchRefineList.length > 0 && !this.searchRefineList.includes('ID')) throw new Error(`Search Type:${this.searchType} does not include 'ID' in searchRefineList.`);
    }
  }
  
  const SearchDetail:Record<SearchType, SearchTypeInfo<any>> = {
    [SearchType.NONE]: new SearchTypeInfo<LabelListItem>({ searchType:SearchType.NONE, displayTitle:'ERROR', itemType:ListItemTypesEnum.LABEL, route:'/error', getID:() => -1, IDProperty:'ID' }),
  
    [SearchType.USER]: new SearchTypeInfo<ProfileListItem>({ searchType:SearchType.USER, displayTitle:'User Search', roleList:Object.values(RoleEnum), itemType:ListItemTypesEnum.USER, 
                                                getID:(item:ProfileListItem) => item.userID, IDProperty:'userID', cacheAvailable:true,
                                                searchRefineList: [...Object.values(UserSearchRefineEnum)]
                                                }),

    [SearchType.CONTACT]: new SearchTypeInfo<ProfileListItem>({ searchType:SearchType.CONTACT, displayTitle:'Contact Search', roleList:Object.values(RoleEnum), itemType:ListItemTypesEnum.USER, 
                                                  getID:(item:ProfileListItem) => item.userID, IDProperty:'userID', cacheAvailable:true,
                                                  }),
  
    [SearchType.CIRCLE]: new SearchTypeInfo<CircleListItem>({ searchType:SearchType.CIRCLE, displayTitle:'Circle Search', roleList:Object.values(RoleEnum), itemType:ListItemTypesEnum.CIRCLE, 
                                                getID:(item:CircleListItem) => item.circleID, IDProperty:'circleID', searchFilterList:Object.values(CircleStatusEnum), cacheAvailable:true,
                                                searchRefineList: [...Object.values(CircleSearchRefineEnum)]
                                                }),

    [SearchType.CONTENT_ARCHIVE]: new SearchTypeInfo<ContentListItem>({ searchType:SearchType.CONTENT_ARCHIVE, displayTitle:'Content Search', roleList:[RoleEnum.DEVELOPER, RoleEnum.CONTENT_APPROVER], itemType:ListItemTypesEnum.CONTENT_ARCHIVE, 
                                                  getID:(item:ContentListItem) => item.contentID, IDProperty:'contentID', 
                                                  searchRefineList: [...Object.values(ContentSearchRefineEnum)], 
                                                }),
    [SearchType.PRAYER_REQUEST]: new SearchTypeInfo<PrayerRequestListItem>({ searchType:SearchType.PRAYER_REQUEST, displayTitle: 'Prayer Request Search', roleList:Object.values(RoleEnum), itemType: ListItemTypesEnum.PRAYER_REQUEST, 
                                                  getID:(item:PrayerRequestListItem) => item.prayerRequestID, IDProperty: 'prayerRequestID', 
                                                  searchRefineList: [...Object.values(PrayerRequestSearchRefineEnum)], 
                                                }),
    [SearchType.PRAYER_REQUEST_OWNED]: new SearchTypeInfo<PrayerRequestListItem>({ searchType:SearchType.PRAYER_REQUEST, displayTitle: 'Owned Prayer Request Search', roleList:Object.values(RoleEnum), itemType: ListItemTypesEnum.PRAYER_REQUEST, 
                                                  getID:(item:PrayerRequestListItem) => item.prayerRequestID, IDProperty: 'prayerRequestID',
                                                  searchRefineList: [...Object.values(PrayerRequestSearchRefineEnum)], 
                                                })
  };
  
export default SearchDetail;
