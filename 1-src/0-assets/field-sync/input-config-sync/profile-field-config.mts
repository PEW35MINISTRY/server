/***** ONLY DEPENDENCY: ./inputField - Define all other types locally *****/
import InputField, { ENVIRONMENT_TYPE, InputType, InputRangeField, InputSelectionField, PLAIN_TEXT_REGEX, DATE_REGEX } from './inputField.mjs';

/*******************************************************
*        PROFILE FIELD CONFIGURATION FILE
* Sync across all repositories: server, portal, mobile
*******************************************************/

export const EMAIL_REGEX = new RegExp(/^(([^<>()\[\]\.,;:\s@\"]+(\.[^<>()\[\]\.,;:\s@\"]+)*)|(\".+\"))@(([^<>()\.,;\s@\"]+\.{0,1})+([^<>()\.,;:\s@\"]{2,}|[\d\.]+))$/);

export const PASSWORD_REGEX_DEV = new RegExp(/^.{5,}$/);
export const PASSWORD_VALIDATION_MESSAGE_DEV = "Minimum 5 characters";

export const PASSWORD_REGEX_PROD = new RegExp(/^(?=.*?[A-Z])(?=.*?[a-z])(?=.*?[0-9])(?=.*?[#?!@$%^&*-_]).{8,}$/);
export const PASSWORD_VALIDATION_MESSAGE_PROD = "Include: one uppercase, lowercase, digit, special character (#?!@$%^&*-_), 8+ in length"


/***************************************
*    PROFILE TYPES AND DEPENDENCIES
****************************************/
//Note: enums must have matching values to cast (string as Enum) or define (Enum[string]) equally
export enum ModelSourceEnvironmentEnum { //Allowed Interactions:
    DEVELOPMENT = 'DEVELOPMENT',         //DEVELOPMENT, MOCK
    MOCK = 'MOCK',                       //DEVELOPMENT, MOCK, INTERNAL
    INTERNAL = 'INTERNAL',               //MOCK, INTERNAL
    PRODUCTION = 'PRODUCTION'            //PRODUCTION
}

export enum GenderEnum {
    MALE = 'MALE',
    FEMALE = 'FEMALE'
}

export enum RoleEnum {
    REPORTED = 'REPORTED',                     // Restricted account pending administrative review for flagged behavior.
    INACTIVE = 'INACTIVE',                     // Permanently or indefinitely disabled account with no app access.
    DEMO_USER = 'DEMO_USER',                   // Temporary trial user with limited access.
    USER = 'USER',                             // Standard user role with access to mobile app features only.
    TEST_USER = 'TEST_USER',                   // Internal role for QA to stay separate from production users.
    CIRCLE_LEADER = 'CIRCLE_LEADER',           // Can create and manage small user groups (circles), including member approvals.
    CIRCLE_MANAGER = 'CIRCLE_MANAGER',         // Can create circles and manage profiles of users within their circles.
    CONTENT_APPROVER = 'CONTENT_APPROVER',     // Access to add content hosted on the application.
    DEVELOPER = 'DEVELOPER',                   // Full access to features; but not user data.
    ADMIN = 'ADMIN'                            // All access and privileges.
}

export const GENERAL_USER_ROLES:RoleEnum[] = [RoleEnum.USER, RoleEnum.TEST_USER, RoleEnum.DEMO_USER];

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

export const getDateYearsAgo = (years:number):Date => {
    let date = new Date();
    date.setFullYear(date.getFullYear() - years);
    return date;
}

export const walkLevelMultiplier:number = 2; //Database range 1-10

export const walkLevelOptions:Map<number, [string, string]> = new Map<number, [string, string]>([
    [5, ['😊', 'Deeper and Meaningful']],
    [4, ['😃', 'Growing and Improving']],
    [3, ['🤓', 'Interested and Learning']],
    [2, ['🤔', 'Curious and Uncertain']],
    [1, ['😟', 'Distant and Disconnected']]
]);


//HTML date input supports: 'YYYY-MM-DD'
export const getShortDate = (dateISO:string):string => dateISO.split('T')[0];
export const getDOBMinDate = (role:RoleEnum = RoleEnum.USER):Date => getDateYearsAgo(100); //Oldest
export const getDOBMaxDate = (role:RoleEnum = RoleEnum.USER):Date => [RoleEnum.USER, RoleEnum.TEST_USER, RoleEnum.DEMO_USER].includes(role) ? getDateYearsAgo(13) : getDateYearsAgo(18); //Youngest

/*****************************************
*   FIELD LISTS: LOGIN | SIGNUP | EDIT
* Used for dynamic display and privileges
******************************************/

export const LOGIN_PROFILE_FIELDS:InputField[] = [
    new InputField({title: 'Email Address', field: 'email', type: InputType.EMAIL, required: true, validationRegex: EMAIL_REGEX, validationMessage: 'Incomplete Format' }),
    new InputField({title: 'Password', field: 'password', type: InputType.PASSWORD, required: true, validationMessage: 'Incomplete Format', environmentList:[ENVIRONMENT_TYPE.LOCAL, ENVIRONMENT_TYPE.DEVELOPMENT, ENVIRONMENT_TYPE.PRODUCTION] }),
];

//Note: extending list forces the order, may need a sortID or duplicating for now
export const EDIT_PROFILE_FIELDS:InputField[] = [
    new InputField({title: 'First Name', field: 'firstName', type: InputType.TEXT, required: true, length:{min:1, max:30}, validationRegex:PLAIN_TEXT_REGEX }),
    new InputField({title: 'Last Name', field: 'lastName', type: InputType.TEXT, required: true, length:{min:1, max:30}, validationRegex:PLAIN_TEXT_REGEX }),
    new InputField({title: 'Public Name', field: 'displayName', type: InputType.TEXT, required: true, unique: true, length:{min:5, max:15}, validationRegex: PLAIN_TEXT_REGEX }),
    new InputField({title: 'Password', field: 'password', type: InputType.PASSWORD, required: false, validationRegex: PASSWORD_REGEX_DEV, validationMessage: PASSWORD_VALIDATION_MESSAGE_DEV, environmentList:[ENVIRONMENT_TYPE.LOCAL, ENVIRONMENT_TYPE.DEVELOPMENT] }),
    new InputField({title: 'Password', field: 'password', type: InputType.PASSWORD, required: false, validationRegex: PASSWORD_REGEX_PROD, validationMessage: PASSWORD_VALIDATION_MESSAGE_PROD, environmentList:[ENVIRONMENT_TYPE.PRODUCTION] }),
    new InputField({title: 'Verify Password', field: 'passwordVerify', type: InputType.PASSWORD, required: false, validationRegex: PASSWORD_REGEX_DEV, validationMessage: 'Must match password field.', environmentList:[ENVIRONMENT_TYPE.LOCAL, ENVIRONMENT_TYPE.DEVELOPMENT] }),
    new InputField({title: 'Verify Password', field: 'passwordVerify', type: InputType.PASSWORD, required: false, validationRegex: PASSWORD_REGEX_PROD, validationMessage: 'Must match password field.', environmentList:[ENVIRONMENT_TYPE.PRODUCTION] }),
    new InputField({title: 'Postal Code', field: 'postalCode', type: InputType.TEXT, required: true, length:{min:5, max:15}, validationRegex:PLAIN_TEXT_REGEX}),
];

export const EDIT_PROFILE_FIELDS_ADMIN:InputField[] = [    
    new InputSelectionField({title: 'Account Type', field: 'userRoleTokenList', type: InputType.CUSTOM, selectOptionList: Object.values(RoleEnum) }),
    new InputSelectionField({title: 'Source Environment', field: 'modelSourceEnvironment', required: true, type: InputType.SELECT_LIST, selectOptionList: Object.values(ModelSourceEnvironmentEnum), environmentList:[ENVIRONMENT_TYPE.DEVELOPMENT]}),
    new InputField({title: 'Email Address', field: 'email', type: InputType.EMAIL, required: true, unique: true,  validationRegex: EMAIL_REGEX }),
    ...EDIT_PROFILE_FIELDS,
    new InputSelectionField({title: 'Gender', field: 'gender', type: InputType.SELECT_LIST, required: true, selectOptionList: Object.values(GenderEnum)}),
    new InputField({title: 'Date of Birth', field: 'dateOfBirth', type: InputType.DATE, required: true, value: getDOBMaxDate(RoleEnum.USER).toISOString(), validationRegex: DATE_REGEX, validationMessage: 'Must be age 13 or older.'  }),
    new InputRangeField({title: 'Walk Level', field: 'walkLevel', required: true, minValue: 1, maxValue: 10, type: InputType.RANGE_SLIDER }),
    new InputRangeField({title: 'Max Partners', field: 'maxPartners', required: true, minValue: 0, maxValue: 10, type: InputType.RANGE_SLIDER}),
    new InputField({title: 'Image URI', field: 'image', type: InputType.TEXT, length:{min:5, max:2000}}),
    new InputField({title: 'Notes', field: 'notes', type: InputType.PARAGRAPH, length:{min:0, max:3000}}),
];

export const SIGNUP_PROFILE_FIELDS_USER:InputField[] = [
    new InputField({title: 'First Name', field: 'firstName', type: InputType.TEXT, required: true, length:{min:1, max:30} }),
    new InputField({title: 'Last Name', field: 'lastName', type: InputType.TEXT, required: true, length:{min:1, max:30} }),
    new InputField({title: 'Public Name', field: 'displayName', type: InputType.TEXT, required: true, unique: true, length:{min:5, max:15}, validationRegex: PLAIN_TEXT_REGEX }),
    new InputField({title: 'Email Address', field: 'email', type: InputType.EMAIL, required: true, unique: true,  validationRegex: EMAIL_REGEX }),
    new InputField({title: 'Password', field: 'password', type: InputType.PASSWORD, required: true, validationRegex: PASSWORD_REGEX_DEV, validationMessage: PASSWORD_VALIDATION_MESSAGE_DEV, environmentList:[ENVIRONMENT_TYPE.LOCAL, ENVIRONMENT_TYPE.DEVELOPMENT] }),
    new InputField({title: 'Password', field: 'password', type: InputType.PASSWORD, required: true, validationRegex: PASSWORD_REGEX_PROD, validationMessage: PASSWORD_VALIDATION_MESSAGE_PROD, environmentList:[ENVIRONMENT_TYPE.PRODUCTION] }),
    new InputField({title: 'Verify Password', field: 'passwordVerify', type: InputType.PASSWORD, required: true, validationRegex: PASSWORD_REGEX_DEV, validationMessage: 'Must match password field.', environmentList:[ENVIRONMENT_TYPE.LOCAL, ENVIRONMENT_TYPE.DEVELOPMENT] }),
    new InputField({title: 'Verify Password', field: 'passwordVerify', type: InputType.PASSWORD, required: true, validationRegex: PASSWORD_REGEX_PROD, validationMessage: 'Must match password field.', environmentList:[ENVIRONMENT_TYPE.PRODUCTION] }),
    new InputField({title: 'Postal Code', field: 'postalCode', type: InputType.TEXT, required: true, length:{min:5, max:15}, validationRegex:PLAIN_TEXT_REGEX}),
    new InputSelectionField({title: 'Gender', field: 'gender', type: InputType.SELECT_LIST, required: true, selectOptionList: Object.values(GenderEnum)}),
    new InputField({title: 'Date of Birth', field: 'dateOfBirth', type: InputType.DATE, required: true, value: getDateYearsAgo(18).toISOString(), validationRegex: DATE_REGEX, validationMessage: 'Invalid Selection' }),
];

//SIGNUP all other roles
export const SIGNUP_PROFILE_FIELDS:InputField[] = [    
    new InputSelectionField({title: 'Account Type', field: 'userRoleTokenList', type: InputType.CUSTOM, selectOptionList: GENERAL_USER_ROLES }),
    ...SIGNUP_PROFILE_FIELDS_USER,
];

export const PARTNERSHIP_CONTRACT = (userName:string, partnerName:string):string => `I ${userName} promise to do my best to pray for ${partnerName} every day, as agreed upon in this contract, and to keep our conversations private. This daily commitment remains in place until our partnership ends. By signing this agreement, I confirm my dedication to our prayer partnership and look forward to the positive impact it will have on both of us.`;
