import { ProfileListItem } from '../../0-assets/field-sync/api-type-sync/profile-types.mjs';
import { EDIT_PROFILE_FIELDS, EDIT_PROFILE_FIELDS_ADMIN, RoleEnum, SIGNUP_PROFILE_FIELDS, SIGNUP_PROFILE_FIELDS_STUDENT, UserSearchFilterEnum } from '../../0-assets/field-sync/input-config-sync/profile-field-config.mjs';
import USER from '../../2-services/1-models/userModel.mjs';
import { DB_INSERT_USER_SEARCH_CACHE, DB_SELECT_CONTACTS, DB_SELECT_USER, DB_SELECT_USER_SEARCH, DB_SELECT_USER_SEARCH_CACHE } from '../../2-services/2-database/queries/user-queries.mjs';
import * as log from '../../2-services/log.mjs';
import { Exception } from '../api-types.mjs';


export const editProfileFieldAllowed = (field:string, userRole:RoleEnum):boolean => {
    if(userRole === RoleEnum.ADMIN)
        return EDIT_PROFILE_FIELDS_ADMIN.some(inputField => inputField.field === field);
    else
        return EDIT_PROFILE_FIELDS.some(inputField => inputField.field === field);
}

export const signupProfileFieldAllowed = (field:string, userRole:RoleEnum):boolean => {
    if(userRole === RoleEnum.STUDENT)
        return SIGNUP_PROFILE_FIELDS_STUDENT.some(inputField => inputField.field === field);
    else
        return SIGNUP_PROFILE_FIELDS.some(inputField => inputField.field === field);
}


/**********************************
 *  Client SEARCH & CACHE QUERIES
 **********************************/
const saveCache = ({searchTerm, searchFilter, excludeStudent, searchInactive}:{searchTerm:string, searchFilter:UserSearchFilterEnum, excludeStudent:boolean, searchInactive:boolean}):boolean => 
                    !excludeStudent && !searchInactive && searchTerm.length >= 3 && searchFilter !== UserSearchFilterEnum.ID;

export const searchUserListFromCache = async({requestingUserID, searchTerm, searchFilter = UserSearchFilterEnum.ALL, excludeStudent = false, searchInactive = false}:{requestingUserID:number, searchTerm:string, searchFilter?:UserSearchFilterEnum, excludeStudent?:boolean, searchInactive?:boolean}):Promise<ProfileListItem[]> => {
    //Only student searches are cached
    const userList = saveCache({searchTerm, searchFilter, excludeStudent, searchInactive}) ?
                    await DB_SELECT_USER_SEARCH_CACHE(searchTerm, searchFilter) : []; 

    if(userList.length === 0)
        return searchUserList({requestingUserID, searchTerm, searchFilter});

    return userList;
}

export const searchUserList = async({requestingUserID, searchTerm, searchFilter = UserSearchFilterEnum.ALL, excludeStudent = false, searchInactive = false}:{requestingUserID:number, searchTerm:string, searchFilter?:UserSearchFilterEnum, excludeStudent?:boolean, searchInactive?:boolean}):Promise<ProfileListItem[]> => {

    if(searchFilter === UserSearchFilterEnum.ID) {
        const user:USER = await DB_SELECT_USER(new Map([['userID', parseInt(searchTerm.trim())]]));

        if(user.isValid) return [user.toListItem()];
        else return [];
    }

    //Define user_search_cache columns based on UserSearchFilterEnum type 
    const columnList:string[] = (searchFilter === UserSearchFilterEnum.NAME) ? ['firstName', 'lastName', 'displayName']
        : (searchFilter === UserSearchFilterEnum.EMAIL) ? ['email']
        : (searchFilter === UserSearchFilterEnum.NOTES) ? ['notes']
        : (searchFilter === UserSearchFilterEnum.LOCATION) ? ['postalCode']
        : ['firstName', 'lastName', 'displayName', 'email', 'postalCode']; //ALL

    //Require minimum 3 letters to search
    const userList:ProfileListItem[] = (searchTerm === 'default') ? await DB_SELECT_CONTACTS(requestingUserID)
                        : await DB_SELECT_USER_SEARCH({searchTerm, columnList, excludeStudent, searchInactive});

    if(userList.length > 0 && saveCache({searchTerm, searchFilter, excludeStudent, searchInactive}))
        await DB_INSERT_USER_SEARCH_CACHE({searchTerm, searchFilter: searchFilter, userList});
    
    else if(userList.length === 0) log.event('User search resulted in zero matches', searchTerm, searchFilter);

    return userList;
}

