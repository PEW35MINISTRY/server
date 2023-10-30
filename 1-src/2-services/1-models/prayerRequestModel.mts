import { CircleListItem } from '../../0-assets/field-sync/api-type-sync/circle-types.mjs';
import { PrayerRequestCommentListItem, PrayerRequestListItem } from '../../0-assets/field-sync/api-type-sync/prayer-request-types.mjs';
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
    #displayPropertyList = [ 'prayerRequestID', 'requestorID', 'topic', 'description', 'prayerCount', 'isOnGoing', 'isResolved', 'tagList', 'expirationDate', 'requestorProfile', 'commentList', 'userRecipientList', 'circleRecipientList' ];
    #propertyList = [ ...this.#displayPropertyList, 'addUserRecipientIDList', 'removeUserRecipientIDList', 'addCircleRecipientIDList', 'removeCircleRecipientIDList' ];

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

    constructor(DB?:DATABASE_PRAYER_REQUEST, prayerRequestID?:number) {
        try {
            this.prayerRequestID = prayerRequestID || DB?.prayerRequestID || -1;

            if(DB !== undefined) {
                this.requestorID = DB.requestorID;
                this.topic = DB.topic;
                this.description = DB.description;
                this.prayerCount = DB.prayerCount;
                this.isOnGoing = DB.isOnGoing ? true : false;
                this.isResolved = DB.isResolved ? true : false;
                this.expirationDate = DB.expirationDate;

                this.tagList = prayerRequestParseTags(DB.tagsStringified);
                
                this.isValid = true;
            }
        } catch(error) {
            log.db('INVALID Database Object; failed to parse PRAYER_REQUEST', JSON.stringify(DB), error);
        }
    }

    /* PROPERTY FIELD UTILITIES */
    hasProperty = (field:string) => this.#propertyList.includes(field);

    getValidProperties = (properties:string[] = this.#displayPropertyList, includePrayerRequestID:boolean = true):Map<string, any> => {
        const map = new Map<string, any>();
        properties.filter((p) => (includePrayerRequestID || (p !== 'prayerRequestID'))).forEach((field) => {
            if(this.hasOwnProperty(field) && this[field] !== undefined && this[field] !== null
              && (!Array.isArray(this[field]) || this[field].length > 0)) {
                if(field === 'expirationDate')
                    map.set(field, this.expirationDate.toISOString());
                else
                    map.set(field, this[field]);
              }
        });
        return map;
    }

 
    getUniqueDatabaseProperties = (prayerRequest:PRAYER_REQUEST):Map<string, any> => {
        const map = new Map<string, any>();
        PRAYER_REQUEST_TABLE_COLUMNS.filter((c) => ((c !== 'prayerRequestID'))).forEach((field) => {

            if(field === 'tagsStringified' && (JSON.stringify(Array.from(this['tagList']).sort()) !== JSON.stringify(Array.from(prayerRequest['tagList']).sort())))
                map.set('tagsStringified', JSON.stringify(this['tagList']));
            
            else if(this.hasOwnProperty(field) && this[field] !== undefined && this[field] !== null
                && ((Array.isArray(this[field]) 
                    && (JSON.stringify(Array.from(this[field]).sort()) !== JSON.stringify(Array.from(prayerRequest[field]).sort()))) 
                || (this[field] !== prayerRequest[field])))
                    map.set(field, this[field]);
        });
        return map;
      }

    getDatabaseProperties = ():Map<string, any> => this.getUniqueDatabaseProperties(new PRAYER_REQUEST());

    toJSON = ():DATABASE_PRAYER_REQUEST => Object.fromEntries(this.getValidProperties()) as unknown as DATABASE_PRAYER_REQUEST;

    toListItem = ():PrayerRequestListItem => ({prayerRequestID: this.prayerRequestID, requestorProfile: this.requestorProfile, topic: this.topic, prayerCount: this.prayerCount, tagList: this.tagList});

    toString = ():string => JSON.stringify(Object.fromEntries(this.getValidProperties()));

    /** Utility methods for createModelFromJSON **/
    validateModelSpecificField = ({field, value}:{field:InputField, value:string}):boolean|undefined => {
        //No Field Match
        return undefined;
    }

    parseModelSpecificField = ({field, jsonObj}:{field:InputField, jsonObj:PrayerRequestPostRequest['body']}):boolean|undefined => {
        //Handle inviteToken for security
        if(field.field === 'tagList') {
            Array.from(jsonObj[field.field]).forEach((item:string) => {
                if(Object.values(PrayerRequestTagEnum).includes(PrayerRequestTagEnum[item])) 
                    this.tagList.push(PrayerRequestTagEnum[item]);
            });
            return true;
        }
        //No Field Match
        return undefined;
    }
};

/* ADDITIONAL UTILITIES */
export const prayerRequestParseTags = (tagsStringified:string):PrayerRequestTagEnum[] => {
    const tagList = [];
    if(tagsStringified !== undefined && tagsStringified !== null && tagsStringified.length > 0) {        
        try {
            const list:string[] = JSON.parse(tagsStringified);
            list.forEach((item:string) => {
                if(Object.values(PrayerRequestTagEnum).includes(PrayerRequestTagEnum[item])) 
                    tagList.push(PrayerRequestTagEnum[item]);
            });
        } catch(error) {
            log.error('Failed to parse prayer request tags', tagsStringified, error);
        }
    }
    return tagList;
}