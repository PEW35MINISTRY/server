import { CircleListItem } from '../../0-assets/field-sync/api-type-sync/circle-types.mjs';
import { CircleSearchFilterEnum, CircleStatusEnum } from '../../0-assets/field-sync/input-config-sync/circle-field-config.mjs';
import CIRCLE from '../../2-services/1-models/circleModel.mjs';
import { DATABASE_CIRCLE_STATUS_ENUM } from '../../2-services/2-database/database-types.mjs';
import { DB_DELETE_CIRCLE_SEARCH_REVERSE_CACHE, DB_INSERT_CIRCLE_SEARCH_CACHE, DB_SELECT_CIRCLE, DB_SELECT_CIRCLE_IDS, DB_SELECT_CIRCLE_SEARCH, DB_SELECT_CIRCLE_SEARCH_CACHE, DB_SELECT_LATEST_CIRCLES, DB_SELECT_USER_CIRCLE_IDS } from '../../2-services/2-database/queries/circle-queries.mjs';
import * as log from '../../2-services/log.mjs';

/**********************************
 *  CIRCLE SEARCH & CACHE QUERIES
 **********************************/
const saveCache = ({searchTerm, searchFilter}:{searchTerm:string, searchFilter:CircleSearchFilterEnum}):boolean => 
                    searchTerm.length >= 3 && searchFilter !== CircleSearchFilterEnum.ID;


export const searchCircleListFromCache = async(searchTerm:string, searchFilter:CircleSearchFilterEnum = CircleSearchFilterEnum.ALL):Promise<CircleListItem[]> => {
    //Single CircleID and short searches are not cached
    const circleList:CircleListItem[] = saveCache({searchTerm, searchFilter}) ?
         await DB_SELECT_CIRCLE_SEARCH_CACHE(searchTerm, searchFilter) : []; 

    if(circleList.length === 0)
        return searchCircleList(searchTerm, searchFilter);

    return circleList;
}


export const searchCircleList = async(searchTerm:string, searchFilter:CircleSearchFilterEnum = CircleSearchFilterEnum.ALL):Promise<CircleListItem[]> => {

    if(searchFilter === CircleSearchFilterEnum.ID) {
        const circle:CIRCLE = await DB_SELECT_CIRCLE(parseInt(searchTerm.trim()));

        if(circle.isValid) return [circle.toListItem()];
        else return [];
    }

    //Define circle_search columns based on CircleSearchFilter type | [SYNC with updateCircleListCache]
    const columnList:string[] = (searchFilter === CircleSearchFilterEnum.LEADER) ? ['firstName', 'lastName', 'displayName', 'email']
        : (searchFilter === CircleSearchFilterEnum.NAME) ? ['name']
        : (searchFilter === CircleSearchFilterEnum.DESCRIPTION) ? ['description']
        : (searchFilter === CircleSearchFilterEnum.NAME_DESCRIPTION) ? ['name', 'description']
        : (searchFilter === CircleSearchFilterEnum.LOCATION) ? ['circle.postalCode']
        : ['name', 'description', 'circle.postalCode', 'firstName', 'lastName', 'displayName', 'email']; //ALL

    //Require minimum 3 letters to search
    const circleList:CircleListItem[] = (searchTerm === 'default') ? await DB_SELECT_LATEST_CIRCLES()
                        : await DB_SELECT_CIRCLE_SEARCH(searchTerm, columnList);

    if(circleList.length > 0 && saveCache({searchTerm, searchFilter}))
        await DB_INSERT_CIRCLE_SEARCH_CACHE({searchTerm, searchFilter: searchFilter, circleList});
    
    else if(circleList.length === 0) log.event('Circle search resulted in zero matches', searchTerm, searchFilter);

    return circleList;
}

//Intelligently clear circle_search_cache base on circle change | [SYNC with searchCircleList]
export const updateCircleListCache = async(updatedFields:Map<string, any>):Promise<Boolean> => {
    const filterList:CircleSearchFilterEnum[] = [CircleSearchFilterEnum.ALL];
    const valueList:string[] = [];

    updatedFields.forEach(([field, value]) => {
        if(field === 'name') {
            filterList.push(CircleSearchFilterEnum.NAME); //duplicates are okay
            filterList.push(CircleSearchFilterEnum.NAME_DESCRIPTION);
            valueList.push(value);
        } else if(field === 'description') {
            filterList.push(CircleSearchFilterEnum.DESCRIPTION);
            filterList.push(CircleSearchFilterEnum.NAME_DESCRIPTION);
            valueList.push(value);
        } else if(field === 'postalCode') {
            filterList.push(CircleSearchFilterEnum.LOCATION);
            valueList.push(value);
        } else if(field === 'leaderID') {
            filterList.push(CircleSearchFilterEnum.LEADER);
            valueList.push(value);
        }
    });

    return await DB_DELETE_CIRCLE_SEARCH_REVERSE_CACHE(filterList, valueList);
}


//TODO: User current circleIDs list could be cached short-term (5min); since runs for each letter of a search
export const filterListByCircleStatus = async({userID, circleList, circleStatus = CircleStatusEnum.NON_MEMBER}:{userID:number, circleList:CircleListItem[], circleStatus?:CircleStatusEnum}) => {
    let excludeCircleIDList:number[] = [];
    let includeCircleIDList:number[] = [];

    switch(circleStatus) { 
    //Raw Search: NO FILTERING
        case CircleStatusEnum.NONE:
            return circleList;

    //Exclusive Conditions
        case CircleStatusEnum.AVAILABLE: //Includes: NO STATUS & INVITE
            excludeCircleIDList = [
                ...await DB_SELECT_USER_CIRCLE_IDS(userID, DATABASE_CIRCLE_STATUS_ENUM.MEMBER),
                ...await DB_SELECT_USER_CIRCLE_IDS(userID, DATABASE_CIRCLE_STATUS_ENUM.REQUEST)
            ];
            return circleList.filter(item => !excludeCircleIDList.includes(item.circleID));

        case CircleStatusEnum.NON_MEMBER: //Includes: NO STATUS
            excludeCircleIDList = await DB_SELECT_USER_CIRCLE_IDS(userID, undefined);
            return circleList.filter(item => !excludeCircleIDList.includes(item.circleID));

    //Inclusive Conditions
        case CircleStatusEnum.LEADER:  //Includes: ONLY LEADER
            includeCircleIDList = await DB_SELECT_CIRCLE_IDS(new Map([['leaderID', userID]]));
            return circleList.filter(item => includeCircleIDList.includes(item.circleID))
                             .map(item => ({...item, status: CircleStatusEnum.LEADER}));
        
        case CircleStatusEnum.CONNECTED: //Includes: MEMBER || INVITE || REQUEST
            includeCircleIDList = await DB_SELECT_USER_CIRCLE_IDS(userID, undefined);
            return circleList.filter(item => includeCircleIDList.includes(item.circleID));

        case CircleStatusEnum.MEMBER:  //Includes: MEMBER || LEADER
        case CircleStatusEnum.INVITE:  //Includes: ONLY INVITE
        case CircleStatusEnum.REQUEST: //Includes: ONLY REQUEST
            includeCircleIDList = await DB_SELECT_USER_CIRCLE_IDS(userID, DATABASE_CIRCLE_STATUS_ENUM[circleStatus]);
            return circleList.filter(item => includeCircleIDList.includes(item.circleID))
                             .map(item => ({...item, status: circleStatus}));

        default:
            log.error('filterByCircleStatusList - Invalid circleStatus', circleStatus);
            return circleList;
    }
}
