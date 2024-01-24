import { CircleEditRequestBody, CircleEventListItem, CircleLeaderResponse, CircleListItem, CircleResponse } from '../../0-assets/field-sync/api-type-sync/circle-types.mjs';
import { PrayerRequestListItem } from '../../0-assets/field-sync/api-type-sync/prayer-request-types.mjs';
import { ProfileListItem } from '../../0-assets/field-sync/api-type-sync/profile-types.mjs';
import { CircleStatusEnum } from '../../0-assets/field-sync/input-config-sync/circle-field-config.mjs';
import InputField from '../../0-assets/field-sync/input-config-sync/inputField.mjs';
import { CIRCLE_TABLE_COLUMNS, DATABASE_CIRCLE } from '../2-database/database-types.mjs';
import * as log from '../log.mjs';
import BASE_MODEL from './baseModel.mjs';
import CIRCLE_ANNOUNCEMENT from './circleAnnouncementModel.mjs';


/*******************************************
  UNIVERSAl circle for DATABASE OPERATIONS 
********************************************/
export default class CIRCLE implements BASE_MODEL  {
    modelType = 'CIRCLE';
    getID = () => this.circleID;
    setID = (id:number) => this.circleID = id;
    isValid: boolean = false;

    //Private static list of class property fields | (This is display-responses; NOT edit-access.)
    static #databaseIdentifyingPropertyList = ['leaderID', 'name', 'description', 'inviteToken']; //exclude: circleID, complex types, and lists
    static #publicPropertyList = ['circleID', 'leaderID', 'name', 'description', 'postalCode', 'image', 'requestorID', 'requestorStatus', 'leaderProfile', 'memberList', 'eventList'];
    static #memberPropertyList = [...CIRCLE.#publicPropertyList, 'announcementList', 'prayerRequestList', 'pendingRequestList', 'pendingInviteList'];
    static #leaderPropertyList = [...CIRCLE.#memberPropertyList, 'inviteToken'];
    static #propertyList = [...CIRCLE.#leaderPropertyList, 'notes'];

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
        this.circleID = id;
        this.isValid = false;
      }

    static constructByDatabase = (DB:DATABASE_CIRCLE):CIRCLE => {
        try {
            if(DB === undefined) throw new Error('Undefined Database Object');

            const newCircle:CIRCLE = new CIRCLE(DB.circleID || -1);

            newCircle.leaderID = DB.leaderID;
            newCircle.name = DB.name;
            newCircle.description = DB.description;
            newCircle.postalCode = DB.postalCode;
            newCircle.isActive = DB.isActive ? true : false;
            newCircle.inviteToken = DB.inviteToken;
            newCircle.image = DB.image;
            newCircle.notes = DB.notes;
            newCircle.isValid = true;

            return newCircle;

        } catch(error) {
            log.db('INVALID Database Object; failed to parse CIRCLE', JSON.stringify(DB), error);
            return new CIRCLE();
        }
    }

    //Clone database model values only (not copying references for ListItems)
    static constructByClone = (circle:CIRCLE):CIRCLE => {
        try { //MUST copy primitives properties directly and create new complex types to avoid reference linking
            if(circle === undefined) throw new Error('Undefined Model Object');

            const newCircle:CIRCLE = new CIRCLE(circle.circleID); 

            if(newCircle.circleID > 0) {
                newCircle.leaderID = circle.leaderID;
                newCircle.name = circle.name;
                newCircle.description = circle.description;
                newCircle.postalCode = circle.postalCode;
                newCircle.isActive = circle.isActive;
                newCircle.inviteToken = circle.inviteToken;
                newCircle.image = circle.image;
                newCircle.notes = circle.notes;
                newCircle.isValid = true;
            }

            return newCircle;

        } catch(error) {
            log.error('INVALID Object; failed to clone CIRCLE', JSON.stringify(circle), error);
            return new CIRCLE();
        }
    }

    /* PROPERTY FIELD UTILITIES */
    static hasProperty = (field: string) => CIRCLE.#propertyList.includes(field);
    hasProperty = (field:string) => CIRCLE.#propertyList.includes(field); //Defined in BASE_MODEL; used for JSON parsing

    getValidProperties = (properties:string[] = CIRCLE.#propertyList, includeCircleID:boolean = true):Map<string, any> => {
        const map = new Map<string, any>();
        properties.filter((p) => (includeCircleID || (p !== 'circleID'))).forEach((field) => {
            if(this.hasOwnProperty(field) && this[field] !== undefined && this[field] !== null
              && (!Array.isArray(this[field]) || this[field].length > 0)) {
                if(field === 'announcementList')
                    map.set(field, this.announcementList.map(announcement => announcement.toJSON()));
                else
                    map.set(field, this[field]);
              }
        });
        return map;
    }
  
    getUniqueDatabaseProperties = (circle:CIRCLE):Map<string, any> => {
        const map = new Map<string, any>();
        CIRCLE_TABLE_COLUMNS.filter((c) => ((c !== 'circleID'))).forEach((field) => {
            if(this.hasOwnProperty(field) && this[field] !== undefined && this[field] !== null
                && ((Array.isArray(this[field]) 
                    && (JSON.stringify(Array.from(this[field]).sort()) !== JSON.stringify(Array.from(circle[field]).sort()))) 
                || (this[field] !== circle[field]))) 
                  map.set(field, this[field]);
        });
        return map;
      }

    getDatabaseProperties = ():Map<string, any> => this.getValidProperties(CIRCLE_TABLE_COLUMNS, false);

    getDatabaseIdentifyingProperties = ():Map<string, any> => this.getValidProperties(CIRCLE.#databaseIdentifyingPropertyList, false);

    toJSON = ():CircleResponse => Object.fromEntries(this.getValidProperties(CIRCLE.#propertyList)) as CircleResponse;

    toPublicJSON = ():CircleResponse => Object.fromEntries(this.getValidProperties(CIRCLE.#publicPropertyList)) as CircleResponse;

    toMemberJSON = ():CircleResponse => Object.fromEntries(this.getValidProperties(CIRCLE.#memberPropertyList)) as CircleResponse;

    toLeaderJSON = ():CircleLeaderResponse => Object.fromEntries(this.getValidProperties(CIRCLE.#leaderPropertyList)) as CircleLeaderResponse;

    toListItem = ():CircleListItem => ({circleID: this.circleID, name: this.name, image: this.image});

    toString = ():string => JSON.stringify(Object.fromEntries(this.getValidProperties()));

    /** Utility methods for createModelFromJSON **/
    validateModelSpecificField = ({field, value, jsonObj}:{field:InputField, value:string, jsonObj:CircleEditRequestBody}):boolean|undefined => {
        //No Field Match
        return undefined;
    }

    parseModelSpecificField = ({field, jsonObj}:{field:InputField, jsonObj:CircleEditRequestBody}):boolean|undefined => {
        //Handle inviteToken for security
        if(field.field === 'inviteToken') {
            this.inviteToken = jsonObj[field.field];
            return true;
        }
        //No Field Match
        return undefined;
    }
};