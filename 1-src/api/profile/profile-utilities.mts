import { ProfileEditRequest } from "./profile-types.mjs";
import { Exception } from "../api-types.mjs";
import * as log from '../../services/log.mjs';
import { getPasswordHash } from "../auth/auth-utilities.mjs";
import { EDIT_PROFILE_FIELDS, EDIT_PROFILE_FIELDS_ADMIN, GenderEnum, getDOBMaxDate, getDOBMinDate, InputField, InputType, RoleEnum, SIGNUP_PROFILE_FIELDS, SIGNUP_PROFILE_FIELDS_STUDENT } from "./Fields-Sync/profile-field-config.mjs";
import USER from "../../services/models/user.mjs";

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
export const createUserFromJSON = ({currentUser = new USER(), jsonObj, fieldList}:{currentUser?: USER, jsonObj:ProfileEditRequest['body'], fieldList:InputField[]}):USER => {

    fieldList.forEach((field) => {

        if(field.required && currentUser[field.field] === undefined && jsonObj[field.field] === undefined ) {
            new Exception(400, `${field.title} is Required.`);
            return undefined;

        } else if(jsonObj[field.field] !== undefined && validateInput({field, value: jsonObj[field.field], highestRole: currentUser.getHighestRole()})) {

            //Special Handling: Password Hash
            if(field.field === 'password' && jsonObj['password'] === jsonObj['passwordVerify'])
                currentUser.passwordHash = getPasswordHash(jsonObj['password']);

            else if(field.field === 'userRoleTokenList')
                currentUser.userRoleList = Array.from(jsonObj[field.field] as {role:string, token:string}[]).map(({role, token}) => RoleEnum[role as string]);

                else if(currentUser.hasProperty(field.field) && jsonObj[field.field] !== undefined)
                currentUser[field.field] = parseInput({field:field, value:jsonObj[field.field]});

            else
                console.info('*Skipping extra field', field.field, jsonObj[field.field]);

        } else {
            new Exception(400, `${field.title} is Invalid.`);
            return undefined;
        }
    });
    return currentUser;
}

//Private: parseInput by type
const parseInput = ({field, value}:{field:InputField, value:any}):any => {
    try {
        if(value === undefined || value === null)
            throw `${field.title} is undefined.`

        else if(field.field === 'userRoleList')
            return Array.from(value as string[]).map(role => RoleEnum[role as string]);

        else if(field.field === 'gender')
            return GenderEnum[value];

        else if(field.type === InputType.DATE)
            return new Date(value);

        else if(field.type === InputType.NUMBER)
            return value as number;

        else if(field.type === InputType.MULTI_SELECTION_LIST)
            return Array.from(value);

        else
            return value;

    } catch(error) {
        log.error(`Failed to parse profile field: ${field.field} with value: ${value}`);
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
    } else if(field.type === InputType.SELECT_LIST && !field.selectOptionList.includes(value)) {
        return false;

    /* DATES | dateOfBirth */
    } else if(field.type === InputType.DATE && field.field === 'dateOfBirth') { //(Note: Assumes userRoleList has already been parsed or exists)
        const currentDate:Date = new Date(value);

        if(currentDate < getDOBMinDate(highestRole)) {
            return false;

        } else if(currentDate > getDOBMaxDate(highestRole)) {
            return false
        }
    }

    return true;
}