import * as log from "../log.mjs";
import BASE_MODEL from "./baseModel.mjs";
import InputField, { InputType } from "./Fields-Sync/inputField.mjs";
import { CircleAnnouncementCreateRequest } from "../../api/circle/circle-types.mjs";
import { DATABASE_CIRCLE_ANNOUNCEMENT, CIRCLE_ANNOUNCEMENT_TABLE_COLUMNS_REQUIRED } from "../database/database-types.mjs";

/*******************************************
  UNIVERSAl circle for DATABASE OPERATIONS 
********************************************/
export default class CIRCLE_ANNOUNCEMENT implements BASE_MODEL  {
    modelType = 'CIRCLE_ANNOUNCEMENT';
    getID = () => this.announcementID;
    setID = (id:number) => this.announcementID = id;
    isValid: boolean = false;

    //Private static list of class property fields | (This is display-responses; NOT edit-access.)
    #propertyList = [ 'message', 'startDate', 'endDate']; //used for json parsing
    #displayList = [ 'announcementID', 'circleID', 'message', 'startDate', 'endDate'];

    announcementID: number = -1;
    circleID: number = -1;
    message: string;
    startDate: Date;
    endDate: Date;

    constructor(DB?:DATABASE_CIRCLE_ANNOUNCEMENT) {
        try {
            if(DB !== undefined) {
                this.announcementID = DB?.announcementID || -1;
                this.circleID = DB?.circleID || -1;
                this.message = DB.message;
                this.startDate = DB.startDate;
                this.endDate = DB.endDate;

                this.isValid = true;
            }
        } catch(error) {
            log.db('INVALID Database Object; failed to parse CIRCLE ANNOUNCEMENT', JSON.stringify(DB), error);
        }
    }

    /* Functional Utilities */
    isCurrentDates = ():boolean => {
        const currentDate = new Date();
        return ((this.startDate < currentDate) && (this.endDate > currentDate));
    }

    /* PROPERTY FIELD UTILITIES */
    hasProperty = (field:string) => this.#propertyList.includes(field);

    getValidProperties = (properties:string[] = this.#displayList):Map<string, any> => {
        const map = new Map<string, any>();
        properties.forEach((field) => {
            if(this.hasOwnProperty(field) && this[field] !== undefined && this[field] !== null) 
                  map.set(field, this[field]);
        });
        return map;
    }
  
    getUniqueDatabaseProperties = ():Map<string, any> => {
        const map = new Map<string, any>();
        CIRCLE_ANNOUNCEMENT_TABLE_COLUMNS_REQUIRED.filter((c) => ((c !== 'announcementID' ))).forEach((field) => {
            if(this.hasOwnProperty(field) && this[field] !== undefined && this[field] !== null) 
                  map.set(field, this[field]);
        });
        return map;
      }

    getDatabaseProperties = ():Map<string, any> => this.getUniqueDatabaseProperties();

    toJSON = ():DATABASE_CIRCLE_ANNOUNCEMENT => Object.fromEntries(this.getValidProperties()) as unknown as DATABASE_CIRCLE_ANNOUNCEMENT;

    toListItem = ():DATABASE_CIRCLE_ANNOUNCEMENT => this.toJSON();

    toString = ():string => JSON.stringify(Object.fromEntries(this.getValidProperties()));

    /** Utility methods for createModelFromJSON **/
    validateModelSpecificField = ({field, value}:{field:InputField, value:string}):boolean|undefined => {
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