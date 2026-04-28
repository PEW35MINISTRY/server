import { CircleListItem } from '../../0-assets/field-sync/api-type-sync/circle-types.mjs';
import { PrayerRequestCommentListItem, PrayerRequestListItem, PrayerRequestResponseBody } from '../../0-assets/field-sync/api-type-sync/prayer-request-types.mjs';
import { ProfileListItem } from '../../0-assets/field-sync/api-type-sync/profile-types.mjs';
import InputField from '../../0-assets/field-sync/input-config-sync/inputField.mjs';
import { PrayerRequestTagEnum } from '../../0-assets/field-sync/input-config-sync/prayer-request-field-config.mjs';
import { JwtClientRequest } from '../../1-api/2-auth/auth-types.mjs';
import { Exception } from '../../1-api/api-types.mjs';
import { DATABASE_PRAYER_REQUEST, DATABASE_PRAYER_REQUEST_COMMENT_EXTENDED, DATABASE_PRAYER_REQUEST_EXTENDED, PRAYER_REQUEST_EXTENDED_TABLE_COLUMNS, PRAYER_REQUEST_TABLE_COLUMNS, PRAYER_REQUEST_TABLE_COLUMNS_EDIT } from '../2-database/database-types.mjs';
import * as log from '../10-utilities/logging/log.mjs';
import BASE_MODEL from './baseModel.mjs';


export default class PRAYER_REQUEST extends BASE_MODEL<PRAYER_REQUEST, PrayerRequestListItem, PrayerRequestResponseBody>  {
    static modelType = 'PRAYER_REQUEST';

    //Static list of class property fields | (This is display-responses; NOT edit-access.)
    static DATABASE_IDENTIFYING_PROPERTY_LIST = ['requestorID', 'topic', 'description']; //exclude: prayerRequestID, complex types, and lists
    static PROPERTY_LIST = [ 'prayerRequestID', 'requestorID', 'topic', 'description', 'isOnGoing', 'isResolved', 'tagList', 'expirationDate', 'createdDT', 'modifiedDT', 'prayerCount', 'prayerCountRecipient', 'requestorProfile', 'commentList', 'userLikedList', 'userRecipientList', 'circleRecipientList' ];

    prayerRequestID: number = -1;
    requestorID: number;
    topic: string;
    description: string;
    isOnGoing: boolean;
    isResolved: boolean;
    tagList: PrayerRequestTagEnum[] = [];
    expirationDate: Date;

    //Database - Read Only
    createdDT:Date;
    modifiedDT:Date;

    //Query separate Tables
    prayerCount:number = 0;
    prayerCountRecipient: number = 0;
    requestorProfile?: ProfileListItem;
    userRecipientList: ProfileListItem[] = [];
    circleRecipientList: CircleListItem[] = [];
    commentList: PrayerRequestCommentListItem[] = [];
    userLikedList: ProfileListItem[] = [];

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
    override get DATABASE_COLUMN_EDIT_LIST():string[] { return PRAYER_REQUEST_TABLE_COLUMNS_EDIT;}
    override get DATABASE_IDENTIFYING_PROPERTY_LIST():string[] { return PRAYER_REQUEST.DATABASE_IDENTIFYING_PROPERTY_LIST; }
    override get PROPERTY_LIST():string[] { return PRAYER_REQUEST.PROPERTY_LIST; }

    override hasProperty = (field:string) => [ ...PRAYER_REQUEST.PROPERTY_LIST, 'addUserRecipientIDList', 'removeUserRecipientIDList', 'addCircleRecipientIDList', 'removeCircleRecipientIDList' ].includes(field); //used for JSON parsing

