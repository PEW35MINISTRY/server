/***** ONLY DEPENDENCY: ./inputField - Define all other types locally *****/
import InputField, { DATE_REGEX, InputSelectionField, InputType, PLAIN_TEXT_REGEX } from './inputField.mjs';

/*******************************************************
*        CIRCLE FIELD CONFIGURATION FILE
* Sync across all repositories: server, portal
*******************************************************/
    
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

export enum CircleSearchRefineEnum {
    ALL = 'ALL',                     //default search all fields
    ID = 'ID',                       //circleID exact match
    MEMBER_ID = 'MEMBER_ID',         //Any relation or leader
    NAME = 'NAME',
    DESCRIPTION = 'DESCRIPTION',
    NAME_DESCRIPTION = 'NAME_DESCRIPTION',
    LEADER = 'LEADER',
    LOCATION = 'LOCATION'
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
    new InputField({title: 'Name', field: 'name',  required: true, type: InputType.TEXT, length:{min: 1, max: 100}, validationRegex:PLAIN_TEXT_REGEX }),
    new InputField({title: 'Description', field: 'description',  required: true, type: InputType.PARAGRAPH, length:{min: 1, max: 225} }),
    new InputField({title: 'Universal Invite Token', field: 'inviteToken', required: true, type: InputType.TEXT, length:{min: 5, max: 15}, validationRegex:/^[a-zA-Z0-9_-]+$/, validationMessage: 'Case-sensitive, no spaces.' }),
    new InputField({title: 'Postal Code', field: 'postalCode', required: true, type: InputType.TEXT, length:{min: 5, max: 15}, validationRegex:PLAIN_TEXT_REGEX }),
];

export const CIRCLE_FIELDS_ADMIN:InputField[] = [
    new InputField({title: 'Leader ID', field: 'leaderID', type: InputType.NUMBER,  required: true }),
    new InputSelectionField({title: 'Active Account', field: 'isActive', required: true, type: InputType.SELECT_LIST, selectOptionList: ['true', 'false']}),
    ...CIRCLE_FIELDS,
    new InputField({title: 'Image URI', field: 'image', type: InputType.TEXT, length:{min: 5, max: 2000}}),
    new InputField({title: 'Notes', field: 'notes', type: InputType.PARAGRAPH, length:{min: 0, max: 3000} }),
];

export const CIRCLE_ANNOUNCEMENT_FIELDS:InputField[] = [
    new InputField({title: 'Announcement', field: 'message',  required: true, type: InputType.TEXT, length:{min: 1, max: 100} }),
    new InputField({title: 'Display Date', field: 'startDate', type: InputType.DATE, value: getDateDaysFuture(0).toISOString(), required: true, validationRegex: DATE_REGEX }),
    new InputField({title: 'Expiration Date', field: 'endDate', type: InputType.DATE, value: getDateDaysFuture(14).toISOString(), required: true, validationRegex: DATE_REGEX }),
];