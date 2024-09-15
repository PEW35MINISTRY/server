import { JwtRequest } from "./2-auth/auth-types.mjs";
import { CircleListItem } from '../0-assets/field-sync/api-type-sync/circle-types.mjs';
import { ContentListItem } from '../0-assets/field-sync/api-type-sync/content-types.mjs';
import { ProfileListItem } from '../0-assets/field-sync/api-type-sync/profile-types.mjs';
import { RoleEnum, UserSearchRefineEnum } from '../0-assets/field-sync/input-config-sync/profile-field-config.mjs';
import SearchDetail, { SearchTypeInfo, SearchType, LabelListItem, SEARCH_LIMIT } from '../0-assets/field-sync/input-config-sync/search-config.mjs';
import BASE_MODEL from '../2-services/1-models/baseModel.mjs';
import CIRCLE from '../2-services/1-models/circleModel.mjs';
import CONTENT_ARCHIVE from '../2-services/1-models/contentArchiveModel.mjs';
import USER from '../2-services/1-models/userModel.mjs';
import { DB_SELECT_USER, DB_SELECT_CONTACT_LIST, DB_SELECT_USER_SEARCH_CACHE, DB_SELECT_USER_SEARCH, DB_INSERT_USER_SEARCH_CACHE, DB_IS_ANY_USER_ROLE, DB_FLUSH_USER_SEARCH_CACHE_ADMIN, DB_SELECT_CONTACT_CACHE, DB_INSERT_CONTACT_CACHE, DB_FLUSH_CONTACT_CACHE_ADMIN } from '../2-services/2-database/queries/user-queries.mjs';
import { CircleSearchRefineEnum } from '../0-assets/field-sync/input-config-sync/circle-field-config.mjs';
import { filterListByCircleStatus } from './4-circle/circle-utilities.mjs';
import { DB_FLUSH_CIRCLE_SEARCH_CACHE_ADMIN, DB_INSERT_CIRCLE_SEARCH_CACHE, DB_SELECT_CIRCLE, DB_SELECT_CIRCLE_SEARCH, DB_SELECT_CIRCLE_SEARCH_CACHE, DB_SELECT_LATEST_CIRCLES, DB_SELECT_USER_CIRCLES } from '../2-services/2-database/queries/circle-queries.mjs';
import { ContentSearchRefineEnum } from '../0-assets/field-sync/input-config-sync/content-field-config.mjs';
import { DB_SELECT_CONTENT, DB_SELECT_CONTENT_SEARCH, DB_SELECT_OWNED_LATEST_CONTENT_ARCHIVES } from '../2-services/2-database/queries/content-queries.mjs';
import { filterContentList } from './11-content/content-utilities.mjs';
import { filterContactList } from './3-profile/profile-utilities.mjs';


/************************************
* SERVER SPECIFIC TYPES | API TYPES *
*************************************/

export class Exception extends Error {
    status: number;
    message: string;
    notification: string;
    
    constructor(status: number, message: string, notification?: string) {
      super(message);
      this.status = status;
      this.message = message;
      this.notification = notification;
    }
  }

  export enum ImageTypeEnum {
    USER_PROFILE = 'USER_PROFILE',
    CIRCLE_PROFILE = 'CIRCLE_PROFILE',
    CIRCLE_EVENT = 'CIRCLE_EVENT',
    CONTENT_THUMBNAIL = 'CONTENT_THUMBNAIL',
  }

  //Mock HTTP JwtRequest for method calls
  export const generateJWTRequest = (userID:number, userRole:RoleEnum = RoleEnum.USER, query:Record<string, any> = {}, body:Record<string, any> = {}):JwtRequest => 
    ({
      jwtUserID: userID,
      jwtUserRole: userRole,
      params: {},
      query,
      body
    }) as JwtRequest;


  export interface JwtSearchRequest extends JwtRequest {
        query: {
            search:string,
            refine:string,
            filter:string,
            ignoreCache:string
        },
        params: JwtRequest['params'] & {
            type?: string
        },
    };






/***********************************************************************
 *      SERVER SEARCH CONFIGURATION & DATABASE REFERENCES              *
 * Must Sync: \0-assets\field-sync\input-config-sync\search-config.mts *
 ***********************************************************************/
export class SearchTypeInfoServer<ListItemType, ModelType> extends SearchTypeInfo<ListItemType> {
    refineDatabaseMapping:Map<string, string[]>;

    searchByIDMap:Map<string, (ID:number) => Promise<ListItemType>>;
    searchByOwnerID:(ID:number) => Promise<ListItemType[]>;
    fetchDefaultList:(userID:number) => Promise<ListItemType[]>;
    searchCache: (request:JwtSearchRequest, searchTerm:string, searchRefine:string) => Promise<ListItemType[]|undefined>;
    executeSearch:(request:JwtSearchRequest, searchTerm:string, columnList:string[]) => Promise<ListItemType[]>;
    saveCache:(request:JwtSearchRequest, searchTerm:string, searchRefine:string, resultList:ListItemType[]) => Promise<boolean>;
    filterResultList: (request:JwtSearchRequest, resultList:ListItemType[], searchFilter:string) => Promise<ListItemType[]>;
    adminFlushCache: () => Promise<boolean>;

