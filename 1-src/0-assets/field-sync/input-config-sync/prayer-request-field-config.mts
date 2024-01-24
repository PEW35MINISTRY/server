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

//List doesn't sync with database; stored as list of strings stringified as `tagsStringified`
export enum PrayerRequestTagEnum { 
    SELF = 'SELF',
    FAMILY = 'FAMILY',
    SCHOOL = 'SCHOOL',
    HEALING = 'HEALING',
    PRAISE = 'PRAISE',
    GLOBAL = 'GLOBAL'
}

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
    new InputSelectionField({title: 'Long Term', field: 'isOnGoing', value: 'false', type: InputType.SELECT_LIST, selectOptionList: ['true', 'false']}),
    new InputSelectionField({title: 'Category', field: 'tagList', type: InputType.MULTI_SELECTION_LIST, selectOptionList: Object.values(PrayerRequestTagEnum)}),
    new InputField({title: 'Relevance', field: 'expirationDate', required: true, type: InputType.DATE, value: getDateDaysFuture().toISOString(), validationRegex: DATE_REGEX, validationMessage: 'Required, must be future date.' }),
    new InputField({title: 'Send to Contacts', field: 'addUserRecipientIDList', hide: true, type: InputType.USER_ID_LIST, validationRegex: new RegExp(/[0-9]+/)}),
    new InputField({title: 'Send to Circles', field: 'addCircleRecipientIDList', hide: true, type: InputType.CIRCLE_ID_LIST, validationRegex: new RegExp(/[0-9]+/)}),
];

export const EDIT_PRAYER_REQUEST_FIELDS:InputField[] = [
    new InputSelectionField({title: 'Resolved', field: 'isResolved', value: 'false', type: InputType.SELECT_LIST, selectOptionList: ['true', 'false']}),
    ...CREATE_PRAYER_REQUEST_FIELDS,
    new InputField({title: 'Send to Contacts', field: 'addUserRecipientIDList', hide: true, type: InputType.USER_ID_LIST, validationRegex: new RegExp(/[0-9]+/)}),
    new InputField({title: 'Remove Contacts', field: 'removeUserRecipientIDList', hide: true, type: InputType.USER_ID_LIST, validationRegex: new RegExp(/[0-9]+/)}),
    new InputField({title: 'Send to Circles', field: 'addCircleRecipientIDList', hide: true, type: InputType.CIRCLE_ID_LIST, validationRegex: new RegExp(/[0-9]+/)}),
    new InputField({title: 'Remove Circles', field: 'removeCircleRecipientIDList', hide: true, type: InputType.CIRCLE_ID_LIST, validationRegex: new RegExp(/[0-9]+/)})
];

export const PRAYER_REQUEST_FIELDS_ADMIN:InputField[] = [
    ...EDIT_PRAYER_REQUEST_FIELDS,
    new InputField({title: 'Prayer Count', field: 'prayerCount', type: InputType.NUMBER, validationRegex: new RegExp(/^[0-9]+$/)})
];

export const PRAYER_REQUEST_COMMENT_FIELDS:InputField[] = [
    new InputField({title: 'Comment', field: 'message',  required: true, type: InputType.PARAGRAPH, validationRegex: new RegExp(/^.{10,200}$/), validationMessage: 'Required, 10-200 characters.' }),
];
