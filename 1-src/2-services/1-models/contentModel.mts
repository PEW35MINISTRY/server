import { ContentListItem, ContentResponseBody } from '../../0-assets/field-sync/api-type-sync/content-types.mjs';
import { ProfileListItem } from '../../0-assets/field-sync/api-type-sync/profile-types.mjs';
import { GenderSelectionEnum } from '../../0-assets/field-sync/input-config-sync/content-field-config.mjs';
import InputField from '../../0-assets/field-sync/input-config-sync/inputField.mjs';
import {  CONTENT_TABLE_COLUMNS, DATABASE_CONTENT } from '../2-database/database-types.mjs';
import * as log from '../log.mjs';
import BASE_MODEL from './baseModel.mjs';


/*************************************************
  UNIVERSAL CONTENT_ARCHIVE model for DATABASE OPERATIONS 
**************************************************/
export default class CONTENT_ARCHIVE implements BASE_MODEL  {
    modelType = 'CONTENT_ARCHIVE';
    getID = () => this.contentID;
    setID = (id:number) => this.contentID = id;
    isValid: boolean = false;

    //Private static list of class property fields | (This is display-responses; NOT edit-access.)
    static #databaseIdentifyingPropertyList = [ 'recorderID', 'type', 'source', 'url' ]; //exclude: contentID, complex types, and lists
    static #propertyList = [ 'contentID', 'recorderID', 'type', 'source', 'url', 'keywordList', 'description', 'gender', 'minimumAge', 'maximumAge', 'minimumWalkLevel', 'maximumWalkLevel', 'notes' ];

