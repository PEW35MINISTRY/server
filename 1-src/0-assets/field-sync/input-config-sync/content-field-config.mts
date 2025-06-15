/***** ONLY DEPENDENCY: ./inputField - Define all other types locally *****/
import InputField, { InputRangeField, InputSelectionField, InputType, makeDisplayText, PLAIN_TEXT_REGEX } from './inputField.mjs';

/*******************************************************
*      CONTENT ARCHIVE FIELD CONFIGURATION FILE
* Sync across all repositories: server, portal
*******************************************************/
    
/***************************************
*    PROFILE TYPES AND DEPENDENCIES
****************************************/
//Note: enums must have matching values to cast (string as Enum) or define (Enum[string]) equally

export enum ContentTypeEnum {
    VIDEO = 'VIDEO',
    ARTICLE = 'ARTICLE',
    IMAGE = 'IMAGE',
    POST = 'POST',
    CUSTOM = 'CUSTOM'
}

export enum ContentSourceEnum {
    YOUTUBE = 'YOUTUBE',
    GOT_QUESTIONS = 'GOT_QUESTIONS',
    BIBLE_PROJECT = 'BIBLE_PROJECT',
    THROUGH_THE_WORD = 'THROUGH_THE_WORD',
    FACEBOOK = 'FACEBOOK',
    INSTAGRAM = 'INSTAGRAM',
    PINTEREST = 'PINTEREST',
    TIKTOK = 'TIKTOK',
    X_TWITTER = 'X_TWITTER',
    CUSTOM = 'CUSTOM'
}

export const MOBILE_CONTENT_REQUIRE_THUMBNAIL:boolean = true;
export const MOBILE_CONTENT_SUPPORTED_SOURCES:ContentSourceEnum[] = [
    ContentSourceEnum.YOUTUBE, 
    ContentSourceEnum.GOT_QUESTIONS, 
    ContentSourceEnum.BIBLE_PROJECT,
    ContentSourceEnum.THROUGH_THE_WORD
];

export const MOBILE_CONTENT_SUPPORTED_TYPES_MAP:Map<ContentSourceEnum, ContentTypeEnum[]> = new Map([
    [ContentSourceEnum.YOUTUBE, [ContentTypeEnum.VIDEO]],
    [ContentSourceEnum.GOT_QUESTIONS, [ContentTypeEnum.ARTICLE]],
    [ContentSourceEnum.BIBLE_PROJECT, [ContentTypeEnum.ARTICLE]],
    [ContentSourceEnum.THROUGH_THE_WORD, [ContentTypeEnum.ARTICLE]]
]);

//TS can't extend enum, but object operates similar
export const ContentSearchFilterEnum = {
    ...ContentSourceEnum,
    NONE: 'NONE',
    MOBILE: 'MOBILE',
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

/******************
* UTILITY METHODS *
*******************/
export const extractYouTubeVideoId = (url:string):string|undefined => {
    const match = url.match(/(?:https?:\/\/)?(?:www\.)?(?:youtube\.com\/(?:[^\/\n\s]+\/\S+\/|(?:v|e(?:mbed)?)\/|\S*?[?&]v=)|youtu\.be\/)([a-zA-Z0-9_-]{11})/);
    return match ? match[1] : undefined;
  };

/*********************************************************************************
*   FIELD LISTS: CREATE | EDIT =>  Used for dynamic display 
**********************************************************************************/

export const EDIT_CONTENT_FIELDS:InputField[] = [
    new InputField({title: 'Embed URL', field: 'url', type: InputType.TEXT, required: true, unique: true, length:{min: 1, max: 2000} }),
    new InputSelectionField({title: 'Source', field: 'source', customField: 'customSource', type: InputType.SELECT_LIST, required: true, selectOptionList: Object.values(ContentSourceEnum), validationRegex: new RegExp(/^[a-zA-Z0-9_ ]{3,50}$/), validationMessage: 'Custom Field has invalid format.'}),
    new InputSelectionField({title: 'Type', field: 'type', customField: 'customType', type: InputType.SELECT_LIST, required: true, selectOptionList: Object.values(ContentTypeEnum), validationRegex: new RegExp(/^[a-zA-Z0-9_ ]{3,50}$/), validationMessage: 'Custom Field has invalid format.'}),
    new InputField({title: 'Thumbnail URL', field: 'image', type: InputType.TEXT, length:{min: 1, max: 2000} }),
    new InputField({title: 'Title', field: 'title', type: InputType.TEXT, required: true, length:{min: 1, max: 50}, validationRegex:PLAIN_TEXT_REGEX }),
    new InputField({title: 'Description', field: 'description',  type: InputType.PARAGRAPH, length:{min: 0, max: 300}, validationRegex:PLAIN_TEXT_REGEX }),
    new InputField({title: 'Topic / Keywords', field: 'keywordList', type: InputType.CUSTOM_STRING_LIST, length:{min: 3, max: 15}, validationRegex:PLAIN_TEXT_REGEX }),
    new InputSelectionField({title: 'Gender', field: 'gender', type: InputType.SELECT_LIST, required: true, selectOptionList: Object.values(GenderSelectionEnum)}),
    new InputRangeField({title: 'Age', field: 'minimumAge', maxField: 'maximumAge', minValue: 13, maxValue: 21, type: InputType.RANGE_SLIDER, required: true}),
    new InputRangeField({title: 'Walk Level', field: 'minimumWalkLevel', maxField: 'maximumWalkLevel', minValue: 1, maxValue: 10, type: InputType.RANGE_SLIDER, required: true}),
    new InputField({title: 'Like Count', field: 'likeCount', type: InputType.NUMBER})
];

//Indicate Mobile Supported Sources | Assumes selectOptionList and displayOptionList indexes are synced
const sourceField:InputSelectionField = EDIT_CONTENT_FIELDS.find((field:InputField) => field.field === 'source') as InputSelectionField;
sourceField.selectOptionList.forEach((source:string, index:number) => {
    if(MOBILE_CONTENT_SUPPORTED_SOURCES.includes(ContentSourceEnum[source as keyof typeof ContentSourceEnum]))
        sourceField.displayOptionList[index] = `${makeDisplayText(source)} (mobile)`;
});

export const EDIT_CONTENT_FIELDS_ADMIN:InputField[] = [    
    ...EDIT_CONTENT_FIELDS,
    new InputField({title: 'Recorder ID', field: 'recorderID', type: InputType.NUMBER }),
    new InputField({title: 'Notes', field: 'notes', type: InputType.PARAGRAPH, length:{min: 0, max: 3000}, validationRegex:PLAIN_TEXT_REGEX }),
];
