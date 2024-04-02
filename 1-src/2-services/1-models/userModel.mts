import { CircleListItem } from '../../0-assets/field-sync/api-type-sync/circle-types.mjs';
import { PrayerRequestListItem } from '../../0-assets/field-sync/api-type-sync/prayer-request-types.mjs';
import { PartnerListItem, ProfileListItem, ProfilePartnerResponse, ProfilePublicResponse, ProfileResponse } from '../../0-assets/field-sync/api-type-sync/profile-types.mjs';
import InputField, { InputSelectionField, InputType } from '../../0-assets/field-sync/input-config-sync/inputField.mjs';
import { GenderEnum, RoleEnum, getDOBMaxDate, getDOBMinDate } from '../../0-assets/field-sync/input-config-sync/profile-field-config.mjs';
import BiDirectionalMap from '../../0-assets/modules/BiDirectionalMap.mjs';
import { getPasswordHash } from '../../1-api/2-auth/auth-utilities.mjs';
import { ProfileEditRequest } from '../../1-api/3-profile/profile-types.mjs';
import { DATABASE_USER, USER_TABLE_COLUMNS } from '../2-database/database-types.mjs';
import * as log from '../log.mjs';
import BASE_MODEL from './baseModel.mjs';
import { JwtClientRequest } from '../../1-api/2-auth/auth-types.mjs';
import { Exception } from '../../1-api/api-types.mjs';



export default class USER extends BASE_MODEL<USER, ProfileListItem, ProfileResponse> {
  static modelType:string = 'USER';

  //Static list of class property fields | (This is display-responses; NOT edit-access -> see: profile-field-config.mts)
  static DATABASE_IDENTIFYING_PROPERTY_LIST = ['firstName', 'lastName', 'displayName', 'email']; //exclude: usedID, complex types, and lists
  static PUBLIC_PROPERTY_LIST = ['userID', 'firstName', 'lastName', 'displayName', 'postalCode', 'dateOfBirth', 'gender', 'image', 'circleList', 'userRole'];
  static PARTNER_PROPERTY_LIST = [...USER.PUBLIC_PROPERTY_LIST, 'walkLevel'];
  static USER_PROPERTY_LIST = [...USER.PARTNER_PROPERTY_LIST, 'email', 'isActive', 'maxPartners', 'notes', 'userRoleList', 'partnerList', 'pendingPartnerList', 'prayerRequestList', 'contactList', 'profileAccessList'];
  static PROPERTY_LIST = USER.USER_PROPERTY_LIST.filter(property => !property.endsWith('List'));

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
  maxPartners: number;
  image?: string;
  notes?: string;

  //Query separate Tables
  userRoleList: RoleEnum[] = [RoleEnum.STUDENT];
  circleList: CircleListItem[] = [];               //Includes all status: MEMBER|INVITE|REQUEST|LEADER
  partnerList: PartnerListItem[] = [];
  pendingPartnerList: PartnerListItem[] = [];
  prayerRequestList: PrayerRequestListItem[] = [];
  contactList: ProfileListItem[] = [];
  profileAccessList: ProfileListItem[] = []; //Leaders

  //Used as error case or blank
  constructor(id:number = -1) {
    super(id);
  }

  override getNewInstance = (id:number = -1) => new USER(id);

 /*******************
  * MODEL UTILITIES *
  *******************/  
  /* USER ROLE UTILITIES */
  isRole = (userRole:RoleEnum):boolean => this.userRoleList.includes(userRole) || (this.userRoleList.length === 0 && userRole === RoleEnum.STUDENT);

  getHighestRole = ():RoleEnum => Object.values(RoleEnum).reverse()
                     .find((userRole) => (this.isRole(userRole as RoleEnum)))
                     || RoleEnum.STUDENT; //default
    
  /* List Utilities */
  getCircleIDList = ():number[] => this.circleList.map(c => c.circleID);
 
  getPartnerIDList = ():number[] => this.partnerList.map(p => p.userID);
 
  getContactIDList = ():number[] => this.contactList.map(u => u.userID);
 
  getProfileAccessIDList = ():number[] => this.profileAccessList.map(u => u.userID); 


 /*********************
  * DEFINE PROPERTIES *
  *********************/
  override get modelType():string { return USER.modelType; }
  override get IDProperty():string { return 'userID'; }

  override get DATABASE_COLUMN_LIST():string[] { return [...USER_TABLE_COLUMNS, 'userRole']; }
  override get DATABASE_IDENTIFYING_PROPERTY_LIST():string[] { return USER.DATABASE_IDENTIFYING_PROPERTY_LIST; }
  override get PROPERTY_LIST():string[] { return USER.PROPERTY_LIST; }

  override get jsonToModelMapping():BiDirectionalMap<string> { return new BiDirectionalMap([
          ['userRoleTokenList', 'userRoleList'],
          ['password', 'passwordHash']
        ]);}

  override get priorityInputList():string[] { return ['userID', 'userRole', 'userRoleList', 'dateOfBirth', 'password', 'passwordVerify', 'passwordHash']; }

  
/**********************************
 * ADDITIONAL STATIC CONSTRUCTORS *
 **********************************/
 static constructByDatabase = (DB:DATABASE_USER):USER => 
    BASE_MODEL.constructByDatabaseUtility<USER>({DB, newModel: new USER(DB.userID || -1), defaultModel: new USER(),
      complexColumnMap: new Map([
        ['gender', (DB:DATABASE_USER, newUser:USER) => {newUser.gender = GenderEnum[DB.gender]}],
        ['userRole', (DB:DATABASE_USER, newUser:USER) => {newUser.userRoleList = [RoleEnum[DB.userRole] || RoleEnum.STUDENT];}],
        ['passwordHash', (DB:DATABASE_USER, newUser:USER) => {newUser.passwordHash = DB.passwordHash;}],
      ])});

