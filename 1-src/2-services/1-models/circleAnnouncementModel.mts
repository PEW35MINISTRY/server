import { CircleAnnouncementListItem } from '../../0-assets/field-sync/api-type-sync/circle-types.mjs';
import InputField, { InputType } from '../../0-assets/field-sync/input-config-sync/inputField.mjs';
import { JwtClientRequest } from '../../1-api/2-auth/auth-types.mjs';
import { CircleAnnouncementCreateRequest } from '../../1-api/4-circle/circle-types.mjs';
import { Exception } from '../../1-api/api-types.mjs';
import { CIRCLE_ANNOUNCEMENT_TABLE_COLUMNS, DATABASE_CIRCLE_ANNOUNCEMENT } from '../2-database/database-types.mjs';
import BASE_MODEL from './baseModel.mjs';


export default class CIRCLE_ANNOUNCEMENT extends BASE_MODEL  {
    static modelType = 'CIRCLE_ANNOUNCEMENT';
    getID = () => this.announcementID;
    setID = (id:number) => this.announcementID = id;

    //Private static list of class property fields | (This is display-responses; NOT edit-access.)
    static DATABASE_IDENTIFYING_PROPERTY_LIST = ['circleID', 'message']; //exclude: announcementID, complex types, and lists
    static PROPERTY_LIST = [ 'announcementID', 'circleID', 'message', 'startDate', 'endDate'];

    announcementID: number = -1;
    circleID: number = -1;
    message: string;
    startDate: Date;
    endDate: Date;

    //Used as error case or blank
    constructor(id:number = -1) {
        super();
        this.setID(id);
    }

   /*******************
    * MODEL UTILITIES *
    *******************/  
    isCurrentDates = ():boolean => {
        const currentDate = new Date();
        return ((this.startDate < currentDate) && (this.endDate > currentDate));
    }


    /*********************
    * DEFINE PROPERTIES *
    *********************/    
    override get modelType():string { return CIRCLE_ANNOUNCEMENT.modelType; }
    override get ID():number { return this.circleID; }
    override set ID(id:number) { this.circleID = id; }

    override get databaseTableColumnList():string[] { return CIRCLE_ANNOUNCEMENT_TABLE_COLUMNS; }
    override get databaseIdentifyingPropertyList():string[] { return CIRCLE_ANNOUNCEMENT.DATABASE_IDENTIFYING_PROPERTY_LIST; }
    override get propertyList():string[] { return CIRCLE_ANNOUNCEMENT.PROPERTY_LIST; }


    /**********************************
    * ADDITIONAL STATIC CONSTRUCTORS *
    **********************************/
    static constructByDatabase = (DB:DATABASE_CIRCLE_ANNOUNCEMENT):CIRCLE_ANNOUNCEMENT => 
        BASE_MODEL.constructByDatabaseUtility<CIRCLE_ANNOUNCEMENT>({DB, newModel: new CIRCLE_ANNOUNCEMENT(DB.circleID || -1), defaultModel: new CIRCLE_ANNOUNCEMENT()});

    static constructByClone = (announcement:CIRCLE_ANNOUNCEMENT):CIRCLE_ANNOUNCEMENT =>
        BASE_MODEL.constructByCloneUtility<CIRCLE_ANNOUNCEMENT>({currentModel: announcement, newModel: new CIRCLE_ANNOUNCEMENT(announcement.circleID || -1), defaultModel: new CIRCLE_ANNOUNCEMENT(), propertyList: CIRCLE_ANNOUNCEMENT.PROPERTY_LIST});

    override constructByClone = <CIRCLE_ANNOUNCEMENT,>():CIRCLE_ANNOUNCEMENT => CIRCLE_ANNOUNCEMENT.constructByClone(this) as CIRCLE_ANNOUNCEMENT;

    static constructByJson = <CIRCLE_ANNOUNCEMENT,>({jsonObj, fieldList}:{jsonObj:JwtClientRequest['body'], fieldList:InputField[]}):CIRCLE_ANNOUNCEMENT|Exception => 
        new CIRCLE_ANNOUNCEMENT().populateFromJson({jsonObj, fieldList}) as CIRCLE_ANNOUNCEMENT|Exception;


   /**********************
    * PROPERTY UTILITIES *
    **********************/  
    override getValidProperties = (properties:string[] = CIRCLE_ANNOUNCEMENT.PROPERTY_LIST, includeUserID:boolean = true):Map<string, any> =>
        BASE_MODEL.getUniquePropertiesUtility<CIRCLE_ANNOUNCEMENT>({fieldList: properties, getModelProperty: (property) => property,
            model: this, baseModel: undefined, includeID: includeUserID, includeObjects: true, includeNull: false, complexFieldMap: new Map()});

    static getUniqueDatabaseProperties = (model:CIRCLE_ANNOUNCEMENT, baseModel:CIRCLE_ANNOUNCEMENT):Map<string, any> =>
        BASE_MODEL.getUniquePropertiesUtility<CIRCLE_ANNOUNCEMENT>({fieldList: CIRCLE_ANNOUNCEMENT_TABLE_COLUMNS, getModelProperty: (column) => model.getPropertyFromDatabaseColumn(column) ? column : undefined,
            model, baseModel, includeID: false, includeObjects: false, includeNull: true});

    override getUniqueDatabaseProperties = (baseModel:CIRCLE_ANNOUNCEMENT):Map<string, any> => CIRCLE_ANNOUNCEMENT.getUniqueDatabaseProperties(this, baseModel);

    override toJSON = ():CircleAnnouncementListItem => this.toJSON() as CircleAnnouncementListItem;

    override toListItem = ():CircleAnnouncementListItem => this.toJSON();

    
   /****************************************
    * constructByJson Model Custom Handling *
    *****************************************/  
    validateModelSpecificField = ({field, value, jsonObj}:{field:InputField, value:string, jsonObj:CircleAnnouncementCreateRequest['body']}):boolean|undefined => {
        if(field.type === InputType.DATE && field.field === 'endDate') {
            const currentDate = new Date();
            const endDate = new Date(value);
            if(isNaN(endDate.valueOf()) || currentDate > endDate)
                return false;
            else return true;
        }
        //No Field Match
        return undefined;
    }
};
