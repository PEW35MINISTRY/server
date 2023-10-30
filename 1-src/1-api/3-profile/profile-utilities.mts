import { ProfileListItem } from '../../0-assets/field-sync/api-type-sync/profile-types.mjs';
import { EDIT_PROFILE_FIELDS, EDIT_PROFILE_FIELDS_ADMIN, RoleEnum, SIGNUP_PROFILE_FIELDS, SIGNUP_PROFILE_FIELDS_STUDENT, UserSearchFilterEnum } from '../../0-assets/field-sync/input-config-sync/profile-field-config.mjs';
import USER from '../../2-services/1-models/userModel.mjs';
import { DB_SELECT_CONTACTS, DB_SELECT_USER } from '../../2-services/2-database/queries/user-queries.mjs';
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

