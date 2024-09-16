import { CircleAnnouncementListItem } from '../../0-assets/field-sync/api-type-sync/circle-types.mjs';
import InputField, { InputType } from '../../0-assets/field-sync/input-config-sync/inputField.mjs';
import { JwtClientRequest } from '../../1-api/2-auth/auth-types.mjs';
import { CircleAnnouncementCreateRequest } from '../../1-api/4-circle/circle-types.mjs';
import { Exception } from '../../1-api/api-types.mjs';
import { CIRCLE_ANNOUNCEMENT_TABLE_COLUMNS, DATABASE_CIRCLE_ANNOUNCEMENT } from '../2-database/database-types.mjs';
import BASE_MODEL from './baseModel.mjs';


export default class CIRCLE_ANNOUNCEMENT extends BASE_MODEL<CIRCLE_ANNOUNCEMENT, CircleAnnouncementListItem, CircleAnnouncementListItem>  {
    static modelType = 'CIRCLE_ANNOUNCEMENT';

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
        super(id);
    }

    override getNewInstance = (id:number = -1) => new CIRCLE_ANNOUNCEMENT(id);

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
    override get IDProperty():string { return 'announcementID'; }

    override get DATABASE_COLUMN_LIST():string[] { return CIRCLE_ANNOUNCEMENT_TABLE_COLUMNS; }
    override get DATABASE_IDENTIFYING_PROPERTY_LIST():string[] { return CIRCLE_ANNOUNCEMENT.DATABASE_IDENTIFYING_PROPERTY_LIST; }
    override get PROPERTY_LIST():string[] { return CIRCLE_ANNOUNCEMENT.PROPERTY_LIST; }


    /**********************************
    * ADDITIONAL STATIC CONSTRUCTORS *
    **********************************/
    static constructByDatabase = (DB:DATABASE_CIRCLE_ANNOUNCEMENT):CIRCLE_ANNOUNCEMENT => 
        BASE_MODEL.constructByDatabaseUtility<CIRCLE_ANNOUNCEMENT>({DB, newModel: new CIRCLE_ANNOUNCEMENT(DB.circleID || -1), defaultModel: new CIRCLE_ANNOUNCEMENT()});

    static constructByJson = async<CIRCLE_ANNOUNCEMENT,>({jsonObj, fieldList}:{jsonObj:JwtClientRequest['body'], fieldList:InputField[]}):Promise<CIRCLE_ANNOUNCEMENT|Exception> => 
        new CIRCLE_ANNOUNCEMENT().populateFromJson({jsonObj, fieldList}) as Promise<CIRCLE_ANNOUNCEMENT|Exception>;

    
   /****************************************
    * constructByJson Model Custom Handling *
    *****************************************/  
    validateModelSpecificField = async({field, value, jsonObj}:{field:InputField, value:string, jsonObj:CircleAnnouncementCreateRequest['body']}):Promise<boolean|undefined> => {
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