  //override | Clone database model values only (not copying references for ListItems)
  static constructByClone = (profile: USER):USER => 
    BASE_MODEL.constructByCloneUtility<USER>({currentModel: profile, newModel: new USER(profile.userID || -1), defaultModel: new USER(), propertyList: USER.PROPERTY_LIST,
      complexPropertyMap: new Map([
        ['gender', (currentUser:USER, newUser:USER) => {newUser.gender = GenderEnum[currentUser.gender]}],
        ['passwordHash', (currentUser:USER, newUser:USER) => {newUser.passwordHash = currentUser.passwordHash;}],
      ])});

   override constructByClone = <USER,>():USER => USER.constructByClone(this) as USER;

   static constructByJson = <USER,>({jsonObj, fieldList}:{jsonObj:JwtClientRequest['body'], fieldList:InputField[]}):USER|Exception => 
            new USER().populateFromJson({jsonObj, fieldList}) as USER|Exception;


  /**********************
  * PROPERTY UTILITIES *
  **********************/  
  override getValidProperties = (properties:string[] = USER.USER_PROPERTY_LIST, includeUserID:boolean = true):Map<string, any> => {
    const complexFieldMap = new Map();
    complexFieldMap.set('userRole', (model:USER, baseModel:USER) => model.getHighestRole());
    complexFieldMap.set('userRoleList', (model:USER, baseModel:USER) => (model.userRoleList.length === 0) ? [model.getHighestRole()] : model.userRoleList);
    complexFieldMap.set('dateOfBirth', (model:USER, baseModel:USER) => model.dateOfBirth.toISOString());
    complexFieldMap.set('passwordHash', (model:USER, baseModel:USER) => model.passwordHash);

    return BASE_MODEL.getUniquePropertiesUtility<USER>({fieldList: properties, getModelProperty: (property) => property,
      model: this, baseModel: undefined, includeID: includeUserID, includeObjects: true, includeNull: false, complexFieldMap});
  }

  static getUniqueDatabaseProperties = (model:USER, baseModel:USER):Map<string, any> =>
    BASE_MODEL.getUniquePropertiesUtility<USER>({fieldList: USER_TABLE_COLUMNS, getModelProperty: (column) => model.getPropertyFromDatabaseColumn(column) ? column : undefined,
      model, baseModel, includeID: false, includeObjects: false, includeNull: true,
      complexFieldMap: new Map([
        ['passwordHash', (model:USER, baseModel:USER) => { return (model.passwordHash !== baseModel.passwordHash) ? model.passwordHash : undefined; }],
      ])});

  override getUniqueDatabaseProperties = (baseModel:USER):Map<string, any> => USER.getUniqueDatabaseProperties(this, baseModel);

  toPublicJSON = ():ProfilePublicResponse => Object.fromEntries(this.getValidProperties(USER.PUBLIC_PROPERTY_LIST)) as ProfilePublicResponse;

  toPartnerJSON = ():ProfilePartnerResponse => Object.fromEntries(this.getValidProperties(USER.PARTNER_PROPERTY_LIST)) as ProfilePartnerResponse;

  override  toListItem = ():ProfileListItem => ({userID: this.userID, firstName: this.firstName, displayName: this.displayName, image: this.image});


  /****************************************
  * constructByJson Model Custom Handling *
  *****************************************/  
  override validateModelSpecificField = ({field, value, jsonObj}:{field:InputField, value:string, jsonObj:ProfileEditRequest['body']}):boolean|undefined => {
    /* DATES | dateOfBirth */
    if(field.type === InputType.DATE && field.field === 'dateOfBirth') { //(Note: Assumes userRoleList has already been parsed or exists)     
      const currentDate:Date = new Date(value);
      if(isNaN(currentDate.valueOf()) || currentDate < getDOBMinDate(this.getHighestRole()) || currentDate > getDOBMaxDate(this.getHighestRole())) {
        log.warn(`User dateOfBirth validation failed: ${value} with current role: ${this.getHighestRole()}`, currentDate.toISOString(), getDOBMinDate(this.getHighestRole()).toISOString(), getDOBMaxDate(this.getHighestRole()).toISOString())
        return false;
      } else return true;

    } else if ((field.field === 'userRoleTokenList') && (field instanceof InputSelectionField)) {
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

  override parseModelSpecificField = ({field, jsonObj}:{field:InputField, jsonObj:ProfileEditRequest['body'] }):boolean|undefined => {
    //Special Handling: Password Hash
    if(field.field === 'password' && jsonObj['password'] === jsonObj['passwordVerify']) {
        this.passwordHash = getPasswordHash(jsonObj['password']);

    } else if(field.field === 'passwordVerify') { //valid Skip without error
        return true;

    } else if(field.field === 'userRoleTokenList') {
        this.userRoleList = Array.from(jsonObj[field.field] as {role:string, token:string}[]).map(({role, token}) => RoleEnum[role as string] || RoleEnum.STUDENT);

    } else if(field.field === 'userRoleList') {
        this.userRoleList = Array.from(jsonObj[field.field] as string[]).map(role => RoleEnum[role as string]);

    } else if(field.field === 'gender') {
        this.gender = GenderEnum[jsonObj[field.field]];

    } else if(field.field === 'walkLevel') {
        this.walkLevel = parseInt(jsonObj[String(field.field)]);

    } else if(['displayName', 'email'].includes(field.field)) { //Lowercase
        this[field.field] = (String(jsonObj[field.field]) || '').toLowerCase();

    } else //No Field Match
        return undefined;

    return true;
  }
};
