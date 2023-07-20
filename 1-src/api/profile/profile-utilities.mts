import { ProfileEditRequest } from "./profile-types.mjs";
import { Exception } from "../api-types.mjs";
import * as log from '../../services/log.mjs';
import { getPasswordHash } from "../auth/auth-utilities.mjs";
import { EDIT_PROFILE_FIELDS, EDIT_PROFILE_FIELDS_ADMIN, GenderEnum, getDOBMaxDate, getDOBMinDate, InputField, InputType, RoleEnum, SIGNUP_PROFILE_FIELDS, SIGNUP_PROFILE_FIELDS_STUDENT } from "./Fields-Sync/profile-field-config.mjs";
import USER from "../../services/models/user.mjs";
import { NextFunction } from "express";

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


/****************************************************************
 *                 Profile Edit Utilities
 *  parse & validate JSON response to USER | (throws Exception)
 * **************************************************************/
//Local Mapping: ONLY FOR VALIDATIONS ( json defined in profile-field-config.mts )
const jsonToUserMapping = new Map<string, string>([
    ['userRoleTokenList', 'userRoleList'],
    ['password', 'passwordHash'],
    ['passwordVerify', 'passwordHash']
]);

export const createUserFromJSON = ({currentUser = new USER(), jsonObj, fieldList, next}:{currentUser?: USER, jsonObj:ProfileEditRequest['body'], fieldList:InputField[], next: NextFunction}):USER => {
    const user = new USER(undefined, currentUser.userID);
    user.userRoleList = currentUser.userRoleList;

    for(let field of fieldList) {
        if(field.required && jsonObj[field.field] === undefined && (jsonToUserMapping.get(field.field) || currentUser[field.field]) === undefined ) {
            next(new Exception(400, `${field.title} is Required.`, `${field.title} is Required.`));
            return undefined;

        } else if(jsonObj[field.field] === undefined)
            continue;
        else if(validateInput({field, value: jsonObj[field.field], highestRole: user.getHighestRole()})) {

            //Special Handling: Password Hash
            if(field.field === 'password' && jsonObj['password'] === jsonObj['passwordVerify'])
                user.passwordHash = getPasswordHash(jsonObj['password']);

            else if(field.field === 'userRoleTokenList')
                user.userRoleList = Array.from(jsonObj[field.field] as {role:string, token:string}[]).map(({role, token}) => RoleEnum[role as string] || RoleEnum.STUDENT);

            else if(user.hasProperty(field.field) && jsonObj[field.field] !== undefined)
                user[field.field] = parseInput({field:field, value:jsonObj[field.field]});

            else
                console.info('*Skipping extra field', field.field, jsonObj[field.field]);

        } else if(field.required) {
            next(new Exception(400, `${field.title} failed validations.`, `${field.title} is invalid.`));
            return undefined;
        }
    }
    return user;
}

//Private: parseInput by type ( must be direct mapping to USER property )
const parseInput = ({field, value}:{field:InputField, value:any}):any => {
    try {
        if(value === undefined || value === null)
            throw `${field.title} is undefined.`

        /* NOTE: All  */
        else if(field.field === 'userRoleList')
            return Array.from(value as string[]).map(role => RoleEnum[role as string]);

        else if(field.field === 'gender')
            return GenderEnum[value];

        else if(field.field === 'walkLevel')
            return parseInt(value) as number;

        else if(field.field === 'isActive')
            return (value === 'true') as boolean;

        else if(field.type === InputType.DATE)
            return new Date(value);

        else if(field.type === InputType.NUMBER)
            return parseFloat(value) as number;

        else if(field.type === InputType.MULTI_SELECTION_LIST)
            return Array.from(value);

        else
            return value;

    } catch(error) {
        log.error(`Failed to parse profile field: ${field.field} with value: ${value}`, error);
        new Exception(400, `${field.title} is Required.`);
        return undefined;
    }
}

const validateInput = ({field, value, highestRole = RoleEnum.STUDENT}:{field:InputField, value:string, highestRole?:RoleEnum}):boolean => {

    /* Field Exists */
    if(value === undefined) {
        return false;

    /* Validate general validationRegex from config */
    } else if(!(new RegExp(field.validationRegex).test(value))){
        return false;

    /* SELECT_LIST */
    } else if(field.type === InputType.SELECT_LIST && !field.selectOptionList.includes(`${value}`)) {
        return false;

    /* DATES | dateOfBirth */
    } else if(field.type === InputType.DATE && field.field === 'dateOfBirth') { //(Note: Assumes userRoleList has already been parsed or exists)
        const currentDate:Date = new Date(value);

        if(isNaN(currentDate.valueOf()) ||  currentDate < getDOBMinDate(highestRole) || currentDate > getDOBMaxDate(highestRole))
            return false;
    }

    return true;
}