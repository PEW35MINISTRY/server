import { Response, NextFunction } from 'express';
import * as log from '../2-services/log.mjs';
import { Exception, JwtSearchRequest, SearchDetailServer, SearchTypeInfoServer } from './api-types.mjs';
import { ProfileListItem } from '../0-assets/field-sync/api-type-sync/profile-types.mjs';
import { RoleEnum } from '../0-assets/field-sync/input-config-sync/profile-field-config.mjs';
import BASE_MODEL from '../2-services/1-models/baseModel.mjs';
import { DATABASE_USER_ROLE_ENUM } from '../2-services/2-database/database-types.mjs';
import { SearchType, DisplayItemType, SEARCH_MIN_CHARS } from '../0-assets/field-sync/input-config-sync/search-config.mjs';
import { DB_IS_ANY_USER_ROLE } from '../2-services/2-database/queries/user-queries.mjs';


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
            if((searchDetail.fetchDefaultList !== searchDetail.defaultPromiseList) && (searchTerm.length < SEARCH_MIN_CHARS)) {
                searchTerm = `DEFAULT-${request.jwtUserID}`; //For unique cache save
                searchResultList = await searchDetail.fetchDefaultList(request.jwtUserID);

                if(searchResultList !== undefined) log.event(`Searching: [Default Result] ${searchDetail.displayTitle} for '${searchTerm}'`, searchResultList.length || 'Zero Matches');

            /* Search Cache */
            } else if(searchDetail.cacheAvailable && !ignoreCache && (searchDetail.searchCache !== searchDetail.defaultPromiseList))
                searchResultList = await searchDetail.searchCache(request, searchTerm, searchRefine);

                if(searchResultList !== undefined) log.event(`Searching: [Cache Result] ${searchDetail.displayTitle} for '${searchTerm}' via '${searchRefine}'`, searchResultList.length || 'Zero Matches');

            /* Execute Search */ 
            if(searchDetail.executeSearch === searchDetail.defaultPromiseList)
                throw `executeSearch() is not declared for type ${searchDetail.displayTitle}`;
            
            else if(searchResultList === undefined) {
                searchResultList = await searchDetail.executeSearch(request, searchTerm, searchDetail.refineDatabaseMapping.get(searchRefine));

                if(searchResultList !== undefined) log.event(`Searching: [Query Result] ${searchDetail.displayTitle} for '${searchTerm}' via '${searchRefine}' | ignoreCache: ${ignoreCache}`, searchResultList.length || 'Zero Matches');

                /* NO RESULT IDENTIFIED */ 
                else {
                    searchResultList = [];
                    log.event(`Searching: [Zero Result] ${searchDetail.displayTitle} for '${searchTerm}' via '${searchRefine}' | ignoreCache: ${ignoreCache}`);
                }

                /* Save to Cache (Including empty lists) */
                if((searchDetail.cacheAvailable && !ignoreCache && (searchDetail.saveCache !== searchDetail.defaultPromiseBoolean)) && await searchDetail.saveCache(request, searchTerm, searchRefine, searchResultList))
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
