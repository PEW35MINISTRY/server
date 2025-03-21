import { ContentListItem, ContentResponseBody } from '../../0-assets/field-sync/api-type-sync/content-types.mjs';
import { ProfileListItem } from '../../0-assets/field-sync/api-type-sync/profile-types.mjs';
import { ContentSourceEnum, ContentTypeEnum, GenderSelectionEnum } from '../../0-assets/field-sync/input-config-sync/content-field-config.mjs';
import InputField from '../../0-assets/field-sync/input-config-sync/inputField.mjs';
import { JwtClientRequest } from '../../1-api/2-auth/auth-types.mjs';
import { Exception } from '../../1-api/api-types.mjs';
import {  CONTENT_TABLE_COLUMNS, DATABASE_CONTENT } from '../2-database/database-types.mjs';
import * as log from '../10-utilities/logging/log.mjs';
import BASE_MODEL from './baseModel.mjs';



export default class CONTENT_ARCHIVE extends BASE_MODEL<CONTENT_ARCHIVE, ContentListItem, ContentResponseBody> {
    static modelType = 'CONTENT_ARCHIVE';

    //Private static list of class property fields | (This is display-responses; NOT edit-access.)
    static DATABASE_IDENTIFYING_PROPERTY_LIST = [ 'recorderID', 'type', 'source', 'url' ]; //exclude: contentID, complex types, and lists
    static PROPERTY_LIST = [ 'contentID', 'recorderID', 'type', 'customType', 'source', 'customSource', 'url', 'keywordList', 'title', 'description', 'image', 'likeCount', 'gender', 'minimumAge', 'maximumAge', 'minimumWalkLevel', 'maximumWalkLevel', 'notes', 'recorderProfile' ];

    contentID: number = -1;
    recorderID: number; //user that recorded
    type: ContentTypeEnum;       //Note: Model has enum options, but not enforced in database
    customType: string|undefined;
    source: ContentSourceEnum;
    customSource: string|undefined;
    url: string;
    keywordList: string[];
    title?: string;
    description?: string;
    image?: string; //thumbnail link to S3 
    likeCount: number;
    gender: GenderSelectionEnum;
    minimumAge: number;
    maximumAge: number; 
    minimumWalkLevel: number;
    maximumWalkLevel: number; 
    notes?: string;

    //Query separate Tables
    recorderProfile?: ProfileListItem;

    //Used as error case or blank
    constructor(id:number = -1) {
        super(id);
    }

    override getNewInstance = (id:number = -1) => new CONTENT_ARCHIVE(id);

   /*******************
    * MODEL UTILITIES *
    *******************/  
    static contentArchiveParseKeywordList = (keywordListStringified:string):string[] => {
        const keywordList = [];
        if(keywordListStringified !== undefined && keywordListStringified !== null && keywordListStringified.length > 0) {        
            try {
                keywordList.push(...Array.from(JSON.parse(keywordListStringified)));
            } catch(error) {
                log.warn('Failed to parse CONTENT_ARCHIVE.keywordListStringified', keywordListStringified, error);
            }
        }
        return keywordList;
    }

    //Verify properties displayed
    static verifyDisplayProperties = (item:ContentListItem):boolean => 
           item.type && Object.keys(ContentTypeEnum).includes(item.type)
        && item.source && Object.keys(ContentSourceEnum).includes(item.source)
        && item.url && item.url.length > 5 //site URL
        && item.title && item.title.length > 5
        && item.description && item.description.length > 5
        && item.image && item.image.length > 5; //thumbnail URL
    
    verifyDisplayProperties = ():boolean => CONTENT_ARCHIVE.verifyDisplayProperties(this.toListItem());    


   /*********************
    * DEFINE PROPERTIES *
    *********************/
    override get modelType():string { return CONTENT_ARCHIVE.modelType; }
    override get IDProperty():string { return 'contentID'; }
 
    override get DATABASE_COLUMN_LIST():string[] { return CONTENT_TABLE_COLUMNS; }
    override get DATABASE_IDENTIFYING_PROPERTY_LIST():string[] { return CONTENT_ARCHIVE.DATABASE_IDENTIFYING_PROPERTY_LIST; }
    override get PROPERTY_LIST():string[] { return CONTENT_ARCHIVE.PROPERTY_LIST; }


   /**********************************
    * ADDITIONAL STATIC CONSTRUCTORS *
    **********************************/
    static constructByDatabase = (DB:DATABASE_CONTENT):CONTENT_ARCHIVE => 
        BASE_MODEL.constructByDatabaseUtility<CONTENT_ARCHIVE>({DB, newModel: new CONTENT_ARCHIVE(DB.contentID || -1), defaultModel: new CONTENT_ARCHIVE(),
         complexColumnMap: new Map([
            ['type', (DB:DATABASE_CONTENT, newContent:CONTENT_ARCHIVE) => {newContent.type = ContentTypeEnum[DB.type]}],
            ['source', (DB:DATABASE_CONTENT, newContent:CONTENT_ARCHIVE) => {newContent.source = ContentSourceEnum[DB.source]}],
            ['gender', (DB:DATABASE_CONTENT, newContent:CONTENT_ARCHIVE) => {newContent.gender = GenderSelectionEnum[DB.gender]}],
            ['keywordListStringified', (DB:DATABASE_CONTENT, newPrayerRequest:CONTENT_ARCHIVE) => {newPrayerRequest.keywordList = CONTENT_ARCHIVE.contentArchiveParseKeywordList(DB.keywordListStringified)}],
           ])});
 
