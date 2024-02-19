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
export default abstract class BASE_MODEL {
    isValid:boolean = false;

   /**********************************************
    * UNIQUE DEFINING PROPERTIES & CUSTOMIZATION *
    **********************************************/  
    abstract get modelType():string;    
    abstract get ID():number;
    abstract set ID(id:number);

    /* Must Override Property Lists */        
    abstract get databaseTableColumnList():string[];
    abstract get databaseIdentifyingPropertyList():string[];
    abstract get propertyList():string[];

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
    hasProperty = (property:string) => this.propertyList.includes(property);

    isIDProperty = (property:string, value:number):boolean => this.hasProperty(property) && property.toUpperCase().includes('ID') && (value === this.ID);
   
    abstract getValidProperties:(properties:string[], includeID:boolean) => Map<string, any>;
  
    getDatabaseProperties = ():Map<string, any> => this.getValidProperties(this.databaseTableColumnList, false);

    abstract getUniqueDatabaseProperties:(baseModel:BASE_MODEL) => Map<string, any>;
  
    getDatabaseIdentifyingProperties = ():Map<string, any> => this.getValidProperties(this.databaseIdentifyingPropertyList, false);
  
    toJSON = () => Object.fromEntries(this.getValidProperties(this.propertyList, true));
  
    abstract toListItem: () => {};
    
    toString = ():string => JSON.stringify(this.toJSON());
 

   /*********************************************
    * STATIC | ADDITIONAl CONSTRUCTOR UTILITIES *
    * - Must be Redefined to customize          *
    *********************************************/  
    static constructByDatabaseUtility = BASE_MODEL_UTILITY.constructByDatabaseUtility;
   
    //Clone database model values only (not copying references for ListItems)
    static constructByCloneUtility = BASE_MODEL_UTILITY.constructByCloneUtility;

    abstract constructByClone<T extends BASE_MODEL>(): T;

    static getUniquePropertiesUtility = BASE_MODEL_UTILITY.getUniquePropertiesUtility;

    static constructAndEvaluateByJson = BASE_MODEL_UTILITY.constructByJson; //Checks required field in currentModel

    populateFromJson = <T extends BASE_MODEL>({jsonObj, fieldList}:{jsonObj:JwtClientRequest['body'], fieldList:InputField[]}):T|Exception => 
        BASE_MODEL_UTILITY.constructByJson({currentModel: this, jsonObj, fieldList}) as T|Exception;
     

    /****************************************
    * constructByJson Model Custom Handling *
    *****************************************/  
    validateModelSpecificField = ({field, value, jsonObj}:{field:InputField, value:string, jsonObj:JwtRequest['body']}):boolean|undefined => undefined;
    
    parseModelSpecificField = ({field, jsonObj}:{field:InputField, jsonObj:JwtRequest['body']}):boolean|undefined => undefined;
 

    /****************************************
    * PROPERTY NAME MAPPING UTILITIES      *
    * override: get jsonToModelMapping     *
    * override: get databaseToModelMapping *
    ****************************************/  
    getPropertyFromJsonField = (jsonField:string, fallbackToField:boolean = true):string|undefined => 
       this.jsonToModelMapping.getByKey(jsonField) ?? (fallbackToField && this.propertyList.includes(jsonField) ? jsonField : undefined);
   
     getJsonField = (property:string, fallbackToProperty:boolean = true):string|undefined => 
       this.jsonToModelMapping.getByValue(property) ?? (fallbackToProperty && this.propertyList.includes(property) ? property : undefined);
   
     getPropertyFromDatabaseColumn = (databaseColumn:string, fallbackToColumn:boolean = true):string|undefined => 
       this.databaseToModelMapping.getByKey(databaseColumn) ?? (fallbackToColumn && this.propertyList.includes(databaseColumn) ? databaseColumn : undefined);
   
     getDatabaseColumn = (property:string, fallbackToProperty:boolean = true):string|undefined => 
       this.databaseToModelMapping.getByValue(property) ?? (fallbackToProperty && this.databaseTableColumnList.includes(property) ? property : undefined);
     
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
