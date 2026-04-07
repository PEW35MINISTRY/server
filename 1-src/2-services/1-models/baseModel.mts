import BiDirectionalMap from '../../0-assets/modules/BiDirectionalMap.mjs';
import InputField from '../../0-assets/field-sync/input-config-sync/inputField.mjs';
import { JwtClientRequest, JwtRequest } from '../../1-api/2-auth/auth-types.mjs';
import { Exception } from '../../1-api/api-types.mjs';
import BASE_MODEL_UTILITY from './baseModelUtility.mjs';


/****************************************
  Base Model for Default Functionality 
  - overwrite methods when necessary-
  - Does not fully implement BASE_MODEL
*****************************************/
export default abstract class BASE_MODEL<Model, ListItem, JsonResponse> {
    isValid:boolean = false;

    constructor(id = -1) {
      this.ID = id;
    }

   /**********************************************
    * UNIQUE DEFINING PROPERTIES & CUSTOMIZATION *
    **********************************************/  
    abstract getNewInstance:(id?:number) => Model;

    abstract get modelType():string;   
    abstract get IDProperty():string;
    get ID():number { return this[this.IDProperty]; }
    set ID(id:number) { this[this.IDProperty] = id; }

    /* Must Override Property Lists */        
    abstract get DATABASE_COLUMN_LIST():string[];                 //Read DB Columns
    abstract get DATABASE_COLUMN_EDIT_LIST():string[];            //Editable DB Columns
    abstract get DATABASE_IDENTIFYING_PROPERTY_LIST():string[];   //Unique DB Columns that are searchable
    abstract get PROPERTY_LIST():string[];                        //All Model Properties (May write to model from JSON, if also in input config)

