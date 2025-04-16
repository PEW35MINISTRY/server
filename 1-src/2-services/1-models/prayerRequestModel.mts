import { CircleListItem } from '../../0-assets/field-sync/api-type-sync/circle-types.mjs';
import { PrayerRequestCommentListItem, PrayerRequestListItem, PrayerRequestPostRequestBody, PrayerRequestResponseBody } from '../../0-assets/field-sync/api-type-sync/prayer-request-types.mjs';
import { ProfileListItem } from '../../0-assets/field-sync/api-type-sync/profile-types.mjs';
import InputField from '../../0-assets/field-sync/input-config-sync/inputField.mjs';
import { getDateDaysFuture, PrayerRequestDurationsMap, PrayerRequestTagEnum } from '../../0-assets/field-sync/input-config-sync/prayer-request-field-config.mjs';
import { JwtClientRequest } from '../../1-api/2-auth/auth-types.mjs';
import { Exception } from '../../1-api/api-types.mjs';
import { DATABASE_PRAYER_REQUEST, PRAYER_REQUEST_TABLE_COLUMNS } from '../2-database/database-types.mjs';
import * as log from '../10-utilities/logging/log.mjs';
import BASE_MODEL from './baseModel.mjs';
import { findClosestListOption, getDaysAway } from '../10-utilities/utilities.mjs';


export default class PRAYER_REQUEST extends BASE_MODEL<PRAYER_REQUEST, PrayerRequestListItem, PrayerRequestResponseBody>  {
    static modelType = 'PRAYER_REQUEST';

    //Static list of class property fields | (This is display-responses; NOT edit-access.)
    static DATABASE_IDENTIFYING_PROPERTY_LIST = ['requestorID', 'topic', 'description']; //exclude: prayerRequestID, complex types, and lists
    static PROPERTY_LIST = [ 'prayerRequestID', 'requestorID', 'topic', 'description', 'prayerCount', 'isOnGoing', 'isResolved', 'tagList', 'expirationDate', 'duration', 'requestorProfile', 'commentList', 'userRecipientList', 'circleRecipientList' ];