    /**********************************
    * ADDITIONAL STATIC CONSTRUCTORS *
    **********************************/
    static constructByDatabase = (DB:DATABASE_PRAYER_REQUEST|DATABASE_PRAYER_REQUEST_EXTENDED):PRAYER_REQUEST => 
       BASE_MODEL.constructByDatabaseUtility<PRAYER_REQUEST>({DB, newModel:new PRAYER_REQUEST(DB.prayerRequestID || -1), defaultModel:new PRAYER_REQUEST(), columnList:PRAYER_REQUEST_EXTENDED_TABLE_COLUMNS,
        complexColumnMap: new Map([
            ['tagListStringified', (DB:DATABASE_PRAYER_REQUEST_EXTENDED, newPrayerRequest:PRAYER_REQUEST) => {newPrayerRequest.tagList = PRAYER_REQUEST.prayerRequestParseTags(DB.tagListStringified)}],
            
            //Joint Tables included in Extended Query
            ['prayerCount', (DB:DATABASE_PRAYER_REQUEST_EXTENDED, newPrayerRequest:PRAYER_REQUEST) => (newPrayerRequest.prayerCount = DB.prayerCount ?? 0)],
            ['prayerCountRecipient', (DB:DATABASE_PRAYER_REQUEST_EXTENDED, newPrayerRequest:PRAYER_REQUEST) => (newPrayerRequest.prayerCountRecipient = DB.prayerCountRecipient ?? 0)],
            ['requestorID', (DB:DATABASE_PRAYER_REQUEST_EXTENDED, newPrayerRequest:PRAYER_REQUEST) => {
                newPrayerRequest.requestorID = DB.requestorID;

                newPrayerRequest.requestorProfile = {
                    userID: DB.requestorID,
                    firstName: DB.requestorFirstName ?? '',
                    displayName: DB.requestorDisplayName ?? '',
                    image: DB.requestorImage ?? '',
                }}],
          ])});

    //Clone database model values only (not copying references for ListItems)
    static constructByClone = (circle:PRAYER_REQUEST):PRAYER_REQUEST =>
       BASE_MODEL.constructByCloneUtility<PRAYER_REQUEST>({currentModel: circle, newModel: new PRAYER_REQUEST(circle.prayerRequestID || -1), defaultModel: new PRAYER_REQUEST(), propertyList: PRAYER_REQUEST.PROPERTY_LIST,
        complexPropertyMap: new Map([
            ['tagList', (currentPrayerRequest:PRAYER_REQUEST, newPrayerRequest:PRAYER_REQUEST) => {newPrayerRequest.tagList = PRAYER_REQUEST.prayerRequestParseTags(JSON.stringify(currentPrayerRequest.tagList))}],
            ['requestorProfile', (currentPrayerRequest:PRAYER_REQUEST, newPrayerRequest:PRAYER_REQUEST) => { /* Skipping */ }],
            ['prayerCountRecipient', (currentPrayerRequest:PRAYER_REQUEST, newPrayerRequest:PRAYER_REQUEST) => { /* Skipping */ }],
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
        BASE_MODEL.getUniquePropertiesUtility<PRAYER_REQUEST>({fieldList: PRAYER_REQUEST_TABLE_COLUMNS_EDIT, getModelProperty: (column) => model.getPropertyFromDatabaseColumn(column) ? column : undefined,
            model, baseModel, includeID: false, includeObjects: false, includeNull: true,
            complexFieldMap: new Map([
                ['tagListStringified', (model:PRAYER_REQUEST, baseModel:PRAYER_REQUEST) => { 
                    return (JSON.stringify(Array.from(model.tagList).sort()) !== JSON.stringify(Array.from(baseModel.tagList).sort())) 
                    ? JSON.stringify(model.tagList) : undefined; }],
            ])});

    override getUniqueDatabaseProperties = (baseModel:PRAYER_REQUEST):Map<string, any> => PRAYER_REQUEST.getUniqueDatabaseProperties(this, baseModel);

    override toListItem = ():PrayerRequestListItem => ({
        prayerRequestID: this.prayerRequestID,
        topic: this.topic,
        description: this.description,
        tagList: this.tagList ?? [],
        
        createdDT: this.createdDT ? this.createdDT.toISOString() : new Date().toISOString(),
        modifiedDT: this.modifiedDT ? this.modifiedDT.toISOString() : new Date().toISOString(),

        requestorID: this.requestorID,
        requestorProfile: this.requestorProfile,
        prayerCountRecipient: this.prayerCountRecipient,
        prayerCount: this.prayerCount,
    });


    /************
     * COMMENTS *
     ************/
    static constructByDatabaseCommentList = (rows:DATABASE_PRAYER_REQUEST_COMMENT_EXTENDED[]):PrayerRequestCommentListItem[] =>
        rows.map((row) => ({
            commentID: row.commentID ?? -1,
            prayerRequestID: row.prayerRequestID ?? -1,
            message: row.message ?? '',
            createdDT: row.createdDT ? row.createdDT?.toISOString() : new Date().toISOString(),

            //Extended: Joint Tables
            commenterProfile: {
                userID: row.commenterID,
                firstName: row.commenterFirstName ?? '',
                displayName: row.commenterDisplayName ?? '',
                image: row.commenterImage ?? '',
            },
            likeCount: row.likeCount ?? 0,
            isLikedByRecipient: row.isLikedByRecipient,
    }));
};
