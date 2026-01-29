/***** ONLY DEPENDENCY: ./inputField - Define all other types locally *****/
import InputField, { DATE_REGEX, InputSelectionField, InputType } from './inputField.mjs';

/***********************************************
*   PRAYER REQUEST FIELD CONFIGURATION FILE    *
* Sync across all repositories: server, portal *
************************************************/
    
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

export const DEFAULT_PRAYER_REQUEST_EXPIRATION_DAYS:number = 14;

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
    new InputField({title: 'Topic', field: 'topic', required: true, type: InputType.TEXT, length:{min:1, max:35} }),
    new InputSelectionField({title: 'Category', field: 'tagList', type: InputType.MULTI_SELECTION_LIST, selectOptionList: Object.values(PrayerRequestTagEnum)}),
    new InputField({title: 'Prayer', field: 'description', required: true, type: InputType.PARAGRAPH, length:{min:0, max:255}}),
    new InputField({title: 'Send to Contacts', field: 'addUserRecipientIDList', hide: true, type: InputType.USER_ID_LIST}),
    new InputField({title: 'Send to Circles', field: 'addCircleRecipientIDList', hide: true, type: InputType.CIRCLE_ID_LIST}),
];

export const EDIT_PRAYER_REQUEST_FIELDS:InputField[] = [
    new InputField({title: 'Topic', field: 'topic', required: true, type: InputType.TEXT, length:{min:1, max:35} }),
    new InputSelectionField({title: 'Category', field: 'tagList', type: InputType.MULTI_SELECTION_LIST, selectOptionList: Object.values(PrayerRequestTagEnum)}),
    new InputField({title: 'Prayer', field: 'description', required: true, type: InputType.PARAGRAPH, length:{min:0, max:255}}),
    new InputField({title: 'Send to Contacts', field: 'addUserRecipientIDList', hide: true, type: InputType.USER_ID_LIST}),
    new InputField({title: 'Remove Contacts', field: 'removeUserRecipientIDList', hide: true, type: InputType.USER_ID_LIST}),
    new InputField({title: 'Send to Circles', field: 'addCircleRecipientIDList', hide: true, type: InputType.CIRCLE_ID_LIST}),
    new InputField({title: 'Remove Circles', field: 'removeCircleRecipientIDList', hide: true, type: InputType.CIRCLE_ID_LIST})
];

export const PRAYER_REQUEST_FIELDS_ADMIN:InputField[] = [
    new InputField({title: 'Prayer Request ID', field: 'prayerRequestID', type: InputType.READ_ONLY }),
    new InputField({title: 'Created', field: 'createdDT', type: InputType.READ_ONLY }),
    new InputField({title: 'Last Modified', field: 'modifiedDT', type: InputType.READ_ONLY }), 
    new InputSelectionField({title: 'Status', field: 'isResolved', value: 'false', type: InputType.SELECT_LIST, selectOptionList: ['true', 'false'], displayOptionList: ['Inactive', 'Active']}),
    ...EDIT_PRAYER_REQUEST_FIELDS,
    new InputSelectionField({title: 'Remind Me', field: 'isOnGoing', value: 'false', type: InputType.SELECT_LIST, selectOptionList: ['true', 'false'], displayOptionList: ['Yes', 'No']}),
    new InputField({title: 'Expiration Date', field: 'expirationDate', type: InputType.DATE, value: getDateDaysFuture(DEFAULT_PRAYER_REQUEST_EXPIRATION_DAYS).toISOString(), validationRegex: DATE_REGEX, validationMessage: 'Must be future date.' }),
];

export const PRAYER_REQUEST_COMMENT_FIELDS:InputField[] = [
    new InputField({title: 'Comment', field: 'message',  required: true, type: InputType.PARAGRAPH, length:{min:1, max:255} }),
];
