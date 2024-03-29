import { CircleListItem } from '../../0-assets/field-sync/api-type-sync/circle-types.mjs';
import { PrayerRequestCommentListItem, PrayerRequestListItem, PrayerRequestResponseBody } from '../../0-assets/field-sync/api-type-sync/prayer-request-types.mjs';
import { ProfileListItem } from '../../0-assets/field-sync/api-type-sync/profile-types.mjs';
import InputField from '../../0-assets/field-sync/input-config-sync/inputField.mjs';
import { PrayerRequestTagEnum } from '../../0-assets/field-sync/input-config-sync/prayer-request-field-config.mjs';
import { PrayerRequestPostRequest } from '../../1-api/5-prayer-request/prayer-request-types.mjs';
import { DATABASE_PRAYER_REQUEST, PRAYER_REQUEST_TABLE_COLUMNS } from '../2-database/database-types.mjs';
import * as log from '../log.mjs';
import BASE_MODEL from './baseModel.mjs';


/*******************************************
  UNIVERSAl PRAYER_REQUEST for DATABASE OPERATIONS 
********************************************/
export default class PRAYER_REQUEST implements BASE_MODEL  {
    modelType = 'PRAYER_REQUEST';
    getID = () => this.prayerRequestID;
    setID = (id:number) => this.prayerRequestID = id;
    isValid: boolean = false;

    //Private static list of class property fields | (This is display-responses; NOT edit-access.)
    static #databaseIdentifyingPropertyList = ['requestorID', 'topic', 'description']; //exclude: prayerRequestID, complex types, and lists
    static #displayPropertyList = [ 'prayerRequestID', 'requestorID', 'topic', 'description', 'prayerCount', 'isOnGoing', 'isResolved', 'tagList', 'expirationDate', 'requestorProfile', 'commentList', 'userRecipientList', 'circleRecipientList' ];
    static #propertyList = [ ...PRAYER_REQUEST.#displayPropertyList, 'addUserRecipientIDList', 'removeUserRecipientIDList', 'addCircleRecipientIDList', 'removeCircleRecipientIDList' ];

    prayerRequestID: number = -1;
    requestorID: number;
    topic: string;
    description: string;
    prayerCount: number;
    isOnGoing: boolean;
    isResolved: boolean;
    tagList: PrayerRequestTagEnum[] = [];
    expirationDate: Date;

    //Query separate Tables
    requestorProfile?: ProfileListItem;
    userRecipientList: ProfileListItem[] = [];
    circleRecipientList: CircleListItem[] = [];
    commentList: PrayerRequestCommentListItem[] = [];

    //Temporary for JSON Patch Request
    addUserRecipientIDList: number[];
    removeUserRecipientIDList: number[];
    addCircleRecipientIDList: number[];
    removeCircleRecipientIDList: number[];

    //Used as error case or blank
    constructor(id:number = -1) {
        this.prayerRequestID = id;
        this.isValid = false;
      }

    static constructByDatabase = (DB:DATABASE_PRAYER_REQUEST):PRAYER_REQUEST => {
        try {
            if(DB === undefined) throw new Error('Undefined Database Object');

            const newPrayerRequest:PRAYER_REQUEST = new PRAYER_REQUEST(DB.prayerRequestID || -1);

            newPrayerRequest.requestorID = DB.requestorID;
            newPrayerRequest.topic = DB.topic;
            newPrayerRequest.description = DB.description;
            newPrayerRequest.prayerCount = DB.prayerCount;
            newPrayerRequest.isOnGoing = DB.isOnGoing ? true : false;
            newPrayerRequest.isResolved = DB.isResolved ? true : false;
            newPrayerRequest.expirationDate = DB.expirationDate;
            newPrayerRequest.tagList = PRAYER_REQUEST.prayerRequestParseTags(DB.tagListStringified);
            newPrayerRequest.isValid = true;

            return newPrayerRequest;

        } catch(error) {
            log.db('INVALID Database Object; failed to parse PRAYER_REQUEST', JSON.stringify(DB), error);
            return new PRAYER_REQUEST();
        }
    }

      //Clone database model values only (not copying references for ListItems)
    static constructByClone = (prayerRequest:PRAYER_REQUEST):PRAYER_REQUEST => {
        try { //MUST copy primitives properties directly and create new complex types to avoid reference linking
            if(prayerRequest === undefined) throw new Error('Undefined Model Object');

            const newPrayerRequest:PRAYER_REQUEST = new PRAYER_REQUEST(prayerRequest.prayerRequestID); 

            if(newPrayerRequest.prayerRequestID > 0) {
                newPrayerRequest.requestorID = prayerRequest.requestorID;
                newPrayerRequest.topic = prayerRequest.topic;
                newPrayerRequest.description = prayerRequest.description;
                newPrayerRequest.prayerCount = prayerRequest.prayerCount;
                newPrayerRequest.isOnGoing = prayerRequest.isOnGoing;
                newPrayerRequest.isResolved = prayerRequest.isResolved;
                newPrayerRequest.expirationDate = new Date(prayerRequest.expirationDate?.getTime());
                newPrayerRequest.tagList = PRAYER_REQUEST.prayerRequestParseTags(JSON.stringify(prayerRequest.tagList));
                newPrayerRequest.isValid = true;
            }

            return newPrayerRequest;

        } catch(error) {
            log.error('INVALID Object; failed to clone PRAYER_REQUEST', JSON.stringify(prayerRequest), error);
            return new PRAYER_REQUEST();
        }
    }

