import { CircleListItem } from '../../0-assets/field-sync/api-type-sync/circle-types.mjs';
import { PrayerRequestListItem } from '../../0-assets/field-sync/api-type-sync/prayer-request-types.mjs';
import { ProfileListItem, ProfilePartnerResponse, ProfilePublicResponse, ProfileResponse } from '../../0-assets/field-sync/api-type-sync/profile-types.mjs';
import InputField, { InputType } from '../../0-assets/field-sync/input-config-sync/inputField.mjs';
import { GenderEnum, RoleEnum, getDOBMaxDate, getDOBMinDate } from '../../0-assets/field-sync/input-config-sync/profile-field-config.mjs';
import { getPasswordHash } from '../../1-api/2-auth/auth-utilities.mjs';
import { ProfileEditRequest } from '../../1-api/3-profile/profile-types.mjs';
import { DATABASE_USER, USER_TABLE_COLUMNS } from '../2-database/database-types.mjs';
import * as log from '../log.mjs';
import BASE_MODEL from './baseModel.mjs';


/*******************************************
UNIVERSAl profile for DATABASE OPERATIONS 
********************************************/
export default class USER implements BASE_MODEL {
  modelType = 'USER';
  getID = () => this.userID;
  setID = (id:number) => this.userID = id;
  isValid: boolean = false;

  //Private static list of class property fields | (This is display-responses; NOT edit-access -> see: profile-field-config.mts)
  static #databaseIdentifyingPropertyList = ['firstName', 'lastName', 'displayName', 'email']; //exclude: usedID, complex types, and lists
  static #publicPropertyList = ['userID', 'firstName', 'lastName', 'displayName', 'postalCode', 'dateOfBirth', 'gender', 'image', 'circleList', 'userRole'];
  static #partnerPropertyList = [...USER.#publicPropertyList, 'walkLevel'];
  static #userPropertyList = [...USER.#partnerPropertyList, 'email', 'isActive', 'notes', 'userRoleList', 'partnerList', 'prayerRequestList', 'contactList', 'profileAccessList'];
  static #propertyList = USER.#userPropertyList.filter(property => !['circleList', 'partnerList', 'prayerRequestList', 'contactList'].includes(property)); //Not Edited through Model

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
  circleList: CircleListItem[] = [];               //Includes all status: MEMBER|INVITE|REQUEST|LEADER
  partnerList: ProfileListItem[] = [];
  prayerRequestList: PrayerRequestListItem[] = [];
  contactList: ProfileListItem[] = [];
  profileAccessList: ProfileListItem[] = []; //Leaders

  //Used as error case or blank
  constructor(id: number = -1) {
    this.userID = id;
    this.isValid = false;
  }

  static constructByDatabase = (DB:DATABASE_USER): USER => {
    try {
      const newUSER: USER = new USER(DB.userID || -1);

      newUSER.firstName = DB.firstName;
      newUSER.lastName = DB.lastName;
      newUSER.displayName = DB.displayName;
      newUSER.email = DB.email;
      newUSER.passwordHash = DB.passwordHash;
      newUSER.postalCode = DB.postalCode;
      newUSER.dateOfBirth = DB.dateOfBirth;  //Date converted by MYSQL2
      newUSER.gender = GenderEnum[DB.gender];
      newUSER.isActive = DB.isActive ? true : false;
      newUSER.walkLevel = DB.walkLevel as number;
      newUSER.image = DB.image;
      newUSER.notes = DB.notes;
      newUSER.userRoleList = [RoleEnum[DB.userRole] || RoleEnum.STUDENT];
      newUSER.isValid = true;

      return newUSER;

    } catch (error) {
      log.db('INVALID Database Object; failed to parse USER', JSON.stringify(DB), error);
      return new USER();
    }
  }

