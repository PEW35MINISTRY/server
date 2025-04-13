/***** ONLY DEPENDENCY: ./inputField - Define all other types locally *****/
import InputField, { InputSelectionField, InputType } from './inputField.mjs';

/***********************************************
*   PRAYER REQUEST FIELD CONFIGURATION FILE    *
* Sync across all repositories: server, portal *
************************************************/
export const DATE_REGEX = new RegExp(/^\d{4}-[01]\d-[0-3]\dT[0-2]\d:[0-5]\d:[0-5]\d\.\d+([+-][0-2]\d:[0-5]\d|Z)$/); //1970-01-01T00:00:00.013Z
    
/****************************************
*  PRAYER REQUEST TYPES AND DEPENDENCIES
*****************************************/
//Note: enums must have matching values to cast (string as Enum) or define (Enum[string]) equally

//List doesn't sync with database; stored as list of strings stringified as `tagListStringified`
export enum PrayerRequestTagEnum { 
    SELF = 'SELF',
    FAMILY = 'FAMILY',
    SCHOOL = 'SCHOOL',
    HEALING = 'HEALING',
    PRAISE = 'PRAISE',
    GLOBAL = 'GLOBAL'
}

export const PrayerRequestDurationsMap = new Map<string, string>([ //Used as InputSelectionField, must be strings
    ['2 Days', '2'],
    ['7 Days', '7'],
    ['14 Days', '14'],
    ['30 Days', '30'],
]);  

export const getDateDaysFuture = (days: number = 14):Date => {
    let date = new Date();
    date.setDate(date.getDate() + days);
    return date;
}

/*********************************************************************************
*   FIELD LISTS: CREATE | EDIT =>  Used for dynamic display 
**********************************************************************************/

export const CREATE_PRAYER_REQUEST_FIELDS:InputField[] = [
    new InputField({title: 'Topic', field: 'topic', required: true, type: InputType.TEXT, validationRegex: new RegExp(/^.{1,30}$/), validationMessage: 'Required, max 30 characters.' }),
    new InputField({title: 'Description', field: 'description', required: true, type: InputType.PARAGRAPH, validationRegex: new RegExp(/^.{0,200}$/), validationMessage: 'Max 200 characters.'}),
    new InputSelectionField({title: 'Category', field: 'tagList', type: InputType.MULTI_SELECTION_LIST, selectOptionList: Object.values(PrayerRequestTagEnum)}),
    new InputSelectionField({title: 'Duration', field: 'duration', required: true, type: InputType.SELECT_LIST, value: '7', selectOptionList:Array.from(PrayerRequestDurationsMap.values()), displayOptionList:Array.from(PrayerRequestDurationsMap.keys())}),
    new InputSelectionField({title: 'Remind Me', field: 'isOnGoing', value: 'false', type: InputType.SELECT_LIST, selectOptionList: ['true', 'false']}),
    new InputField({title: 'Send to Contacts', field: 'addUserRecipientIDList', hide: true, type: InputType.USER_ID_LIST, validationRegex: new RegExp(/[0-9]+/)}),
    new InputField({title: 'Send to Circles', field: 'addCircleRecipientIDList', hide: true, type: InputType.CIRCLE_ID_LIST, validationRegex: new RegExp(/[0-9]+/)}),
];

export const EDIT_PRAYER_REQUEST_FIELDS:InputField[] = [
    new InputSelectionField({title: 'Status', field: 'isResolved', value: 'Active', type: InputType.SELECT_LIST, selectOptionList: ['true', 'false'], displayOptionList: ['Active', 'Inactive']}),
    ...CREATE_PRAYER_REQUEST_FIELDS,
    new InputSelectionField({title: 'Remind Me', field: 'isOnGoing', value: 'false', type: InputType.SELECT_LIST, selectOptionList: ['true', 'false']}),
    new InputField({title: 'Send to Contacts', field: 'addUserRecipientIDList', hide: true, type: InputType.USER_ID_LIST, validationRegex: new RegExp(/[0-9]+/)}),
    new InputField({title: 'Remove Contacts', field: 'removeUserRecipientIDList', hide: true, type: InputType.USER_ID_LIST, validationRegex: new RegExp(/[0-9]+/)}),
    new InputField({title: 'Send to Circles', field: 'addCircleRecipientIDList', hide: true, type: InputType.CIRCLE_ID_LIST, validationRegex: new RegExp(/[0-9]+/)}),
    new InputField({title: 'Remove Circles', field: 'removeCircleRecipientIDList', hide: true, type: InputType.CIRCLE_ID_LIST, validationRegex: new RegExp(/[0-9]+/)})
];

export const PRAYER_REQUEST_FIELDS_ADMIN:InputField[] = [
    ...EDIT_PRAYER_REQUEST_FIELDS,
    new InputField({title: 'Expiration', field: 'expirationDate', required: true, type: InputType.DATE, value: getDateDaysFuture().toISOString(), validationRegex: DATE_REGEX, validationMessage: 'Required, must be future date.' }),
    new InputField({title: 'Prayer Count', field: 'prayerCount', type: InputType.NUMBER, validationRegex: new RegExp(/^[0-9]+$/)})
];

export const PRAYER_REQUEST_COMMENT_FIELDS:InputField[] = [
    new InputField({title: 'Comment', field: 'message',  required: true, type: InputType.PARAGRAPH, validationRegex: new RegExp(/^.{1,200}$/), validationMessage: 'Required, 1-200 characters.' }),
];