    /* ADDITIONAL UTILITIES */
    static prayerRequestParseTags = (tagListStringified:string):PrayerRequestTagEnum[] => {
        const tagList = [];
        if(tagListStringified !== undefined && tagListStringified !== null && tagListStringified.length > 0) {        
            try {
                tagList.push(...Array.from(JSON.parse(tagListStringified)));
            } catch(error) {
                log.error('Failed to parse PRAYER_REQUEST.tagListStringified', tagListStringified, error);
            }
        }
        return tagList;
    }

    /* PROPERTY FIELD UTILITIES */
    static hasProperty = (field: string) => PRAYER_REQUEST.#propertyList.includes(field);
    hasProperty = (field:string) => PRAYER_REQUEST.#propertyList.includes(field); //Defined in BASE_MODEL; used for JSON parsing

    getValidProperties = (properties:string[] = PRAYER_REQUEST.#displayPropertyList, includePrayerRequestID:boolean = true):Map<string, any> => {
        const map = new Map<string, any>();
        properties.filter((p) => (includePrayerRequestID || (p !== 'prayerRequestID'))).forEach((field) => {
            if(this.hasOwnProperty(field) && this[field] !== undefined && this[field] !== null
              && (!Array.isArray(this[field]) || this[field].length > 0)) {

                if(field === 'expirationDate')
                    map.set(field, this.expirationDate.toISOString());
                else
                    map.set(field, this[field]);

             /* Database unique naming for custom formatting */
              } else if(field === 'tagListStringified') {
                map.set(field, JSON.stringify(this.tagList));
              }
        });
        return map;
    }

 
    static getUniqueDatabaseProperties = (editPrayerRequest:PRAYER_REQUEST, currentPrayerRequest:PRAYER_REQUEST):Map<string, any> => {
        const map = new Map<string, any>();
        PRAYER_REQUEST_TABLE_COLUMNS.filter((c) => ((c !== 'prayerRequestID'))).forEach((field) => {

            if(field === 'tagListStringified' && (JSON.stringify(Array.from(editPrayerRequest.tagList).sort()) !== JSON.stringify(Array.from(currentPrayerRequest.tagList).sort())))
                map.set('tagListStringified', JSON.stringify(editPrayerRequest.tagList));
            
            else if (field === 'expirationDate') { //Must compare dates as numbers
                    if (editPrayerRequest.expirationDate.getTime() !== currentPrayerRequest.expirationDate.getTime())
                      map.set(field, editPrayerRequest[field]);
               
            } else if(editPrayerRequest.hasOwnProperty(field) && editPrayerRequest[field] !== undefined && editPrayerRequest[field] !== null
                && ((Array.isArray(editPrayerRequest[field]) 
                    && (JSON.stringify(Array.from(editPrayerRequest[field]).sort()) !== JSON.stringify(Array.from(currentPrayerRequest[field]).sort()))) 
                || (editPrayerRequest[field] !== currentPrayerRequest[field])))
                    map.set(field, editPrayerRequest[field]);
        });
        return map;
      }

    getDatabaseProperties = ():Map<string, any> => this.getValidProperties(PRAYER_REQUEST_TABLE_COLUMNS, false);

    getDatabaseIdentifyingProperties = ():Map<string, any> => this.getValidProperties(PRAYER_REQUEST.#databaseIdentifyingPropertyList, false);

    toJSON = ():PrayerRequestResponseBody => Object.fromEntries(this.getValidProperties()) as PrayerRequestResponseBody;

    toListItem = ():PrayerRequestListItem => ({prayerRequestID: this.prayerRequestID, requestorProfile: this.requestorProfile, topic: this.topic, prayerCount: this.prayerCount, tagList: this.tagList});

    toString = ():string => JSON.stringify(Object.fromEntries(this.getValidProperties()));

    /** Utility methods for createModelFromJSON **/
    validateModelSpecificField = ({field, value, jsonObj}:{field:InputField, value:string, jsonObj:PrayerRequestPostRequest['body']}):boolean|undefined => {
        //No Field Match
        return undefined;
    }

    parseModelSpecificField = ({field, jsonObj}:{field:InputField, jsonObj:PrayerRequestPostRequest['body']}):boolean|undefined => {
        //No Field Match
        return undefined;
    }
};