    /* Default Method Implementations */
    readonly defaultPromiseUndefined = () => Promise.resolve(undefined);
    readonly defaultPromiseBoolean = () => Promise.resolve(false);
    readonly defaultPromiseList = () => Promise.resolve([] as ListItemType[]);

    constructor(props: {searchTypeInfo:SearchTypeInfo<ListItemType>, refineDatabaseMapping?:Map<string, string[]>,
      searchByIDMap:Map<string, (ID:number) => Promise<ListItemType[]>>,
      fetchDefaultList?:(userID:number) => Promise<ListItemType[]>, 
      searchCache?: (request:JwtSearchRequest, searchTerm:string, searchRefine:string) => Promise<ListItemType[]>,
      executeSearch?:(request:JwtSearchRequest, searchTerm:string, columnList:string[]) => Promise<ListItemType[]>,
      saveCache?:(request:JwtSearchRequest, searchTerm:string, searchRefine:string, resultList:ListItemType[]) => Promise<boolean>,
      filterResultList?: (request:JwtSearchRequest, resultList:ListItemType[], searchFilter:string) => Promise<ListItemType[]>,
      adminFlushCache?: () => Promise<boolean>,
    }) {
        super({...props.searchTypeInfo}); 
        this.refineDatabaseMapping = props.refineDatabaseMapping || new Map();

        this.searchByIDMap = props.searchByIDMap || new Map();
        this.fetchDefaultList = props.fetchDefaultList || this.defaultPromiseList;
        this.searchCache = props.searchCache || this.defaultPromiseUndefined;
        this.executeSearch = props.executeSearch || this.defaultPromiseList;
        this.saveCache = props.saveCache || this.defaultPromiseBoolean;
        this.filterResultList = props.filterResultList || ((request:JwtSearchRequest, resultList:ListItemType[], searchFilter:string) => Promise.resolve(resultList));
        this.adminFlushCache = props.adminFlushCache || this.defaultPromiseBoolean;

         /* Validations */
         if((this.searchRefineList.length !== (this.refineDatabaseMapping.size + this.searchByIDMap.size)) || this.searchRefineList.some(f => !(this.refineDatabaseMapping.has(f) || this.searchByIDMap.has(f)))) throw new Error(`Server Search Type:${this.searchType} contains mismatch between searchRefineList ${this.searchRefineList.length} and refineDatabaseMapping ${this.refineDatabaseMapping.size} + searchByIDMap ${this.searchByIDMap.size}.`);
        //  if(!this.searchByIDMap.has('ID')) throw new Error(`Server Search Type:${this.searchType} must contain searchByID of type 'ID'.`);
         if(this.cacheAvailable && ((this.adminFlushCacheRoute.trim() !== '') && (this.saveCache === this.defaultPromiseBoolean) || (this.adminFlushCache === this.defaultPromiseBoolean))) throw new Error(`Server Search Type:${this.searchType} cacheAvailable: TRUE; but missing references.`);
         if(!this.cacheAvailable && ((this.saveCache !== this.defaultPromiseBoolean) || (this.adminFlushCache !== this.defaultPromiseBoolean))) throw new Error(`Server Search Type:${this.searchType} cacheAvailable: FALSE; but still contains references.`);
    }
}


