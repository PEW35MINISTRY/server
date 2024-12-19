import { CircleListItem } from '../../0-assets/field-sync/api-type-sync/circle-types.mjs';
import { CircleSearchRefineEnum, CircleStatusEnum } from '../../0-assets/field-sync/input-config-sync/circle-field-config.mjs';
import { DATABASE_CIRCLE_STATUS_ENUM } from '../../2-services/2-database/database-types.mjs';
import { DB_DELETE_CIRCLE_SEARCH_REVERSE_CACHE, DB_SELECT_CIRCLE_IDS, DB_SELECT_USER_CIRCLE_IDS } from '../../2-services/2-database/queries/circle-queries.mjs';
import * as log from '../../2-services/10-utilities/logging/log.mjs';
import { JwtSearchRequest } from '../api-types.mjs';

/**********************************
 *  CIRCLE SEARCH & CACHE QUERIES
 **********************************/

//Intelligently clear circle_search_cache base on circle change | [SYNC with searchCircleList]
export const updateCircleListCache = async(updatedFields:Map<string, any>):Promise<Boolean> => {
    const filterList:CircleSearchRefineEnum[] = [CircleSearchRefineEnum.ALL];
    const valueList:string[] = [];

    updatedFields.forEach(([field, value]) => {
        if(field === 'name') {
            filterList.push(CircleSearchRefineEnum.NAME); //duplicates are okay
            filterList.push(CircleSearchRefineEnum.NAME_DESCRIPTION);
            valueList.push(value);
        } else if(field === 'description') {
            filterList.push(CircleSearchRefineEnum.DESCRIPTION);
            filterList.push(CircleSearchRefineEnum.NAME_DESCRIPTION);
            valueList.push(value);
        } else if(field === 'postalCode') {
            filterList.push(CircleSearchRefineEnum.LOCATION);
            valueList.push(value);
        } else if(field === 'leaderID') {
            filterList.push(CircleSearchRefineEnum.LEADER);
            valueList.push(value);
        }
    });

    return await DB_DELETE_CIRCLE_SEARCH_REVERSE_CACHE(filterList, valueList);
}


//TODO: User current circleIDs list could be cached short-term (5min); since runs for each letter of a search
export const filterListByCircleStatus = async(request:JwtSearchRequest, circleList:CircleListItem[], circleStatus:CircleStatusEnum):Promise<CircleListItem[]> => {
    const userID = request.jwtUserID;
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
            return circleList;
    }
}
