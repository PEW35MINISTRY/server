import * as log from "../log.mjs";
import BASE_MODEL from "./baseModel.mjs";
import { CircleStatus, InputField } from "./Fields-Sync/circle-field-config.mjs";
import { CircleEditRequest, CircleEventListItem, CircleListItem } from "../../api/circle/circle-types.mjs";
import { ProfileListItem } from "../../api/profile/profile-types.mjs";
import { DATABASE_CIRCLE, CIRCLE_TABLE_COLUMNS } from "../database/database-types.mjs";
import CIRCLE_ANNOUNCEMENT from "./circleAnnouncementModel.mjs";
import { PrayerRequestListItem } from "../../api/prayer-request/prayer-request-types.mjs";

/*******************************************
  UNIVERSAl circle for DATABASE OPERATIONS 
********************************************/
export default class CIRCLE implements BASE_MODEL  {
    modelType = 'CIRCLE';
    getID = () => this.circleID;
    setID = (id:number) => this.circleID = id;
    isValid: boolean = false;

    //Private static list of class property fields | (This is display-responses; NOT edit-access.)
    #publicPropertyList = ['circleID', 'leaderID', 'name', 'description', 'postalCode', 'image', 'requestorID', 'requestorStatus', 'leaderProfile', 'eventList'];
    #memberPropertyList = [...this.#publicPropertyList, 'announcementList', 'prayerRequestList', 'memberList', 'pendingRequestList', 'pendingInviteList'];
    #leaderPropertyList = [...this.#memberPropertyList, 'inviteToken'];
    #propertyList = [...this.#leaderPropertyList, 'notes'];

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
    requestorStatus: CircleStatus;
    leaderProfile?: ProfileListItem;
    announcementList: CIRCLE_ANNOUNCEMENT[] = [];
    eventList: CircleEventListItem[] = [];
    prayerRequestList: PrayerRequestListItem[] = [];
    memberList: ProfileListItem[] = [];
    pendingRequestList: ProfileListItem[] = [];
    pendingInviteList: ProfileListItem[] = [];

    constructor(DB?:DATABASE_CIRCLE, circleID?:number) {
        try {
            this.circleID = circleID || DB?.circleID || -1;

            if(DB !== undefined) {
                this.leaderID = DB.leaderID;
                this.name = DB.name;
                this.description = DB.description;
                this.postalCode = DB.postalCode;
                this.isActive = DB.isActive ? true : false;
                this.inviteToken = DB.inviteToken;
                this.image = DB.image;
                this.notes = DB.notes;

                this.isValid = true;
            }
        } catch(error) {
            log.db('INVALID Database Object; failed to parse CIRCLE', JSON.stringify(DB), error);
        }
    }

    /* PROPERTY FIELD UTILITIES */
    hasProperty = (field:string) => this.#propertyList.includes(field);

    getValidProperties = (properties:string[] = this.#propertyList, includeCircleID:boolean = true):Map<string, any> => {
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

    getDatabaseProperties = ():Map<string, any> => this.getUniqueDatabaseProperties(new CIRCLE());

    toJSON = ():DATABASE_CIRCLE => Object.fromEntries(this.getValidProperties(this.#propertyList)) as unknown as DATABASE_CIRCLE;

    toPublicJSON = ():DATABASE_CIRCLE => Object.fromEntries(this.getValidProperties(this.#publicPropertyList)) as unknown as DATABASE_CIRCLE;

    toMemberJSON = ():DATABASE_CIRCLE => Object.fromEntries(this.getValidProperties(this.#memberPropertyList)) as unknown as DATABASE_CIRCLE;

    toLeaderJSON = ():DATABASE_CIRCLE => Object.fromEntries(this.getValidProperties(this.#leaderPropertyList)) as unknown as DATABASE_CIRCLE;

    toListItem = ():CircleListItem => ({circleID: this.circleID, name: this.name, image: this.image});

    toString = ():string => JSON.stringify(Object.fromEntries(this.getValidProperties()));

    /** Utility methods for createModelFromJSON **/
    validateModelSpecificField = ({field, value}:{field:InputField, value:string}):boolean|undefined => {
        //No Field Match
        return undefined;
    }

    parseModelSpecificField = ({field, jsonObj}:{field:InputField, jsonObj:CircleEditRequest['body']}):boolean|undefined => {
        //Handle inviteToken for security
        if(field.field === 'inviteToken') {
            this.inviteToken = jsonObj[field.field];
            return true;
        }
        //No Field Match
        return undefined;
    }
};