import * as log from '../log.mjs';
import { DATABASE_USER, USER_TABLE_COLUMNS } from "../database/database-types.mjs";
import { CircleListItem } from "../../api/circle/circle-types.mjs";
import { GenderEnum, RoleEnum } from "../../api/profile/Fields-Sync/profile-field-config.mjs";
import { ProfileListItem, ProfileResponse, ProfilePublicResponse, ProfilePartnerResponse } from "../../api/profile/profile-types.mjs";

/*******************************************
UNIVERSAl profile for DATABASE OPERATIONS 
********************************************/
export default class USER {
  //Private static list of class property fields | (This is display-responses; NOT edit-access -> see: profile-field-config.mts)
  #publicPropertyList = ['userID', 'firstName', 'lastName', 'displayName', 'postalCode', 'dateOfBirth', 'gender', 'image', 'circleList', 'userRole'];
  #partnerPropertyList = [...this.#publicPropertyList, 'walkLevel', 'partnerList'];
  #propertyList = [...this.#partnerPropertyList, 'email', 'isActive', 'userRoleList'];

  userID: number = -1;
  firstName?: string;
  lastName?: string;
  displayName?: string;  //Unique
  email?: string;        //Unique
  passwordHash?: string;
  postalCode?: string;
  dateOfBirth?: Date;
  gender?: GenderEnum;
  isActive?: boolean;
  walkLevel?: number;
  image?: string;

  //Query separate Tables
  userRoleList: RoleEnum[] = [RoleEnum.STUDENT];
  circleList: CircleListItem[] = [];
  partnerList: ProfileListItem[] = [];


  constructor(DB?:DATABASE_USER, userID?:number) {
        try {
            this.userID = userID || DB.userID || -1;

            if(DB !== undefined) {
                this.firstName = DB.firstName;
                this.lastName = DB.lastName;
                this.displayName = DB.displayName;
                this.email = DB.email;
                this.passwordHash = DB.passwordHash;
                this.postalCode = DB.postalCode;
                this.dateOfBirth = DB.dateOfBirth;
                this.gender = GenderEnum[DB.gender];
                this.isActive = DB.isActive ? true : false;
                this.walkLevel = DB.walkLevel;
                this.image = DB.image;
                this.userRoleList = [RoleEnum[DB.userRole] || RoleEnum.STUDENT];
            }
        } catch(error) {
            log.db('INVALID Database Object; failed to parse USER', JSON.stringify(DB), error);
        }
  }

  /* USER ROLE UTILITIES */
  isRole = (userRole:RoleEnum):boolean => this.userRoleList.includes(userRole) || (this.userRoleList.length === 0 && userRole === RoleEnum.STUDENT);

  getHighestRole = ():RoleEnum => Object.values(RoleEnum).reverse()
                    .find((userRole, index) => (this.isRole(userRole as RoleEnum)))
                    || RoleEnum.STUDENT; //default
  

  /* List Utilities */
  getCircleIDList = ():number[] => this.circleList.map(c => c.circleID);

  getPartnerIDList = ():number[] => this.partnerList.map(p => p.userID);

  /* PROPERTY FIELD UTILITIES */
  hasProperty = (field:string) => this.#propertyList.includes(field);

  getValidProperties = (properties:string[] = this.#propertyList, includeUserID:boolean = true):Map<string, any> => {
      const map = new Map<string, any>();
      properties.filter((p) => (includeUserID || (p !== 'userID'))).forEach((field) => {
          if(field === 'userRole') 
            map.set(field, this.getHighestRole());
          
          else if(this.hasOwnProperty(field) && this[field] !== undefined && this[field] !== null
            && (!Array.isArray(this[field]) || this[field].length > 0)) 
                map.set(field, this[field]);
      });
      return map;
  }

  getUniqueDatabaseProperties = (profile:USER):Map<string, any> => {
    const map = new Map<string, any>();
    USER_TABLE_COLUMNS.filter((c) => ((c !== 'userID'))).forEach((field) => {
        if(this.hasOwnProperty(field) && this[field] !== undefined && this[field] !== null
            && ((Array.isArray(this[field]) 
                && (JSON.stringify(Array.from(this[field]).sort()) !== JSON.stringify(Array.from(profile[field]).sort()))) 
            || (this[field] !== profile[field]))) 
              map.set(field, this[field]);
    });
    return map;
  }

  toProfileJSON = ():ProfileResponse => Object.fromEntries(this.getValidProperties()) as unknown as ProfileResponse;

  toPublicJSON = ():ProfilePublicResponse => Object.fromEntries(this.getValidProperties(this.#publicPropertyList)) as unknown as ProfilePublicResponse;

  toPartnerJSON = ():ProfilePartnerResponse => Object.fromEntries(this.getValidProperties(this.#partnerPropertyList)) as unknown as ProfilePartnerResponse;

  toListItem = ():ProfileListItem => ({userID: this.userID, firstName: this.firstName, displayName: this.displayName, image: this.image});

  toString = ():string => JSON.stringify(Object.fromEntries(this.getValidProperties()));
};