  //Clone database model values only (not copying references for ListItems)
  static constructByClone = (profile: USER): USER => {
    try { //MUST copy primitives properties directly and create new complex types to avoid reference linking
      const newUSER: USER = new USER(profile.userID);

      if(newUSER.userID > 0) {
        newUSER.firstName = profile.firstName;
        newUSER.lastName = profile.lastName;
        newUSER.displayName = profile.displayName;
        newUSER.email = profile.email;
        newUSER.passwordHash = profile.passwordHash;
        newUSER.postalCode = profile.postalCode;
        newUSER.dateOfBirth = new Date(profile.dateOfBirth?.getTime());
        newUSER.gender = GenderEnum[profile.gender];
        newUSER.isActive = profile.isActive;
        newUSER.walkLevel = profile.walkLevel;
        newUSER.image = profile.image;
        newUSER.notes = profile.notes;
        newUSER.userRoleList = [...profile.userRoleList];
        newUSER.isValid = true;
      }

      return newUSER;

    } catch (error) {
      log.error('INVALID Object; failed to clone USER', JSON.stringify(profile), error);
      return new USER();
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
 
   getContactIDList = ():number[] => this.contactList.map(u => u.userID);
 
   getProfileAccessIDList = ():number[] => this.profileAccessList.map(u => u.userID); 

  /* PROPERTY FIELD UTILITIES */
  static hasProperty = (field:string) => USER.#propertyList.includes(field);
  hasProperty = (field: string) => USER.#propertyList.includes(field);  //Defined in BASE_MODEL; used for JSON parsing

  getValidProperties = (properties:string[] = USER.#userPropertyList, includeUserID:boolean = true):Map<string, any> => {
    const map = new Map<string, any>();
    properties.filter((p) => (includeUserID || (p !== 'userID'))).forEach((field) => {
        if(field === 'userRole') 
          map.set(field, this.getHighestRole());

        else if(field === 'userRoleList' && this.userRoleList.length === 0) 
          map.set(field, [this.getHighestRole()]);
        
        else if(this.hasOwnProperty(field) && this[field] !== undefined && this[field] !== null
          && (!Array.isArray(this[field]) || this[field].length > 0)) {
            if(field === 'dateOfBirth')
                map.set(field, this.dateOfBirth.toISOString());
            else
                map.set(field, this[field]);
          }
    });
    return map;
  }

  static getUniqueDatabaseProperties = (editProfile:USER, currentProfile:USER):Map<string, any> => {
    const map = new Map<string, any>();
    USER_TABLE_COLUMNS.filter((c) => ((c !== 'userID'))).forEach((field) => {
      if (field === 'dateOfBirth') { //Must compare dates as numbers
        if (editProfile.dateOfBirth.getTime() !== currentProfile.dateOfBirth.getTime())
          map.set(field, editProfile[field]);

      } else if (editProfile.hasOwnProperty(field) && editProfile[field] !== undefined && editProfile[field] !== null
        && ((Array.isArray(editProfile[field])
          && (JSON.stringify(Array.from(editProfile[field]).sort()) !== JSON.stringify(Array.from(currentProfile[field]).sort())))
          || (editProfile[field] !== currentProfile[field])))
                map.set(field, editProfile[field]);
    });
    return map;
  }

  getDatabaseProperties = ():Map<string, any> => this.getValidProperties(USER_TABLE_COLUMNS, false);

  getDatabaseIdentifyingProperties = ():Map<string, any> => this.getValidProperties(USER.#databaseIdentifyingPropertyList, false);

  toJSON = ():ProfileResponse => Object.fromEntries(this.getValidProperties(USER.#userPropertyList)) as unknown as ProfileResponse;

  toPublicJSON = ():ProfilePublicResponse => Object.fromEntries(this.getValidProperties(USER.#publicPropertyList)) as unknown as ProfilePublicResponse;

  toPartnerJSON = ():ProfilePartnerResponse => Object.fromEntries(this.getValidProperties(USER.#partnerPropertyList)) as unknown as ProfilePartnerResponse;

  toListItem = ():ProfileListItem => ({userID: this.userID, firstName: this.firstName, displayName: this.displayName, image: this.image});

  toString = ():string => JSON.stringify(Object.fromEntries(this.getValidProperties()));

  /** Utility methods for createModelFromJSON **/
  validateModelSpecificField = ({field, value}:{field:InputField, value:string}):boolean|undefined => {
    /* DATES | dateOfBirth */
    if(field.type === InputType.DATE && field.field === 'dateOfBirth') { //(Note: Assumes userRoleList has already been parsed or exists)
      const currentDate:Date = new Date(value);

      if(isNaN(currentDate.valueOf()) || currentDate < getDOBMinDate(this.getHighestRole()) || currentDate > getDOBMaxDate(this.getHighestRole()))
        return false;
      else return true;

    } else if (field.field === 'userRoleTokenList') {
      return (Array.isArray(value)
        && Array.from(value).every((roleTokenObj:{role:string, token:string}) => {

          if(roleTokenObj.role === undefined
            || (roleTokenObj.role.length === 0)
            || !Object.values(RoleEnum).includes(roleTokenObj.role as RoleEnum)
            || roleTokenObj.token === undefined) { //token allowed to be empty string for STUDENT

            log.warn(`Validating error for userRoleTokenList:`, JSON.stringify(roleTokenObj), JSON.stringify(field.selectOptionList));
            return false;
          } else return true;
        }));
    }

    //No Field Match
    return undefined;
  }

  parseModelSpecificField = ({field, jsonObj}:{field:InputField, jsonObj:ProfileEditRequest['body'] }):boolean|undefined => {
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