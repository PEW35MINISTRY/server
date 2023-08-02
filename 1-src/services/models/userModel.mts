import * as log from '../log.mjs';
import { DATABASE_USER, USER_TABLE_COLUMNS } from "../database/database-types.mjs";
import { CircleListItem } from "../../api/circle/circle-types.mjs";
import { GenderEnum, InputField, InputType, RoleEnum, getDOBMaxDate, getDOBMinDate } from "./Fields-Sync/profile-field-config.mjs";
import { ProfileListItem, ProfileResponse, ProfilePublicResponse, ProfilePartnerResponse, ProfileEditRequest } from "../../api/profile/profile-types.mjs";
import BASE_MODEL from './baseModel.mjs';
import { getPasswordHash } from '../../api/auth/auth-utilities.mjs';

/*******************************************
UNIVERSAl profile for DATABASE OPERATIONS 
********************************************/
export default class USER implements BASE_MODEL {
  modelType = 'USER';
  getID = () => this.userID;

  //Private static list of class property fields | (This is display-responses; NOT edit-access -> see: profile-field-config.mts)
  #publicPropertyList = ['userID', 'firstName', 'lastName', 'displayName', 'postalCode', 'dateOfBirth', 'gender', 'image', 'circleList', 'userRole'];
  #partnerPropertyList = [...this.#publicPropertyList, 'walkLevel', 'partnerList'];
  #propertyList = [...this.#partnerPropertyList, 'email', 'isActive', 'notes', 'userRoleList'];

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
  notes?: string;

  //Query separate Tables
  userRoleList: RoleEnum[] = [RoleEnum.STUDENT];
  circleList: CircleListItem[] = [];
  partnerList: ProfileListItem[] = [];


  constructor(DB?:DATABASE_USER, userID?:number) {
        try {
            this.userID = userID || DB?.userID || -1;

            if(DB !== undefined) {
                this.firstName = DB.firstName;
                this.lastName = DB.lastName;
                this.displayName = DB.displayName;
                this.email = DB.email;
                this.passwordHash = DB.passwordHash;
                this.postalCode = DB.postalCode;
                this.dateOfBirth = DB.dateOfBirth;  //Date converted by MYSQL2
                this.gender = GenderEnum[DB.gender];
                this.isActive = DB.isActive ? true : false;
                this.walkLevel = DB.walkLevel as number;
                this.image = DB.image;
                this.notes = DB.notes;
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

          else if(field === 'userRoleList' && this.userRoleList.length === 0) 
            map.set(field, [this.getHighestRole()]);
          
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

  /** Utility methods for createModelFromJSON **/
  validateModelSpecificField = ({field, value}:{field:InputField, value:string}):boolean|undefined => {
    /* DATES | dateOfBirth */
    if(field.type === InputType.DATE && field.field === 'dateOfBirth') { //(Note: Assumes userRoleList has already been parsed or exists)
      const currentDate:Date = new Date(value);

      if(isNaN(currentDate.valueOf()) ||  currentDate < getDOBMinDate(this.getHighestRole()) || currentDate > getDOBMaxDate(this.getHighestRole()))
          return false;
    }

    //No Field Match
    return true;
  }

  parseModelSpecificField = ({field, jsonObj}:{field:InputField, jsonObj:ProfileEditRequest['body']}):boolean|undefined => {
    //Special Handling: Password Hash
    if(field.field === 'password' && jsonObj['password'] === jsonObj['passwordVerify']) {
      this.passwordHash = getPasswordHash(jsonObj['password']);
      return true;

    } else if(field.field === 'passwordVerify') { //valid Skip without error
      return true;

    } else if(field.field === 'userRoleTokenList') {
      this.userRoleList = Array.from(jsonObj[field.field] as {role:string, token:string}[]).map(({role, token}) => RoleEnum[role as string] || RoleEnum.STUDENT);
      return true;
    }

    //No Field Match
    return undefined;
  }

};