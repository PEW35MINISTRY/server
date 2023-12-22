/***** ONLY DEPENDENCY: ./inputField - Define all other types locally *****/
import InputField, { InputType } from './inputField.mjs';

/*******************************************************
*        PROFILE FIELD CONFIGURATION FILE
* Sync across all repositories: server, portal, mobile
*******************************************************/

export const URL_REGEX = new RegExp(/^(([^<>()\[\]\.,;:\s@\"]+(\.[^<>()\[\]\.,;:\s@\"]+)*)|(\".+\"))@(([^<>()\.,;\s@\"]+\.{0,1})+([^<>()\.,;:\s@\"]{2,}|[\d\.]+))$/);
    
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
    THROUGH_THE_WORLD = 'THROUGH_THE_WORLD',
    CUSTOM = 'CUSTOM'
}

export enum GenderSelectionEnum {
    BOTH = 'BOTH',
    MALE = 'MALE',
    FEMALE = 'FEMALE',
}

export enum ContentSearchFilterEnum {
    ID = 'ID',
    RECORDER_ID = 'RECORDER_ID',
    TYPE = 'TYPE',
    SOURCE = 'SOURCE',
    KEYWORD = 'KEYWORD',
    DESCRIPTION = 'DESCRIPTION',
    NOTES = 'NOTES',
    ALL = 'ALL'                      //default search all fields
}

/*********************************************************************************
*   FIELD LISTS: CREATE | EDIT =>  Used for dynamic display 
**********************************************************************************/

export const EDIT_CONTENT_FIELDS:InputField[] = [
    new InputField({title: 'Embed URL', field: 'url', type: InputType.TEXT, required: true, unique: true, validationRegex: new RegExp(/.{1,30}/), validationMessage: 'Required, max 30 characters.' }),
    new InputField({title: 'Type', field: 'type', customField: 'customType', type: InputType.SELECT_LIST, required: true, selectOptionList: Object.values(ContentTypeEnum)}),
    new InputField({title: 'Source', field: 'source', customField: 'customSource', type: InputType.SELECT_LIST, required: true, selectOptionList: Object.values(ContentSourceEnum)}),
    new InputField({title: 'Topic / Keywords', field: 'keywordList', type: InputType.CUSTOM_STRING_LIST}),
    new InputField({title: 'Description', field: 'description',  type: InputType.PARAGRAPH, validationRegex: new RegExp(/.{0,200}/), validationMessage: 'Max 300 characters.'}),
    new InputField({title: 'Gender', field: 'gender', type: InputType.SELECT_LIST, required: true, selectOptionList: Object.values(GenderSelectionEnum)}),
    new InputField({title: 'Minimum Age', field: 'minimumAge', type: InputType.NUMBER_SLIDER, required: true, validationRegex: new RegExp(/[0-9]+/), validationMessage: 'Required, age between 1-99 and less than Maximum Age.'}),
    new InputField({title: 'Maximum Age', field: 'maximumAge', type: InputType.NUMBER_SLIDER, required: true, validationRegex: new RegExp(/[0-9]+/), validationMessage: 'Required, age between 1-99 and greater than Minium Age.'}),
    new InputField({title: 'Minimum Walk Level', field: 'minimumWalkLevel', type: InputType.NUMBER_SLIDER, required: true, validationRegex: new RegExp(/[0-9]+/), validationMessage: 'Required, age between 1-10 and less than Maximum Walk Level.'}),
    new InputField({title: 'Maximum Walk Level', field: 'maximumWalkLevel', type: InputType.NUMBER_SLIDER, required: true, validationRegex: new RegExp(/[0-9]+/), validationMessage: 'Required, age between 1-10 and greater than Minium Walk Level.'})
];

export const EDIT_CONTENT_FIELDS_ADMIN:InputField[] = [    
    ...EDIT_CONTENT_FIELDS,
    new InputField({title: 'Recorder ID', field: 'recorderID', type: InputType.NUMBER, required: true, validationMessage: 'User is Required.' }),
    new InputField({title: 'Notes', field: 'notes', type: InputType.PARAGRAPH, validationRegex: new RegExp(/.{0,3000}/), validationMessage: 'Max 3000 characters.'}),
];