    /* Optional: Override Ordering for dependent properties | Includes all: model, json, and database properties */
    #priorityInputList:string[] = [];
    get priorityInputList():string[] { return this.#priorityInputList; }

    /* Optional: Override Custom Mapping | Defaults to Identical */
    #jsonToModelMapping:BiDirectionalMap<string> = new BiDirectionalMap<string>();
    #databaseToModelMapping:BiDirectionalMap<string> = new BiDirectionalMap<string>();
    get jsonToModelMapping():BiDirectionalMap<string> { return this.#jsonToModelMapping; }
    get databaseToModelMapping():BiDirectionalMap<string> { return this.#databaseToModelMapping; }


   /**********************
    * PROPERTY UTILITIES *
    **********************/  
    hasProperty = (property:string) => this.PROPERTY_LIST.includes(property);

    isIDProperty = (property:string, value:number):boolean => this.hasProperty(property) && property.toUpperCase().includes('ID') && (value === this.ID);
   
    // abstract getValidProperties:(properties:string[], includeID:boolean) => Map<string, any>;

    getValidProperties = (properties:string[] = this.PROPERTY_LIST, includeUserID:boolean = true):Map<string, any> =>
      BASE_MODEL.getUniquePropertiesUtility<BASE_MODEL<Model, ListItem, JsonResponse>>({fieldList: properties, getModelProperty: (property) => property,
          model: this, baseModel: undefined, includeID: includeUserID, includeObjects: true, includeNull: false, complexFieldMap: new Map()});
  
    getDatabaseProperties = ():Map<string, any> => this.getValidProperties(this.DATABASE_COLUMN_EDIT_LIST, false);

    static getUniqueDatabasePropertiesDefault = <M extends BASE_MODEL<any, any, any>>(model:M, baseModel:M):Map<string, any> =>
      BASE_MODEL.getUniquePropertiesUtility<M>({fieldList: model.DATABASE_COLUMN_EDIT_LIST, getModelProperty: (column) => model.getPropertyFromDatabaseColumn(column) ? column : undefined,
          model, baseModel, includeID: false, includeObjects: false, includeNull: true});

    getUniqueDatabaseProperties = (baseModel:this):Map<string, any> => (this.constructor as typeof BASE_MODEL).getUniqueDatabasePropertiesDefault(this, baseModel);
  
    getDatabaseIdentifyingProperties = ():Map<string, any> => this.getValidProperties(this.DATABASE_IDENTIFYING_PROPERTY_LIST, false);
    
    toListItem = ():ListItem => this.toJSON() as unknown as ListItem;

    toJSON = ():JsonResponse => Object.fromEntries(this.getValidProperties()) as JsonResponse;
    
    toString = ():string => JSON.stringify(this.toJSON());
 

   /*********************************************
    * STATIC | ADDITIONAl CONSTRUCTOR UTILITIES *
    * - Must be Redefined to customize          *
    *********************************************/  
    static constructByDatabaseUtility = BASE_MODEL_UTILITY.constructByDatabaseUtility;

    //Clone database model values only (not copying references for ListItems)
    static constructByCloneUtility = BASE_MODEL_UTILITY.constructByCloneUtility;

    static constructByCloneDefault = <M extends BASE_MODEL<any, any, any>>(model:M):M =>
      BASE_MODEL.constructByCloneUtility<M>({currentModel: model, newModel: model.getNewInstance(model.ID), defaultModel: model.getNewInstance(), propertyList: model.PROPERTY_LIST});

    constructByClone = ():this => (this.constructor as typeof BASE_MODEL).constructByCloneDefault(this) as this;

    static getUniquePropertiesUtility = BASE_MODEL_UTILITY.getUniquePropertiesUtility;

    static constructAndEvaluateByJson = BASE_MODEL_UTILITY.constructByJson; //Checks required field in currentModel

    populateFromJson = async<T extends BASE_MODEL<any, any, any>>({jsonObj, fieldList}:{jsonObj:JwtClientRequest['body'], fieldList:InputField[]}):Promise<Exception | T> => 
        BASE_MODEL_UTILITY.constructByJson({currentModel: this, jsonObj, fieldList}) as Promise<Exception | T>;
     

    /****************************************
    * constructByJson Model Custom Handling *
    *****************************************/  
    validateModelSpecificField = async({field, value, jsonObj}:{field:InputField, value:string, jsonObj:JwtRequest['body']}):Promise<boolean|undefined> => undefined;
    
    parseModelSpecificField = async({field, jsonObj}:{field:InputField, jsonObj:JwtRequest['body']}):Promise<boolean|undefined> => undefined;
 

    /****************************************
    * PROPERTY NAME MAPPING UTILITIES      *
    * override: get jsonToModelMapping     *
    * override: get databaseToModelMapping *
    ****************************************/  
    getPropertyFromJsonField = (jsonField:string, fallbackToField:boolean = true):string|undefined => 
       this.jsonToModelMapping.getByKey(jsonField) ?? (fallbackToField && this.PROPERTY_LIST.includes(jsonField) ? jsonField : undefined);
   
     getJsonField = (property:string, fallbackToProperty:boolean = true):string|undefined => 
       this.jsonToModelMapping.getByValue(property) ?? (fallbackToProperty && this.PROPERTY_LIST.includes(property) ? property : undefined);
   
     getPropertyFromDatabaseColumn = (databaseColumn:string, fallbackToColumn:boolean = true):string|undefined => 
       this.databaseToModelMapping.getByKey(databaseColumn) ?? (fallbackToColumn && this.PROPERTY_LIST.includes(databaseColumn) ? databaseColumn : undefined);
   
     getDatabaseColumn = (property:string, fallbackToProperty:boolean = true):string|undefined => 
       this.databaseToModelMapping.getByValue(property) ?? (fallbackToProperty && this.DATABASE_COLUMN_LIST.includes(property) ? property : undefined);
     
     //Supports generic: propertyList:string[] or fieldList:InputField[] with (inputField) => inputField.field
     prioritySortFieldList = <T,>(fieldList:T[], getProperty:(field:T)=>string = (field)=>(field as unknown as string)):T[] => 
         (this.priorityInputList.length === 0) ? fieldList
         : fieldList.sort((a:T, b:T) => {
             const aIndex:number = this.priorityInputList.indexOf(getProperty(a));
             const bIndex:number = this.priorityInputList.indexOf(getProperty(b));
 
             return (aIndex !== -1) && (bIndex !== -1) ? (aIndex - bIndex) 
                 : (aIndex !== -1) ? -1 
                 : (bIndex !== -1) ? 1 
                 : fieldList.indexOf(a) - fieldList.indexOf(b);
        });
}
