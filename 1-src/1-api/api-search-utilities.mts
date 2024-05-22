import { Response, NextFunction } from 'express';
import * as log from '../2-services/log.mjs';
import { CircleListItem } from '../0-assets/field-sync/api-type-sync/circle-types.mjs';
import { ContentListItem } from '../0-assets/field-sync/api-type-sync/content-types.mjs';
import { ProfileListItem } from '../0-assets/field-sync/api-type-sync/profile-types.mjs';
import { RoleEnum, UserSearchRefineEnum } from '../0-assets/field-sync/input-config-sync/profile-field-config.mjs';
import SearchDetail, { SearchTypeInfo, SearchType, LabelListItem, DisplayItemType, SEARCH_MIN_CHARS } from '../0-assets/field-sync/input-config-sync/search-config.mjs';
import BASE_MODEL from '../2-services/1-models/baseModel.mjs';
import CIRCLE from '../2-services/1-models/circleModel.mjs';
import CONTENT_ARCHIVE from '../2-services/1-models/contentArchiveModel.mjs';
import USER from '../2-services/1-models/userModel.mjs';
import { DB_SELECT_USER, DB_SELECT_CONTACTS, DB_SELECT_USER_SEARCH_CACHE, DB_SELECT_USER_SEARCH, DB_INSERT_USER_SEARCH_CACHE, DB_IS_ANY_USER_ROLE, DB_FLUSH_USER_SEARCH_CACHE_ADMIN } from '../2-services/2-database/queries/user-queries.mjs';
import { Exception, JwtSearchRequest } from './api-types.mjs';
import { CircleSearchRefineEnum } from '../0-assets/field-sync/input-config-sync/circle-field-config.mjs';
import { filterListByCircleStatus } from './4-circle/circle-utilities.mjs';
import { DB_FLUSH_CIRCLE_SEARCH_CACHE_ADMIN, DB_INSERT_CIRCLE_SEARCH_CACHE, DB_SELECT_CIRCLE, DB_SELECT_CIRCLE_SEARCH, DB_SELECT_CIRCLE_SEARCH_CACHE, DB_SELECT_LATEST_CIRCLES, DB_SELECT_USER_CIRCLES } from '../2-services/2-database/queries/circle-queries.mjs';
import { ContentSearchRefineEnum } from '../0-assets/field-sync/input-config-sync/content-field-config.mjs';
import { DB_SELECT_CONTENT, DB_SELECT_CONTENT_SEARCH, DB_SELECT_OWNED_LATEST_CONTENT_ARCHIVES } from '../2-services/2-database/queries/content-queries.mjs';
import { DATABASE_USER_ROLE_ENUM } from '../2-services/2-database/database-types.mjs';
import { filterContentList } from './11-content/content-utilities.mjs';



/***********************************************************************
 *      SERVER SEARCH CONFIGURATION & DATABASE REFERENCES              *
 * Must Sync: \0-assets\field-sync\input-config-sync\search-config.mts *
 ***********************************************************************/
export class SearchTypeInfoServer<ListItemType, ModelType> extends SearchTypeInfo<ListItemType> {
    refineDatabaseMapping:Map<string, string[]>;

    searchByIDMap:Map<string, (ID:number) => Promise<ListItemType>>;
    searchByOwnerID:(ID:number) => Promise<ListItemType[]>;
    fetchDefaultList:(userID:number) => Promise<ListItemType[]>;
    searchCache: (searchTerm:string, searchRefine:string) => Promise<ListItemType[]|undefined>;
    executeSearch:(searchTerm:string, columnList:string[]) => Promise<ListItemType[]>;
    saveCache:(searchTerm:string, searchRefine:string, resultList:ListItemType[]) => Promise<boolean>;
    filterResultList: (request:JwtSearchRequest, resultList:ListItemType[], searchFilter:string) => Promise<ListItemType[]>;
    adminFlushCache: () => Promise<boolean>;

    /* Default Method Implementations */
    readonly defaultPromiseUndefined = () => Promise.resolve(undefined);
    readonly defaultPromiseBoolean = () => Promise.resolve(false);
    readonly defaultPromiseList = () => Promise.resolve([] as ListItemType[]);

