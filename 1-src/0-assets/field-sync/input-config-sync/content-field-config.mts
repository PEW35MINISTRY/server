/***** ONLY DEPENDENCY: ./inputField - Define all other types locally *****/
import InputField, { InputRangeField, InputSelectionField, InputType } from './inputField.mjs';

/*******************************************************
*      CONTENT ARCHIVE FIELD CONFIGURATION FILE
* Sync across all repositories: server, portal
*******************************************************/
    
/***************************************
*    PROFILE TYPES AND DEPENDENCIES
****************************************/
//Note: enums must have matching values to cast (string as Enum) or define (Enum[string]) equally


export enum ContentTypeEnum {
    POST = 'POST',
    ARTICLE = 'ARTICLE',
    VIDEO = 'VIDEO',
    IMAGE = 'IMAGE',
    CUSTOM = 'CUSTOM'
}

export enum ContentSourceEnum {
    YOUTUBE = 'YOUTUBE',
    FACEBOOK = 'FACEBOOK',
    INSTAGRAM = 'INSTAGRAM',
    PINTEREST = 'PINTEREST',
    TIKTOK = 'TIKTOK',
    X_TWITTER = 'X_TWITTER',
    GOT_QUESTIONS = 'GOT_QUESTIONS',
    BIBLE_PROJECT = 'BIBLE_PROJECT',
    THROUGH_THE_WORLD = 'THROUGH_THE_WORD',
    CUSTOM = 'CUSTOM'
}

export enum GenderSelectionEnum {
    BOTH = 'BOTH',
    MALE = 'MALE',
    FEMALE = 'FEMALE',
}

export enum ContentSearchRefineEnum {
    ALL = 'ALL',                     //default search all fields
    ID = 'ID',
    RECORDER_ID = 'RECORDER_ID',
    TYPE = 'TYPE',
    SOURCE = 'SOURCE',
    KEYWORD = 'KEYWORD',
    DESCRIPTION = 'DESCRIPTION',
    NOTES = 'NOTES'
}

/*********************************************************************************
*   FIELD LISTS: CREATE | EDIT =>  Used for dynamic display 
**********************************************************************************/

export const EDIT_CONTENT_FIELDS:InputField[] = [
    new InputField({title: 'Embed URL', field: 'url', type: InputType.TEXT, required: true, unique: true, validationRegex: new RegExp(/^.{1,2000}$/), validationMessage: 'Required, max 2000 characters.' }),
    new InputSelectionField({title: 'Type', field: 'type', customField: 'customType', type: InputType.SELECT_LIST, required: true, selectOptionList: Object.values(ContentTypeEnum), validationRegex: new RegExp(/^[a-zA-Z0-9_ ]{3,50}$/), validationMessage: 'Custom Field has invalid format.'}),
    new InputSelectionField({title: 'Source', field: 'source', customField: 'customSource', type: InputType.SELECT_LIST, required: true, selectOptionList: Object.values(ContentSourceEnum), validationRegex: new RegExp(/^[a-zA-Z0-9_ ]{3,50}$/), validationMessage: 'Custom Field has invalid format.'}),
    new InputField({title: 'Topic / Keywords', field: 'keywordList', type: InputType.CUSTOM_STRING_LIST, validationRegex: new RegExp(/^.{1,3}$/), validationMessage: 'Invalid, Min 3 characters.'}),
    new InputSelectionField({title: 'Gender', field: 'gender', type: InputType.SELECT_LIST, required: true, selectOptionList: Object.values(GenderSelectionEnum)}),
    new InputRangeField({title: 'Age', field: 'minimumAge', maxField: 'maximumAge', minValue: 13, maxValue: 21, type: InputType.RANGE_SLIDER, required: true, validationRegex: new RegExp(/[0-9]+/), validationMessage: 'Required, age between 13-21.'}),
    new InputRangeField({title: 'Walk Level', field: 'minimumWalkLevel', maxField: 'maximumWalkLevel', minValue: 1, maxValue: 10, type: InputType.RANGE_SLIDER, required: true, validationRegex: new RegExp(/[0-9]+/), validationMessage: 'Required, age between 1-10 and less than Maximum Walk Level.'}),
    new InputField({title: 'Description', field: 'description',  type: InputType.PARAGRAPH, validationRegex: new RegExp(/^.{0,200}$/), validationMessage: 'Max 300 characters.'})
];

export const EDIT_CONTENT_FIELDS_ADMIN:InputField[] = [    
    ...EDIT_CONTENT_FIELDS,
    new InputField({title: 'Recorder ID', field: 'recorderID', type: InputType.NUMBER, validationMessage: 'User is Required.' }),
    new InputField({title: 'Notes', field: 'notes', type: InputType.PARAGRAPH, validationRegex: new RegExp(/^.{0,3000}$/), validationMessage: 'Max 3000 characters.'}),
];

