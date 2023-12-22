import { CircleAnnouncementListItem } from '../../0-assets/field-sync/api-type-sync/circle-types.mjs';
import InputField, { InputType } from '../../0-assets/field-sync/input-config-sync/inputField.mjs';
import { CircleAnnouncementCreateRequest } from '../../1-api/4-circle/circle-types.mjs';
import { CIRCLE_ANNOUNCEMENT_TABLE_COLUMNS, CIRCLE_ANNOUNCEMENT_TABLE_COLUMNS_REQUIRED, DATABASE_CIRCLE_ANNOUNCEMENT } from '../2-database/database-types.mjs';
import * as log from '../log.mjs';
import BASE_MODEL from './baseModel.mjs';


/*******************************************
  UNIVERSAl circle for DATABASE OPERATIONS 
********************************************/
export default class CIRCLE_ANNOUNCEMENT implements BASE_MODEL  {
    modelType = 'CIRCLE_ANNOUNCEMENT';
    getID = () => this.announcementID;
    setID = (id:number) => this.announcementID = id;
    isValid: boolean = false;

    //Private static list of class property fields | (This is display-responses; NOT edit-access.)
    static #databaseIdentifyingPropertyList = ['circleID', 'message']; //exclude: announcementID, complex types, and lists
    static #propertyList = [ 'message', 'startDate', 'endDate']; //used for json parsing
    static #displayList = [ 'announcementID', 'circleID', 'message', 'startDate', 'endDate'];

    announcementID: number = -1;
    circleID: number = -1;
    message: string;
    startDate: Date;
    endDate: Date;

    //Used as error case or blank
    constructor(id:number = -1) {
        this.circleID = id;
        this.isValid = false;
      }

    static constructByDatabase = (DB:DATABASE_CIRCLE_ANNOUNCEMENT):CIRCLE_ANNOUNCEMENT => {
        try {
            if(DB === undefined) throw new Error('Undefined Database Object');

            const newCircleAnnouncement:CIRCLE_ANNOUNCEMENT = new CIRCLE_ANNOUNCEMENT(DB.announcementID || -1);

            newCircleAnnouncement.circleID = DB?.circleID || -1;
            newCircleAnnouncement.message = DB.message;
            newCircleAnnouncement.startDate = DB.startDate;
            newCircleAnnouncement.endDate = DB.endDate;
            newCircleAnnouncement.isValid = true;

            return newCircleAnnouncement;

        } catch(error) {
            log.db('INVALID Database Object; failed to parse CIRCLE_ANNOUNCEMENT', JSON.stringify(DB), error);
            return new CIRCLE_ANNOUNCEMENT();
        }
    }

    /* Functional Utilities */
    isCurrentDates = ():boolean => {
        const currentDate = new Date();
        return ((this.startDate < currentDate) && (this.endDate > currentDate));
    }

    /* PROPERTY FIELD UTILITIES */
    static hasProperty = (field: string) => CIRCLE_ANNOUNCEMENT.#propertyList.includes(field);
    hasProperty = (field:string) => CIRCLE_ANNOUNCEMENT.#propertyList.includes(field); //Defined in BASE_MODEL; used for JSON parsing

    getValidProperties = (properties:string[] = CIRCLE_ANNOUNCEMENT.#displayList, includeAnnouncementID:boolean = true):Map<string, any> => {
        const map = new Map<string, any>();
        properties.filter((p) => (includeAnnouncementID || (p !== 'announcementID'))).forEach((field) => {
            if(this.hasOwnProperty(field) && this[field] !== undefined && this[field] !== null) {
                if(field === 'startDate' || field === 'endDate' )
                    map.set(field, (this[field] as Date).toISOString());
                else
                    map.set(field, this[field]);
            }
        });
        return map;
    }
  
    getDatabaseProperties = ():Map<string, any> => this.getValidProperties(CIRCLE_ANNOUNCEMENT_TABLE_COLUMNS, false);

    getDatabaseIdentifyingProperties = ():Map<string, any> => this.getValidProperties(CIRCLE_ANNOUNCEMENT.#databaseIdentifyingPropertyList, false);

    toJSON = ():CircleAnnouncementListItem => Object.fromEntries(this.getValidProperties()) as CircleAnnouncementListItem;

    toListItem = ():CircleAnnouncementListItem => this.toJSON();

    toString = ():string => JSON.stringify(Object.fromEntries(this.getValidProperties()));

    /** Utility methods for createModelFromJSON **/
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

    parseModelSpecificField = ({field, jsonObj}:{field:InputField, jsonObj:CircleAnnouncementCreateRequest['body']}):boolean|undefined => {
        //No Field Match
        return undefined;
    }
};