     //Clone database model values only (not copying references for ListItems)
    static constructByClone = (contentArchive:CONTENT_ARCHIVE):CONTENT_ARCHIVE =>
        BASE_MODEL.constructByCloneUtility<CONTENT_ARCHIVE>({currentModel: contentArchive, newModel: new CONTENT_ARCHIVE(contentArchive.contentID || -1), defaultModel: new CONTENT_ARCHIVE(), propertyList: CONTENT_ARCHIVE.PROPERTY_LIST,
         complexPropertyMap: new Map([
            ['type', (currentContent:CONTENT_ARCHIVE, newContent:CONTENT_ARCHIVE) => {newContent.gender = ContentTypeEnum[currentContent.gender]}],
            ['source', (currentContent:CONTENT_ARCHIVE, newContent:CONTENT_ARCHIVE) => {newContent.gender = ContentSourceEnum[currentContent.gender]}],
            ['gender', (currentContent:CONTENT_ARCHIVE, newContent:CONTENT_ARCHIVE) => {newContent.gender = GenderSelectionEnum[currentContent.gender]}],
            ['keywordList', (currentPrayerRequest:CONTENT_ARCHIVE, newPrayerRequest:CONTENT_ARCHIVE) => {newPrayerRequest.keywordList = CONTENT_ARCHIVE.contentArchiveParseKeywordList(JSON.stringify(currentPrayerRequest.keywordList))}],
            ['recorderProfile', (currentPrayerRequest:CONTENT_ARCHIVE, newPrayerRequest:CONTENT_ARCHIVE) => { /* Skipping */ }],
         ])});
 
    override constructByClone = <CONTENT_ARCHIVE,>():CONTENT_ARCHIVE => CONTENT_ARCHIVE.constructByClone(this) as CONTENT_ARCHIVE;
 
    static constructByJson = async<CONTENT_ARCHIVE,>({jsonObj, fieldList}:{jsonObj:JwtClientRequest['body'], fieldList:InputField[]}):Promise<CONTENT_ARCHIVE|Exception> => 
         new CONTENT_ARCHIVE().populateFromJson({jsonObj, fieldList}) as CONTENT_ARCHIVE|Exception;


   /**********************
    * PROPERTY UTILITIES *
    **********************/  
    override getValidProperties = (properties:string[] = CONTENT_ARCHIVE.PROPERTY_LIST, includeUserID:boolean = true):Map<string, any> => {
        const complexFieldMap = new Map();
        complexFieldMap.set('tagListStringified', (model:CONTENT_ARCHIVE, baseModel:CONTENT_ARCHIVE) => JSON.stringify(model.keywordList));

        return BASE_MODEL.getUniquePropertiesUtility<CONTENT_ARCHIVE>({fieldList: properties, getModelProperty: (property) => property,
            model: this, baseModel: undefined, includeID: includeUserID, includeObjects: true, includeNull: false, complexFieldMap});
    }

    static getUniqueDatabaseProperties = (model:CONTENT_ARCHIVE, baseModel:CONTENT_ARCHIVE):Map<string, any> =>
        BASE_MODEL.getUniquePropertiesUtility<CONTENT_ARCHIVE>({fieldList: CONTENT_TABLE_COLUMNS, getModelProperty: (column) => model.getPropertyFromDatabaseColumn(column) ? column : undefined,
            model, baseModel, includeID: false, includeObjects: false, includeNull: true,
            complexFieldMap: new Map([
                ['tagListStringified', (model:CONTENT_ARCHIVE, baseModel:CONTENT_ARCHIVE) => { 
                    return (JSON.stringify(Array.from(model.keywordList).sort()) !== JSON.stringify(Array.from(baseModel.keywordList).sort())) 
                    ? JSON.stringify(model.keywordList) : undefined; }],
            ])});

    override toListItem = ():ContentListItem => ({contentID: this.contentID, 
        type: this.type, 
        source: this.source,  
        url: this.url, image: this.image,
        title: this.title, description: this.description, 
        keywordList: this.keywordList, likeCount: this.likeCount});


   /*****************************************
    * constructByJson Model Custom Handling *
    *****************************************/  
    validateModelSpecificField = async({field, value, jsonObj}:{field:InputField, value:string, jsonObj:ContentResponseBody}):Promise<boolean|undefined> => {
        if(field.field === 'minimumAge' || field.field === 'maximumAge') {
            return (parseInt(jsonObj['minimumAge'] as unknown as string) <= parseInt(jsonObj['maximumAge'] as unknown as string));

        } else if(field.field === 'minimumWalkLevel' || field.field === 'maximumWalkLevel') {
            return (parseInt(jsonObj['minimumWalkLevel'] as unknown as string) <= parseInt(jsonObj['maximumWalkLevel'] as unknown as string));
        }
        //No Field Match
        return undefined;
    }

    parseModelSpecificField = async({field, jsonObj}:{field:InputField, jsonObj:ContentResponseBody}):Promise<boolean|undefined> => {
        if(field.field === 'type' && jsonObj['type'] === 'CUSTOM' && field.customField !== undefined) {
            this.type = ContentTypeEnum.CUSTOM;
            this.customType = (jsonObj['customType'] || '').replace(/^[a-zA-Z0-9_ ]$/g, '').replace(/ /g, '_').toUpperCase();
        
        } else if(field.field === 'source' && jsonObj['source'] === 'CUSTOM' && field.customField !== undefined) {
            this.source = ContentSourceEnum.CUSTOM;
            this.customSource = (jsonObj['customSource'] || '').replace(/^[a-zA-Z0-9_ ]$/g, '').replace(/ /g, '_').toUpperCase();

        } else //No Field Match
            return undefined;

        return true;
    }
};