    contentID: number = -1;
    recorderID: number; //user that recorded
    type: string;       //Note: Input has enum options, but not enforced in model or database
    source: string;
    url: string;
    keywordList: string[];
    description?: string;
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
        this.contentID = id;
        this.isValid = false;
      }

    static constructByDatabase = (DB:DATABASE_CONTENT):CONTENT_ARCHIVE => {
        try {
            if(DB === undefined) throw new Error('Undefined Database Object');

            const newContent:CONTENT_ARCHIVE = new CONTENT_ARCHIVE(DB.contentID || -1);

            newContent.recorderID = DB.recorderID;
            newContent.type = DB.type;
            newContent.source = DB.source;
            newContent.url = DB.url;
            newContent.keywordList = CONTENT_ARCHIVE.contentParseKeywordList(DB.keywordListStringified);
            newContent.description = DB.description;
            newContent.gender = GenderSelectionEnum[DB.gender];
            newContent.minimumAge = DB.minimumAge;
            newContent.maximumAge = DB.maximumAge;
            newContent.minimumWalkLevel = DB.minimumWalkLevel;
            newContent.maximumWalkLevel = DB.maximumWalkLevel;
            newContent.notes = DB.notes;
            newContent.isValid = true;

            return newContent;

        } catch(error) {
            log.db('INVALID Database Object; failed to parse CONTENT', JSON.stringify(DB), error);
            return new CONTENT_ARCHIVE();
        }
    }

    //Clone database model values only (not copying references for ListItems)
    static constructByClone = (content:CONTENT_ARCHIVE):CONTENT_ARCHIVE => {
        try { //MUST copy primitives properties directly and create new complex types to avoid reference linking
            if(content === undefined) throw new Error('Undefined Model Object');
            
            const newContent:CONTENT_ARCHIVE = new CONTENT_ARCHIVE(content.contentID); 

            if(newContent.contentID > 0) {
                newContent.recorderID = content.recorderID;
                newContent.type = content.type;
                newContent.source = content.source;
                newContent.url = content.url;
                newContent.keywordList = CONTENT_ARCHIVE.contentParseKeywordList(JSON.stringify(content.keywordList));
                newContent.description = content.description;
                newContent.gender = GenderSelectionEnum[content.gender];
                newContent.minimumAge = content.minimumAge;
                newContent.maximumAge = content.maximumAge;
                newContent.minimumWalkLevel = content.minimumWalkLevel;
                newContent.maximumWalkLevel = content.maximumWalkLevel;
                newContent.notes = content.notes;
                newContent.isValid = true;
            }

            return newContent;

        } catch(error) {
            log.error('INVALID Object; failed to clone CONTENT', JSON.stringify(content), error);
            return new CONTENT_ARCHIVE();
        }
    }

    /* ADDITIONAL UTILITIES */
    static contentParseKeywordList = (keywordsStringified:string):string[] => {
        const tagList = [];
        if(keywordsStringified !== undefined && keywordsStringified !== null && keywordsStringified.length > 0) {        
            try {
                tagList.push(...Array.from(JSON.parse(keywordsStringified)));
            } catch(error) {
                log.error('Failed to parse prayer request tags', keywordsStringified, error);
            }
        }
        return tagList;
    }

    /* PROPERTY FIELD UTILITIES */
    static hasProperty = (field: string) => CONTENT_ARCHIVE.#propertyList.includes(field);
    hasProperty = (field:string) => CONTENT_ARCHIVE.#propertyList.includes(field); //Defined in BASE_MODEL; used for JSON parsing

    getValidProperties = (properties:string[] = CONTENT_ARCHIVE.#propertyList, includeContentID:boolean = true):Map<string, any> => {
        const map = new Map<string, any>();
        properties.filter((p) => (includeContentID || (p !== 'contentID'))).forEach((field) => {
            if(this.hasOwnProperty(field) && this[field] !== undefined && this[field] !== null
              && (!Array.isArray(this[field]) || this[field].length > 0)) {
                    map.set(field, this[field]);
              }
        });
        return map;
    }
  
    getUniqueDatabaseProperties = (content:CONTENT_ARCHIVE):Map<string, any> => {
        const map = new Map<string, any>();
        CONTENT_TABLE_COLUMNS.filter((c) => ((c !== 'contentID'))).forEach((field) => {
            if(this.hasOwnProperty(field) && this[field] !== undefined && this[field] !== null
                && ((Array.isArray(this[field]) 
                    && (JSON.stringify(Array.from(this[field]).sort()) !== JSON.stringify(Array.from(content[field]).sort()))) 
                || (this[field] !== content[field]))) 
                  map.set(field, this[field]);
        });
        return map;
      }

    getDatabaseProperties = ():Map<string, any> => this.getValidProperties(CONTENT_TABLE_COLUMNS, false);

    getDatabaseIdentifyingProperties = ():Map<string, any> => this.getValidProperties(CONTENT_ARCHIVE.#databaseIdentifyingPropertyList, false);

    toJSON = ():DATABASE_CONTENT => Object.fromEntries(this.getValidProperties(CONTENT_ARCHIVE.#propertyList)) as unknown as DATABASE_CONTENT;

    toListItem = ():ContentListItem => ({contentID: this.contentID, type: this.type, source: this.source, url: this.url, keywordList: this.keywordList, description: this.description});

    toString = ():string => JSON.stringify(Object.fromEntries(this.getValidProperties()));

    /** Utility methods for createModelFromJSON **/
    validateModelSpecificField = ({field, value, jsonObj}:{field:InputField, value:string, jsonObj:ContentResponseBody}):boolean|undefined => {
        if(field.field === 'minimumAge' || field.field === 'maximumAge') {
            return (parseInt(jsonObj['minimumAge'] as unknown as string) <= parseInt(jsonObj['maximumAge'] as unknown as string));

        } else if(field.field === 'minimumWalkLevel' || field.field === 'maximumWalkLevel') {
            return (parseInt(jsonObj['minimumWalkLevel'] as unknown as string) <= parseInt(jsonObj['maximumWalkLevel'] as unknown as string));
        } 
        //No Field Match
        return undefined;
    }

    parseModelSpecificField = ({field, jsonObj}:{field:InputField, jsonObj:ContentResponseBody}):boolean|undefined => {
        //No Field Match
        return undefined;
    }
};