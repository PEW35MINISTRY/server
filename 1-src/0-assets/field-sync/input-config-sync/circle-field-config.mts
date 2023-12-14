/***** ONLY DEPENDENCY: ./inputField - Define all other types locally *****/
import InputField, { InputType } from './inputField.mjs';

/*******************************************************
*        CIRCLE FIELD CONFIGURATION FILE
* Sync across all repositories: server, portal
*******************************************************/
export const DATE_REGEX = new RegExp(/^\d{4}-[01]\d-[0-3]\dT[0-2]\d:[0-5]\d:[0-5]\d\.\d+([+-][0-2]\d:[0-5]\d|Z)$/); //1970-01-01T00:00:00.013Z
    
/***************************************
*    CIRCLE TYPES AND DEPENDENCIES
****************************************/
//Note: enums must have matching values to cast (string as Enum) or define (Enum[string]) equally
//Extends: DATABASE_CIRCLE_STATUS_ENUM
export enum CircleStatusEnum {
    LEADER = 'LEADER',
    MEMBER = 'MEMBER',
    INVITE = 'INVITE',
    REQUEST = 'REQUEST',
    NON_MEMBER = 'NON_MEMBER',
    CONNECTED = 'CONNECTED',          //MEMBER && INVITE && REQUEST
    AVAILABLE = 'AVAILABLE',          //INVITE && NON_MEMBER
    NONE = 'NONE'                     //skip filtering
}

export enum CircleSearchFilterEnum {
    ID = 'ID',                       //circleID exact match
    NAME = 'NAME',
    DESCRIPTION = 'DESCRIPTION',
    NAME_DESCRIPTION = 'NAME_DESCRIPTION',
    LEADER = 'LEADER',
    LOCATION = 'LOCATION',
    ALL = 'ALL'                      //default search all fields
}

export const getDateDaysFuture = (days: number = 14):Date => {
    let date = new Date();
    date.setDate(date.getDate() + days);
    return date;
}

/*********************************************************************************
*   FIELD LISTS: CREATE | EDIT =>  Used for dynamic display 
* Note: circle properties only, membership and invites handled in separate routes
**********************************************************************************/

export const CIRCLE_FIELDS:InputField[] = [
    new InputField({title: 'Name', field: 'name',  required: true, type: InputType.TEXT, validationRegex: new RegExp(/.{1,30}/), validationMessage: 'Required, max 30 characters.' }),
    new InputField({title: 'Description', field: 'description',  required: true, type: InputType.PARAGRAPH, validationRegex: new RegExp(/.{0,200}/), validationMessage: 'Max 200 characters.'}),
    new InputField({title: 'Universal Invite Token', field: 'inviteToken', required: true, type: InputType.TEXT, validationRegex: new RegExp(/.{5,15}/), validationMessage: 'Required, case-sensitive, 5-15 characters.' }),
    new InputField({title: 'Postal Code', field: 'postalCode', required: true, type: InputType.TEXT, validationRegex: new RegExp(/.{5,15}/), validationMessage: 'Required, 5-15 characters.' }),
];

export const CIRCLE_FIELDS_ADMIN:InputField[] = [
    new InputField({title: 'Leader ID', field: 'leaderID', type: InputType.NUMBER, required: true, validationMessage: 'Leader is Required.' }),
    new InputField({title: 'Active Account', field: 'isActive', required: true, type: InputType.SELECT_LIST, selectOptionList: ['true', 'false']}),
    ...CIRCLE_FIELDS,
    new InputField({title: 'Circle Image', field: 'image', type: InputType.TEXT, validationRegex: new RegExp(/.{5,2000}/), validationMessage: 'Invalid URI, Max 2000 characters'}),
    new InputField({title: 'Circle Notes', field: 'notes', type: InputType.PARAGRAPH, validationRegex: new RegExp(/.{0,3000}/), validationMessage: 'Max 3000 characters.'}),
];

export const CIRCLE_ANNOUNCEMENT_FIELDS:InputField[] = [
    new InputField({title: 'Announcement', field: 'message',  required: true, type: InputType.TEXT, validationRegex: new RegExp(/.{1,100}/), validationMessage: 'Required, max 100 characters.' }),
    new InputField({title: 'Display Date', field: 'startDate', type: InputType.DATE, value: getDateDaysFuture(0).toISOString(), required: true, validationRegex: DATE_REGEX, validationMessage: 'Required, must be valid age.' }),
    new InputField({title: 'Expiration Date', field: 'endDate', type: InputType.DATE, value: getDateDaysFuture(14).toISOString(), required: true, validationRegex: DATE_REGEX, validationMessage: 'Required, must be valid age.' }),
];