export const SearchDetailServer:Record<SearchType, SearchTypeInfoServer<any, BASE_MODEL<any, any, any>>> = {
  [SearchType.NONE]: new SearchTypeInfoServer<LabelListItem,  BASE_MODEL<any, any, any>>({ searchTypeInfo: SearchDetail[SearchType.NONE], searchByIDMap: new Map() }),

  [SearchType.USER]: new SearchTypeInfoServer<ProfileListItem, USER>({ searchTypeInfo: SearchDetail[SearchType.USER], 
                          refineDatabaseMapping: new Map([[UserSearchRefineEnum.NAME, ['firstName', 'lastName', 'displayName']],
                                [UserSearchRefineEnum.EMAIL, ['email']], [UserSearchRefineEnum.NOTES, ['notes']], [UserSearchRefineEnum.LOCATION, ['postalCode']],
                                [UserSearchRefineEnum.ALL, ['firstName', 'lastName', 'displayName', 'email', 'postalCode']]
                            ]),
                          searchByIDMap: new Map([[UserSearchRefineEnum.ID, (ID:number) => DB_SELECT_USER(new Map([['userID', ID]])).then((model) => [model.toListItem()])]]),
                          fetchDefaultList: DB_SELECT_CONTACT_LIST,
                          searchCache: (request:JwtSearchRequest, searchTerm:string, searchRefine:string) => DB_SELECT_USER_SEARCH_CACHE(searchTerm, UserSearchRefineEnum[searchRefine]),
                          executeSearch: (request:JwtSearchRequest, searchTerm:string, columnList:string[]) => DB_SELECT_USER_SEARCH({searchTerm, columnList, excludeGeneralUsers: false, searchInactive: false}),
                          saveCache: (request:JwtSearchRequest, searchTerm:string, searchRefine:string, resultList:any[]) => DB_INSERT_USER_SEARCH_CACHE({searchTerm, searchRefine: UserSearchRefineEnum[searchRefine], userList: resultList as ProfileListItem[]}),
                          adminFlushCache: DB_FLUSH_USER_SEARCH_CACHE_ADMIN,
                        }),

  [SearchType.CONTACT]: new SearchTypeInfoServer<ProfileListItem, USER>({ searchTypeInfo: SearchDetail[SearchType.CONTACT], 
                            refineDatabaseMapping: new Map(),
                            searchByIDMap: new Map(),
                            // fetchDefaultList: DB_SELECT_CONTACT_LIST,
                            searchCache: (request:JwtSearchRequest, searchTerm:string, searchRefine:string) => DB_SELECT_CONTACT_CACHE(request.jwtUserID),
                            executeSearch: (request:JwtSearchRequest, searchTerm:string, columnList:string[]) => DB_SELECT_CONTACT_LIST(request.jwtUserID, (request.jwtUserRole === RoleEnum.ADMIN), SEARCH_LIMIT),
                            saveCache: (request:JwtSearchRequest, searchTerm:string, searchRefine:string, resultList:any[]) => DB_INSERT_CONTACT_CACHE({userID: request.jwtUserID, userList: resultList as ProfileListItem[]}),
                            filterResultList: filterContactList,
                            adminFlushCache: DB_FLUSH_CONTACT_CACHE_ADMIN,
                          }),

  [SearchType.CIRCLE]: new SearchTypeInfoServer<CircleListItem, CIRCLE>({ searchTypeInfo: SearchDetail[SearchType.CIRCLE],
                          refineDatabaseMapping: new Map([[CircleSearchRefineEnum.LEADER, ['firstName', 'lastName', 'displayName', 'email']],
                                [CircleSearchRefineEnum.NAME, ['name']], [CircleSearchRefineEnum.DESCRIPTION, ['description']], [CircleSearchRefineEnum.NAME_DESCRIPTION, ['name', 'description']], 
                                [CircleSearchRefineEnum.LOCATION, ['postalCode']],
                                [CircleSearchRefineEnum.ALL, ['name', 'description', 'circle.postalCode', 'firstName', 'lastName', 'displayName', 'email']]
                            ]),
                          searchByIDMap: new Map([[CircleSearchRefineEnum.ID, (ID:number) => DB_SELECT_CIRCLE(ID).then((model) => [model.toListItem()])],
                                                  [CircleSearchRefineEnum.MEMBER_ID, DB_SELECT_USER_CIRCLES]]),
                          fetchDefaultList: () => DB_SELECT_LATEST_CIRCLES(),
                          searchCache: (request:JwtSearchRequest, searchTerm:string, searchRefine:string) => DB_SELECT_CIRCLE_SEARCH_CACHE(searchTerm, CircleSearchRefineEnum[searchRefine]),
                          executeSearch: (request:JwtSearchRequest, searchTerm:string, columnList:string[]) => DB_SELECT_CIRCLE_SEARCH(searchTerm, columnList),
                          saveCache: (request:JwtSearchRequest, searchTerm:string, searchRefine:string, resultList:any[]) => DB_INSERT_CIRCLE_SEARCH_CACHE({searchTerm, searchRefine: CircleSearchRefineEnum[searchRefine], circleList: resultList as CircleListItem[]}),
                          filterResultList: filterListByCircleStatus,
                          adminFlushCache: DB_FLUSH_CIRCLE_SEARCH_CACHE_ADMIN
                        }),

  [SearchType.CONTENT_ARCHIVE]: new SearchTypeInfoServer<ContentListItem, CONTENT_ARCHIVE>({ searchTypeInfo: SearchDetail[SearchType.CONTENT_ARCHIVE],
                          refineDatabaseMapping: new Map([[ContentSearchRefineEnum.TYPE, ['type', 'customType']], [ContentSearchRefineEnum.SOURCE, ['source', 'customSource']],
                                    [ContentSearchRefineEnum.KEYWORD, ['keywordListStringified']], [ContentSearchRefineEnum.DESCRIPTION, ['description']], [ContentSearchRefineEnum.NOTES, ['notes']],
                                    [ContentSearchRefineEnum.ALL, ['url', 'keywordListStringified', 'description']]
                                ]),
                            searchByIDMap: new Map([[ContentSearchRefineEnum.ID, (ID:number) => DB_SELECT_CONTENT(ID).then((model) => [model.toListItem()])],
                                                    [ContentSearchRefineEnum.RECORDER_ID, (ID:number) => DB_SELECT_OWNED_LATEST_CONTENT_ARCHIVES(ID, true)]]),
                            fetchDefaultList: DB_SELECT_OWNED_LATEST_CONTENT_ARCHIVES,
                            executeSearch: (request:JwtSearchRequest, searchTerm:string, columnList:string[]) => DB_SELECT_CONTENT_SEARCH(searchTerm, columnList),
                            filterResultList: filterContentList,
                        }),
};
