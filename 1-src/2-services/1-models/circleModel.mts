import { CircleEditRequestBody, CircleEventListItem, CircleLeaderResponse, CircleListItem, CircleResponse } from '../../0-assets/field-sync/api-type-sync/circle-types.mjs';
import { PrayerRequestListItem } from '../../0-assets/field-sync/api-type-sync/prayer-request-types.mjs';
import { ProfileListItem } from '../../0-assets/field-sync/api-type-sync/profile-types.mjs';
import { CircleStatusEnum } from '../../0-assets/field-sync/input-config-sync/circle-field-config.mjs';
import InputField from '../../0-assets/field-sync/input-config-sync/inputField.mjs';
import { CIRCLE_TABLE_COLUMNS, DATABASE_CIRCLE } from '../2-database/database-types.mjs';
import BASE_MODEL from './baseModel.mjs';
import CIRCLE_ANNOUNCEMENT from './circleAnnouncementModel.mjs';
import { Exception } from '../../1-api/api-types.mjs';
import { JwtClientRequest } from '../../1-api/2-auth/auth-types.mjs';


export default class CIRCLE extends BASE_MODEL {
    static modelType:string = 'CIRCLE';
    getID = () => this.circleID;
    setID = (id:number) => this.circleID = id;

    //Private static list of class property fields | (This is display-responses; NOT edit-access.)
    static DATABASE_IDENTIFYING_PROPERTY_LIST = ['leaderID', 'name', 'description', 'inviteToken']; //exclude: circleID, complex types, and lists
    static PUBLIC_PROPERTY_LIST = ['circleID', 'leaderID', 'name', 'description', 'postalCode', 'image', 'requestorID', 'requestorStatus', 'leaderProfile', 'memberList', 'eventList'];
    static MEMBER_PROPERTY_LIST = [...CIRCLE.PUBLIC_PROPERTY_LIST, 'announcementList', 'prayerRequestList', 'pendingRequestList', 'pendingInviteList'];
    static LEADER_PROPERTY_LIST = [...CIRCLE.MEMBER_PROPERTY_LIST, 'inviteToken'];
    static PROPERTY_LIST = [...CIRCLE.LEADER_PROPERTY_LIST, 'notes'];

    circleID: number = -1;
    leaderID: number;
    name?: string;
    description?: string;
    postalCode?: string;
    isActive?: boolean;
    inviteToken?: string;
    image?: string;
    notes?: string;

    //Query separate Tables
    requestorID: number = -1;
    requestorStatus: CircleStatusEnum;
    leaderProfile?: ProfileListItem;
    announcementList: CIRCLE_ANNOUNCEMENT[] = [];
    eventList: CircleEventListItem[] = [];
    prayerRequestList: PrayerRequestListItem[] = [];
    memberList: ProfileListItem[] = [];
    pendingRequestList: ProfileListItem[] = [];
    pendingInviteList: ProfileListItem[] = [];

    //Used as error case or blank
    constructor(id:number = -1) {
        super();
        this.setID(id);
    }

   /*********************
    * DEFINE PROPERTIES *
    *********************/    
    override get modelType():string { return CIRCLE.modelType; }
    override get ID():number { return this.circleID; }
    override set ID(id:number) { this.circleID = id; }

    override get databaseTableColumnList():string[] { return CIRCLE_TABLE_COLUMNS; }
    override get databaseIdentifyingPropertyList():string[] { return CIRCLE.DATABASE_IDENTIFYING_PROPERTY_LIST; }
    override get propertyList():string[] { return CIRCLE.PROPERTY_LIST; }


   /**********************************
    * ADDITIONAL STATIC CONSTRUCTORS *
    **********************************/
    static constructByDatabase = (DB:DATABASE_CIRCLE):CIRCLE => 
        BASE_MODEL.constructByDatabaseUtility<CIRCLE>({DB, newModel: new CIRCLE(DB.circleID || -1), defaultModel: new CIRCLE()});

    //Clone database model values only (not copying references for ListItems)
    static constructByClone = (circle:CIRCLE):CIRCLE =>
        BASE_MODEL.constructByCloneUtility<CIRCLE>({currentModel: circle, newModel: new CIRCLE(circle.circleID || -1), defaultModel: new CIRCLE(), propertyList: CIRCLE.PROPERTY_LIST});

    override constructByClone = <CIRCLE,>():CIRCLE => CIRCLE.constructByClone(this) as CIRCLE;

    static constructByJson = <CIRCLE,>({jsonObj, fieldList}:{jsonObj:JwtClientRequest['body'], fieldList:InputField[]}):CIRCLE|Exception => 
        new CIRCLE().populateFromJson({jsonObj, fieldList}) as CIRCLE|Exception;

   /**********************
    * PROPERTY UTILITIES *
    **********************/  
    override getValidProperties = (properties:string[] = CIRCLE.PROPERTY_LIST, includeUserID:boolean = true):Map<string, any> => {
        const complexFieldMap = new Map();
        complexFieldMap.set('announcementList', (model:CIRCLE, baseModel:CIRCLE) => model.announcementList.map(announcement => announcement.toJSON()));
    
        return BASE_MODEL.getUniquePropertiesUtility<CIRCLE>({fieldList: properties, getModelProperty: (property) => property,
          model: this, baseModel: undefined, includeID: includeUserID, includeObjects: true, includeNull: false,
          complexFieldMap});
    }
  
    static getUniqueDatabaseProperties = (model:CIRCLE, baseModel:CIRCLE):Map<string, any> =>
        BASE_MODEL.getUniquePropertiesUtility<CIRCLE>({fieldList: CIRCLE_TABLE_COLUMNS, getModelProperty: (column) => model.getPropertyFromDatabaseColumn(column) ? column : undefined,
            model, baseModel, includeID: false, includeObjects: false, includeNull: true});

    override getUniqueDatabaseProperties = (baseModel:CIRCLE):Map<string, any> => CIRCLE.getUniqueDatabaseProperties(this, baseModel);

    override toJSON = ():CircleResponse => Object.fromEntries(this.getValidProperties(CIRCLE.PROPERTY_LIST)) as CircleResponse;

    toPublicJSON = ():CircleResponse => Object.fromEntries(this.getValidProperties(CIRCLE.PUBLIC_PROPERTY_LIST)) as CircleResponse;

    toMemberJSON = ():CircleResponse => Object.fromEntries(this.getValidProperties(CIRCLE.MEMBER_PROPERTY_LIST)) as CircleResponse;

    toLeaderJSON = ():CircleLeaderResponse => Object.fromEntries(this.getValidProperties(CIRCLE.LEADER_PROPERTY_LIST)) as CircleLeaderResponse;

    override toListItem = ():CircleListItem => ({circleID: this.circleID, name: this.name, image: this.image});


   /****************************************
    * constructByJson Model Custom Handling *
    *****************************************/  
    override parseModelSpecificField = ({field, jsonObj}:{field:InputField, jsonObj:CircleEditRequestBody}):boolean|undefined => {
        //Handle inviteToken for security
        if(field.field === 'inviteToken') {
            this.inviteToken = (String(jsonObj[field.field]) || '').toLowerCase();

        } else //No Field Match
            return undefined;
    
        return true;
    }
};