    constructor(props: {searchTypeInfo:SearchTypeInfo<ListItemType>, refineDatabaseMapping?:Map<string, string[]>,
      searchByIDMap?:Map<string, (ID:number) => Promise<ListItemType[]>>,
      fetchDefaultList?:(userID:number) => Promise<ListItemType[]>, 
      searchCache?: (searchTerm:string, searchRefine:string) => Promise<ListItemType[]>,
      executeSearch?:(searchTerm:string, columnList:string[]) => Promise<ListItemType[]>,
      saveCache?:(searchTerm:string, searchRefine:string, resultList:ListItemType[]) => Promise<boolean>,
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
         if((this.searchRefineList.length !== (this.refineDatabaseMapping.size + this.searchByIDMap.size)) || this.searchRefineList.some(f => !(this.refineDatabaseMapping.has(f) || this.searchByIDMap.has(f)))) throw new Error(`Server Search Type:${this.searchType} contains mismatch between searchRefineList and refineDatabaseMapping.`);
         if((this.searchType !== SearchType.NONE) && !this.searchByIDMap.has('ID')) throw new Error(`Server Search Type:${this.searchType} must contain searchByID of type 'ID'.`);
         if(this.cacheAvailable && ((this.adminFlushCacheRoute.trim() !== '') && (this.saveCache === this.defaultPromiseBoolean) || (this.adminFlushCache === this.defaultPromiseBoolean))) throw new Error(`Server Search Type:${this.searchType} cacheAvailable: TRUE; but missing references.`);
         if(!this.cacheAvailable && ((this.saveCache !== this.defaultPromiseBoolean) || (this.adminFlushCache !== this.defaultPromiseBoolean))) throw new Error(`Server Search Type:${this.searchType} cacheAvailable: FALSE; but still contains references.`);
    }
}



export const SearchDetailServer:Record<SearchType, SearchTypeInfoServer<any, BASE_MODEL<any, any, any>>> = {
  [SearchType.NONE]: new SearchTypeInfoServer<LabelListItem,  BASE_MODEL<any, any, any>>({ searchTypeInfo: SearchDetail[SearchType.NONE] }),

  [SearchType.USER]: new SearchTypeInfoServer<ProfileListItem, USER>({ searchTypeInfo: SearchDetail[SearchType.USER], 
                          refineDatabaseMapping: new Map([[UserSearchRefineEnum.NAME, ['firstName', 'lastName', 'displayName']],
                                [UserSearchRefineEnum.EMAIL, ['email']], [UserSearchRefineEnum.NOTES, ['notes']], [UserSearchRefineEnum.LOCATION, ['postalCode']],
                                [UserSearchRefineEnum.ALL, ['firstName', 'lastName', 'displayName', 'email', 'postalCode']]
                            ]),
                          searchByIDMap: new Map([[UserSearchRefineEnum.ID, (ID:number) => DB_SELECT_USER(new Map([['userID', ID]])).then((model) => [model.toListItem()])]]),
                          fetchDefaultList: DB_SELECT_CONTACTS,
                          searchCache: (searchTerm:string, searchRefine:string) => DB_SELECT_USER_SEARCH_CACHE(searchTerm, UserSearchRefineEnum[searchRefine]),
                          executeSearch: (searchTerm:string, columnList:string[]) => DB_SELECT_USER_SEARCH({searchTerm, columnList, excludeGeneralUsers: false, searchInactive: false}),
                          saveCache: (searchTerm:string, searchRefine:string, resultList:any[]) => DB_INSERT_USER_SEARCH_CACHE({searchTerm, searchRefine: UserSearchRefineEnum[searchRefine], userList: resultList as ProfileListItem[]}),
                          adminFlushCache: DB_FLUSH_USER_SEARCH_CACHE_ADMIN,
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
                          searchCache: (searchTerm:string, searchRefine:string) => DB_SELECT_CIRCLE_SEARCH_CACHE(searchTerm, CircleSearchRefineEnum[searchRefine]),
                          executeSearch: DB_SELECT_CIRCLE_SEARCH,
                          saveCache: (searchTerm:string, searchRefine:string, resultList:any[]) => DB_INSERT_CIRCLE_SEARCH_CACHE({searchTerm, searchRefine: CircleSearchRefineEnum[searchRefine], circleList: resultList as CircleListItem[]}),
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
                            executeSearch: DB_SELECT_CONTENT_SEARCH,
                            filterResultList: filterContentList,
                        }),
};



/*********************************
 *      GENERIC SEARCH ROUTE     *
 * (All parameters are optional) *
 *********************************/
export const GET_SearchList = async(searchType:SearchType|undefined, request:JwtSearchRequest, response:Response, next:NextFunction) => {
    /* Identifying Search Type via URL parameter and authenticate */
    if(searchType === undefined) {
        searchType = SearchType[request.params.type];

        if(searchType === undefined) return next(new Exception(400, `Failed to parse search type :: missing 'type' parameter :: ${request.params.type}`, 'Missing Search Type'));

        /* Authorization verify access role */
        const searchDetail:SearchTypeInfoServer<ProfileListItem, BASE_MODEL<any, any, any>> = SearchDetailServer[searchType];
        if((searchDetail.roleList.length < Object.values(RoleEnum).length) && (request.jwtUserRole !== RoleEnum.ADMIN) && !(await DB_IS_ANY_USER_ROLE(request.jwtUserID, searchDetail.roleList.map(role => DATABASE_USER_ROLE_ENUM[role]))))
            return next(new Exception(401, `Search ${searchDetail.displayTitle} operation is unauthorized for user ${request.jwtUserID}`));
    }

    /* Execute Search */          
    const resultList:DisplayItemType[]|undefined = await searchList(searchType, request);

    if(Array.isArray(resultList))
        return response.status(resultList.length === 0 ? 205 : 200).send(resultList);
    else
        return next(new Exception(500, `Searching Error occurred for type ${searchType}`, 'Search Failed'));
};



/**************************
 * GENERIC SEARCH PROCESS *
 **************************/
export const searchList = async(searchType:SearchType, request:JwtSearchRequest):Promise<DisplayItemType[]|undefined> => {
    //Precaution since all fields are parsed from input or reference config: SearchDetailServer
    try {
        const searchDetail:SearchTypeInfoServer<DisplayItemType, BASE_MODEL<any, any, any>> = SearchDetailServer[searchType];
        let searchTerm:string = request.query.search || '';
        const searchRefine:string = searchDetail.searchRefineList.includes(request.query.refine || '') ? request.query.refine : 'ALL';
        const searchFilter:string = request.query.filter || '';
        const ignoreCache:boolean = (request.query.ignoreCache === 'true');
        const resultList:DisplayItemType[] = [];

        if(searchDetail.searchByIDMap.has(searchRefine)) {
            const searchID:number|typeof NaN = parseInt(searchTerm.trim());
            if(isNaN(searchID)) {
                log.warn(`ID Searching Error: ${searchDetail.displayTitle} for '${searchTerm}' via '${searchRefine}'`, searchID);
                return [];
                
            } else {
                const searchResults = await searchDetail.searchByIDMap.get(searchRefine)(searchID);
                resultList.push(...(Array.isArray(searchResults) ? searchResults : [searchResults]));
                log.event(`Searching: [${searchRefine}] ${searchDetail.displayTitle} for '${searchTerm}' via '${searchRefine}'`, resultList.length || 'Zero Matches');
            }
        } else {
            let searchResultList:DisplayItemType[]|undefined; //Undefined indicates no result yet

            /* MINIMUM TERM LENGTH => DEFAULT LIST */
            if(searchTerm.length < SEARCH_MIN_CHARS) {
                searchTerm = `DEFAULT-${request.jwtUserID}`; //For unique cache save
                searchResultList = await searchDetail.fetchDefaultList(request.jwtUserID);

            /* Search Cache */
            } else if(searchDetail.cacheAvailable && !ignoreCache && (searchDetail.searchCache !== searchDetail.defaultPromiseList))
                searchResultList = await searchDetail.searchCache(searchTerm, searchRefine);

            if(searchResultList !== undefined) log.event(`Searching: [Cache Result] ${searchDetail.displayTitle} for '${searchTerm}' via '${searchRefine}'`, searchResultList.length || 'Zero Matches');

            /* Execute Search */ 
            else if(searchDetail.executeSearch === searchDetail.defaultPromiseList)
                throw `executeSearch() is not declared for type ${searchDetail.displayTitle}`;
            
            else {
                searchResultList = await searchDetail.executeSearch(searchTerm, searchDetail.refineDatabaseMapping.get(searchRefine));

                if(searchResultList !== undefined) log.event(`Searching: [Query Result] ${searchDetail.displayTitle} for '${searchTerm}' via '${searchRefine}' | ignoreCache: ${ignoreCache}`, searchResultList.length || 'Zero Matches');

                /* NO RESULT IDENTIFIED */ 
                else {
                    searchResultList = [];
                    log.event(`Searching: [Zero Result] ${searchDetail.displayTitle} for '${searchTerm}' via '${searchRefine}' | ignoreCache: ${ignoreCache}`);
                }

                /* Save to Cache (Including empty lists) */
                if((searchDetail.cacheAvailable && !ignoreCache && (searchDetail.saveCache !== searchDetail.defaultPromiseBoolean)) && await searchDetail.saveCache(searchTerm, searchRefine, searchResultList))
                    log.event(`Searching: (Cache Saved) ${searchDetail.displayTitle} for '${searchTerm}' via '${searchRefine}'`, searchResultList.length || 'Zero Matches');
            }

            resultList.push(...searchResultList);
        }

        return searchDetail.filterResultList(request, resultList, searchFilter);

    } catch(error) {
        log.error(`Exception occurred in searchList for:${searchType}`, JSON.stringify(request.query), error);
        return undefined;
    }
}



/*********************************
 *   GENERIC CACHE FLUSH ROUTE   *
 *********************************/
export const DELETE_flushSearchCacheAdmin = async (searchType:SearchType|undefined, request:JwtSearchRequest, response:Response, next: NextFunction) => {
    let searchDetail:SearchTypeInfoServer<ProfileListItem, BASE_MODEL<any, any, any>> = SearchDetailServer[searchType];

    /* Identifying Search Type via URL parameter and authenticate */
    if(searchType === undefined) {
        searchType = SearchType[request.params.type];

        if(searchType === undefined) return next(new Exception(400, `Failed to parse search type :: missing 'type' parameter :: ${request.params.type}`, 'Missing Search Type'));

        /* Authorization verify access role */
        searchDetail = SearchDetailServer[searchType];
        if((searchDetail.roleList.length < Object.values(RoleEnum).length) && (request.jwtUserRole !== RoleEnum.ADMIN) && !(await DB_IS_ANY_USER_ROLE(request.jwtUserID, searchDetail.roleList.map(role => DATABASE_USER_ROLE_ENUM[role]))))
            return next(new Exception(401, `Search ${searchDetail.displayTitle} operation is unauthorized for user ${request.jwtUserID}`));
    }

    /* Verify Cache Enabled */ 
    if(!searchDetail.cacheAvailable)
        log.warn(`Search ${searchDetail.displayTitle} cache is currently disabled.`);

    /* Execute Flush */
    if(searchDetail.adminFlushCache === searchDetail.defaultPromiseBoolean)
        return next(new Exception(500, `adminFlushCache() is not declared for type ${searchDetail.displayTitle}`, 'Not Implemented'));

    else if(!(await searchDetail.adminFlushCache()))
        return next(new Exception(500, `Search ${searchDetail.displayTitle} failed to flush cache.`, 'Flush Failed'));

    else {
        response.status(202).send(`Search ${searchDetail.displayTitle} cached successfully flushed.`);
        log.db(`User ${request.jwtUserID} has reset the server's ${searchDetail.displayTitle} cache.`);
    }
}