    prayerRequestID: number = -1;
    requestorID: number;
    topic: string;
    description: string;
    prayerCount: number;
    isOnGoing: boolean;
    isResolved: boolean;
    tagList: PrayerRequestTagEnum[] = [];
    expirationDate: Date;
    get duration(): number { return findClosestListOption(getDaysAway(this.expirationDate, 0), Array.from(PrayerRequestDurationsMap.values()).map(v => Number(v))); }
      
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
        super(id);
    }

    override getNewInstance = (id:number = -1) => new PRAYER_REQUEST(id);

   /*******************
    * MODEL UTILITIES *
    *******************/  
    static prayerRequestParseTags = (tagListStringified:string):PrayerRequestTagEnum[] => {
        const tagList = [];
        if(tagListStringified !== undefined && tagListStringified !== null && tagListStringified.length > 0) {        
            try {
                tagList.push(...Array.from(JSON.parse(tagListStringified)));
            } catch(error) {
                log.warn('Failed to parse PRAYER_REQUEST.tagListStringified', tagListStringified, error, error.message);
            }
        }
        return tagList;
    }


    /*********************
    * DEFINE PROPERTIES *
    *********************/    
    override get modelType():string { return PRAYER_REQUEST.modelType; }
    override get IDProperty():string { return 'prayerRequestID'; }

    override get DATABASE_COLUMN_LIST():string[] { return PRAYER_REQUEST_TABLE_COLUMNS; }
    override get DATABASE_IDENTIFYING_PROPERTY_LIST():string[] { return PRAYER_REQUEST.DATABASE_IDENTIFYING_PROPERTY_LIST; }
    override get PROPERTY_LIST():string[] { return PRAYER_REQUEST.PROPERTY_LIST; }

    override hasProperty = (field:string) => [ ...PRAYER_REQUEST.PROPERTY_LIST, 'addUserRecipientIDList', 'removeUserRecipientIDList', 'addCircleRecipientIDList', 'removeCircleRecipientIDList' ].includes(field); //used for JSON parsing

    override get priorityInputList():string[] { return ['duration', 'expirationDate']; }

    /**********************************
    * ADDITIONAL STATIC CONSTRUCTORS *
    **********************************/
    static constructByDatabase = (DB:DATABASE_PRAYER_REQUEST):PRAYER_REQUEST => 
       BASE_MODEL.constructByDatabaseUtility<PRAYER_REQUEST>({DB, newModel: new PRAYER_REQUEST(DB.prayerRequestID || -1), defaultModel: new PRAYER_REQUEST(),
        complexColumnMap: new Map([
            ['tagListStringified', (DB:DATABASE_PRAYER_REQUEST, newPrayerRequest:PRAYER_REQUEST) => {newPrayerRequest.tagList = PRAYER_REQUEST.prayerRequestParseTags(DB.tagListStringified)}],
          ])});

    //Clone database model values only (not copying references for ListItems)
    static constructByClone = (circle:PRAYER_REQUEST):PRAYER_REQUEST =>
       BASE_MODEL.constructByCloneUtility<PRAYER_REQUEST>({currentModel: circle, newModel: new PRAYER_REQUEST(circle.prayerRequestID || -1), defaultModel: new PRAYER_REQUEST(), propertyList: PRAYER_REQUEST.PROPERTY_LIST,
        complexPropertyMap: new Map([
            ['tagList', (currentPrayerRequest:PRAYER_REQUEST, newPrayerRequest:PRAYER_REQUEST) => {newPrayerRequest.tagList = PRAYER_REQUEST.prayerRequestParseTags(JSON.stringify(currentPrayerRequest.tagList))}],
            ['requestorProfile', (currentPrayerRequest:PRAYER_REQUEST, newPrayerRequest:PRAYER_REQUEST) => { /* Skipping */ }],
            ['duration', (currentPrayerRequest:PRAYER_REQUEST, newPrayerRequest:PRAYER_REQUEST) => { /* Skipping */ }],
          ])});

    override constructByClone = <PRAYER_REQUEST,>():PRAYER_REQUEST => PRAYER_REQUEST.constructByClone(this) as PRAYER_REQUEST;

    static constructByJson = async<PRAYER_REQUEST,>({jsonObj, fieldList}:{jsonObj:JwtClientRequest['body'], fieldList:InputField[]}):Promise<PRAYER_REQUEST|Exception> => 
        new PRAYER_REQUEST().populateFromJson({jsonObj, fieldList}) as Promise<PRAYER_REQUEST|Exception>;


   /**********************
    * PROPERTY UTILITIES *
    **********************/  
    override getValidProperties = (properties:string[] = PRAYER_REQUEST.PROPERTY_LIST, includeUserID:boolean = true):Map<string, any> => {
        const complexFieldMap = new Map();
        complexFieldMap.set('tagListStringified', (model:PRAYER_REQUEST, baseModel:PRAYER_REQUEST) => JSON.stringify(model.tagList));

        return BASE_MODEL.getUniquePropertiesUtility<PRAYER_REQUEST>({fieldList: properties, getModelProperty: (property) => property,
            model: this, baseModel: undefined, includeID: includeUserID, includeObjects: true, includeNull: false, complexFieldMap});
    }

    static getUniqueDatabaseProperties = (model:PRAYER_REQUEST, baseModel:PRAYER_REQUEST):Map<string, any> =>
        BASE_MODEL.getUniquePropertiesUtility<PRAYER_REQUEST>({fieldList: PRAYER_REQUEST_TABLE_COLUMNS, getModelProperty: (column) => model.getPropertyFromDatabaseColumn(column) ? column : undefined,
            model, baseModel, includeID: false, includeObjects: false, includeNull: true,
            complexFieldMap: new Map([
                ['tagListStringified', (model:PRAYER_REQUEST, baseModel:PRAYER_REQUEST) => { 
                    return (JSON.stringify(Array.from(model.tagList).sort()) !== JSON.stringify(Array.from(baseModel.tagList).sort())) 
                    ? JSON.stringify(model.tagList) : undefined; }],
            ])});

    override getUniqueDatabaseProperties = (baseModel:PRAYER_REQUEST):Map<string, any> => PRAYER_REQUEST.getUniqueDatabaseProperties(this, baseModel);

    override  toListItem = ():PrayerRequestListItem => ({prayerRequestID: this.prayerRequestID, requestorProfile: this.requestorProfile, topic: this.topic, prayerCount: this.prayerCount, tagList: this.tagList});

    /****************************************
     * constructByJson Model Custom Handling *
     *****************************************/  
    override parseModelSpecificField = async({field, jsonObj}:{field:InputField, jsonObj:PrayerRequestPostRequestBody }):Promise<boolean|undefined> => {
        /* Duration | Alternative input for expirationDate */
        if(field.field === 'duration')
            this.expirationDate = getDateDaysFuture(Number(jsonObj[field.field]));

        else //No Field Match
            return undefined;
        
        return true;
    }
}
