import { Exception, JwtSearchRequest } from '../api-types.mjs';
import * as log from '../../2-services/10-utilities/logging/log.mjs';
import { ProfileListItem } from '../../0-assets/field-sync/api-type-sync/profile-types.mjs';
import { EDIT_PROFILE_FIELDS, EDIT_PROFILE_FIELDS_ADMIN, RoleEnum, SIGNUP_PROFILE_FIELDS, SIGNUP_PROFILE_FIELDS_USER } from '../../0-assets/field-sync/input-config-sync/profile-field-config.mjs';
import { LIST_LIMIT, SEARCH_MIN_CHARS } from '../../0-assets/field-sync/input-config-sync/search-config.mjs';
import { DB_SELECT_USER_SEARCH } from '../../2-services/2-database/queries/user-queries.mjs';

export const editProfileFieldAllowed = (field:string, userRole:RoleEnum):boolean => {
    if(userRole === RoleEnum.ADMIN)
        return EDIT_PROFILE_FIELDS_ADMIN.some(inputField => inputField.field === field);
    else
        return EDIT_PROFILE_FIELDS.some(inputField => inputField.field === field);
}

export const signupProfileFieldAllowed = (field:string, userRole:RoleEnum):boolean => {
    if(userRole === RoleEnum.USER)
        return SIGNUP_PROFILE_FIELDS_USER.some(inputField => inputField.field === field);
    else
        return SIGNUP_PROFILE_FIELDS.some(inputField => inputField.field === field);
}

/**************************************************************
 *  CONTENT SEARCH FILTERING BY SEARCH                        *
 * Different from other SearchTypes, applying searchTerm here *
 **************************************************************/
export const filterContactList = async(request:JwtSearchRequest, contactList:ProfileListItem[], statusFilter:string):Promise<ProfileListItem[]> => {
    const searchTerm:string = request.query.search || '';

    if(searchTerm.length >= SEARCH_MIN_CHARS) {
        const resultList = contactList.filter((contact:ProfileListItem) => `${contact.displayName} ${contact.firstName}`.includes(searchTerm));

        //Indicates hit cache limit -> redirect to USER database search
        if(resultList.length === 0 && contactList.length === LIST_LIMIT) {
            log.warn(`Contact Search for user ${request.jwtUserID} exceeded limit of ${LIST_LIMIT}, redirecting to USER search which is global.`, searchTerm);

            return DB_SELECT_USER_SEARCH({searchTerm,  columnList: ['firstName', 'lastName', 'displayName'], excludeGeneralUsers: false, searchInactive: false});
        } else 
            return resultList;
    } else
        return contactList;
}
