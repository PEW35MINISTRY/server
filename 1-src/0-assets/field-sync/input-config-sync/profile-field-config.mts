/***** ONLY DEPENDENCY: ./inputField - Define all other types locally *****/
import InputField, { InputRangeField, InputSelectionField, InputType } from './inputField.mjs';

/*******************************************************
*        PROFILE FIELD CONFIGURATION FILE
* Sync across all repositories: server, portal, mobile
*******************************************************/

export const EMAIL_REGEX = new RegExp(/^(([^<>()\[\]\.,;:\s@\"]+(\.[^<>()\[\]\.,;:\s@\"]+)*)|(\".+\"))@(([^<>()\.,;\s@\"]+\.{0,1})+([^<>()\.,;:\s@\"]{2,}|[\d\.]+))$/);
export const DATE_REGEX = new RegExp(/^\d{4}-[01]\d-[0-3]\dT[0-2]\d:[0-5]\d:[0-5]\d\.\d+([+-][0-2]\d:[0-5]\d|Z)$/); //1970-01-01T00:00:00.013Z
export const PASSWORD_REGEX = new RegExp(/^.{5,20}$/);
// PASSWORD_REGEX: One uppercase, one lowercase, one digit, one special character, 8+ chars in length
// export const PASSWORD_REGEX = new RegExp(/^(?=.*?[A-Z])(?=.*?[a-z])(?=.*?[0-9])(?=.*?[#?!@$%^&*-_]).{8,}$/);
    
/***************************************
*    PROFILE TYPES AND DEPENDENCIES
****************************************/
//Note: enums must have matching values to cast (string as Enum) or define (Enum[string]) equally
export enum GenderEnum {
    MALE = 'MALE',
    FEMALE = 'FEMALE'
}

export enum RoleEnum {
    USER = 'USER',                             //General user only access to mobile app.
    CIRCLE_LEADER = 'CIRCLE_LEADER',           //Allowed to create and manage small groups of users.
    CONTENT_APPROVER = 'CONTENT_APPROVER',     //Special access to content overview.
    DEVELOPER = 'DEVELOPER',                   //Full access to features; but not user data.
    ADMIN = 'ADMIN',                           //All access and privileges.
}

export enum UserSearchRefineEnum {
    ALL = 'ALL',                     //default search all fields
    ID = 'ID',                       //userID exact match
    NAME = 'NAME',                   //firstname, lastname, displayname
    EMAIL = 'EMAIL',
    NOTES = 'NOTES',
    LOCATION = 'LOCATION'
}

//Sync with DATABASE_PARTNER_STATUS_ENUM
export enum PartnerStatusEnum {
    PARTNER = 'PARTNER',
    PENDING_CONTRACT_BOTH = 'PENDING_CONTRACT_BOTH',
    PENDING_CONTRACT_USER = 'PENDING_CONTRACT_USER',
    PENDING_CONTRACT_PARTNER = 'PENDING_CONTRACT_PARTNER',
    ENDED = 'ENDED',
    FAILED = 'FAILED'
}

export const getDateYearsAgo = (years: number = 13):Date => {
    let date = new Date();
    date.setFullYear(date.getFullYear() - years);
    return date;
}

//HTML date input supports: 'YYYY-MM-DD'
export const getShortDate = (dateISO:string):string => dateISO ? dateISO.split('T')[0] : getDateYearsAgo(13).toISOString().toString().split('T')[0];
export const getDOBMinDate = (role:RoleEnum = RoleEnum.USER):Date => (role === RoleEnum.USER) ? getDateYearsAgo(19) : getDateYearsAgo(100); //Max Age
export const getDOBMaxDate = (role:RoleEnum = RoleEnum.USER):Date => (role === RoleEnum.USER) ? getDateYearsAgo(13) : getDateYearsAgo(18); //Min Age

/*****************************************
*   FIELD LISTS: LOGIN | SIGNUP | EDIT
* Used for dynamic display and privileges
******************************************/

export const LOGIN_PROFILE_FIELDS:InputField[] = [
    new InputField({title: 'Email Address', field: 'email', type: InputType.EMAIL, required: true,  validationRegex: EMAIL_REGEX, validationMessage: 'Required, invalid email format.' }),
    new InputField({title: 'Password', field: 'password', type: InputType.PASSWORD, required: true, validationRegex: new RegExp(/^.{5,20}$/), validationMessage: 'Required, 5-20 characters.' }),
]

//Note: extending list forces the order, may need a sortID or duplicating for now
export const EDIT_PROFILE_FIELDS:InputField[] = [
    new InputField({title: 'First Name', field: 'firstName', type: InputType.TEXT, required: true, validationRegex: new RegExp(/^.{1,30}$/), validationMessage: 'Required, max 30 characters.' }),
    new InputField({title: 'Last Name', field: 'lastName', type: InputType.TEXT, required: true, validationRegex: new RegExp(/^.{1,30}$/), validationMessage: 'Required, max 30 characters.' }),
    new InputField({title: 'Public Name', field: 'displayName', type: InputType.TEXT, unique: true, validationRegex: new RegExp(/^[a-z][a-z0-9_-]{3,13}[a-z0-9]$/), validationMessage: 'Unique, start/end with letter/numbers, 5-15 chars, lowercase, numbers, dashes, underscores.' }),
    new InputField({title: 'Password', field: 'password', type: InputType.PASSWORD, required: false, validationRegex: PASSWORD_REGEX, validationMessage: '5-20 characters.' }),
    new InputField({title: 'Verify Password', field: 'passwordVerify', type: InputType.PASSWORD, required: false, validationRegex: PASSWORD_REGEX, validationMessage: 'Must match password field.' }),
    new InputField({title: 'Postal Code', field: 'postalCode', type: InputType.TEXT, required: true, validationRegex: new RegExp(/^.{5,15}$/), validationMessage: 'Required, 5-15 characters.' }),
    new InputRangeField({title: 'Max Partners', field: 'maxPartners', required: true, minValue: 0, maxValue: 10, type: InputType.RANGE_SLIDER, validationRegex: new RegExp(/[0-9]+/), validationMessage: 'Required, between 0-10.'}),
];

export const EDIT_PROFILE_FIELDS_ADMIN:InputField[] = [    
    new InputSelectionField({title: 'Account Type', field: 'userRoleTokenList', type: InputType.MULTI_SELECTION_LIST, required: false, selectOptionList: Object.values(RoleEnum), validationMessage: 'Authorization token is required.'}),
    new InputSelectionField({title: 'Active Account', field: 'isActive', required: true, type: InputType.SELECT_LIST, selectOptionList: ['true', 'false']}),
    new InputField({title: 'Email Address', field: 'email', type: InputType.EMAIL, unique: true,  validationRegex: EMAIL_REGEX, validationMessage: 'Required, invalid email format.' }),
    ...EDIT_PROFILE_FIELDS,
    new InputSelectionField({title: 'Gender', field: 'gender', type: InputType.SELECT_LIST, required: true, selectOptionList: Object.values(GenderEnum)}),
    new InputField({title: 'Date of Birth', field: 'dateOfBirth', type: InputType.DATE, value: getDateYearsAgo().toISOString(), required: true, validationRegex: DATE_REGEX, validationMessage: 'Required, must be valid age.' }),
    new InputRangeField({title: 'Walk Level', field: 'walkLevel', required: true, minValue: 1, maxValue: 10, type: InputType.RANGE_SLIDER, validationRegex: new RegExp(/[0-9]+/), validationMessage: 'Required, between 1-10.'}),
    new InputField({title: 'Profile Image', field: 'image', type: InputType.TEXT, validationRegex: new RegExp(/^.{5,2000}$/), validationMessage: 'Invalid URI, Max 2000 characters'}),
    new InputField({title: 'Profile Notes', field: 'notes', type: InputType.PARAGRAPH, validationRegex: new RegExp(/^.{0,3000}$/), validationMessage: 'Max 3000 characters.'}),
];

export const SIGNUP_PROFILE_FIELDS_USER:InputField[] = [
    new InputField({title: 'First Name', field: 'firstName', type: InputType.TEXT, required: true, validationRegex: new RegExp(/^.{1,30}$/), validationMessage: 'Required, max 30 characters.' }),
    new InputField({title: 'Last Name', field: 'lastName', type: InputType.TEXT, required: true, validationRegex: new RegExp(/^.{1,30}$/), validationMessage: 'Required, max 30 characters.' }),
    new InputField({title: 'Public Name', field: 'displayName', type: InputType.TEXT, unique: true, validationRegex: new RegExp(/^[a-z][a-z0-9_-]{3,13}[a-z0-9]$/), validationMessage: 'Unique, start/end with letter/numbers, 5-15 chars, lowercase, numbers, dashes, underscores.' }),
    new InputField({title: 'Email Address', field: 'email', type: InputType.EMAIL, unique: true,  validationRegex: EMAIL_REGEX, validationMessage: 'Required, invalid email format.' }),
    new InputField({title: 'Password', field: 'password', type: InputType.PASSWORD, required: true, validationRegex: new RegExp(/^.{5,20}$/), validationMessage: 'Required, 5-20 characters.' }),
    new InputField({title: 'Verify Password', field: 'passwordVerify', type: InputType.PASSWORD, required: true, validationRegex: new RegExp(/.{5,20}/), validationMessage: 'Required, must match password field.' }),
    new InputField({title: 'Postal Code', field: 'postalCode', required: true, validationRegex: new RegExp(/^.{5,15}$/), validationMessage: 'Required, 5-15 characters.' }),
    new InputSelectionField({title: 'Gender', field: 'gender', type: InputType.SELECT_LIST, required: true, selectOptionList: Object.values(GenderEnum)}),
    new InputField({title: 'Date of Birth', field: 'dateOfBirth', type: InputType.DATE, value: getDateYearsAgo().toISOString(), required: true, validationRegex: DATE_REGEX, validationMessage: 'Required, must be valid age.' }),
];

//SIGNUP all other roles
export const SIGNUP_PROFILE_FIELDS:InputField[] = [    
    new InputSelectionField({title: 'Account Type', field: 'userRoleTokenList', type: InputType.MULTI_SELECTION_LIST, required: false, selectOptionList: Object.values(RoleEnum), validationMessage: 'Authorization token is required.'}),
    ...SIGNUP_PROFILE_FIELDS_USER,
];

export const PARTNERSHIP_CONTRACT = (userName:string, partnerName:string):string => `I ${userName} promise to pray for ${partnerName} every day, as agreed upon in this contract, while ensuring our conversations remain private. This daily commitment remains in place until our partnership ends. By signing this agreement, I confirm my dedication to our prayer partnership and look forward to the positive impact it will have on both of us.`;
