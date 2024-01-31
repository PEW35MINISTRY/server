import BiDirectionalMap from '../../0-assets/modules/BiDirectionalMap.mjs';
import InputField from '../../0-assets/field-sync/input-config-sync/inputField.mjs';
import { JwtRequest } from '../../1-api/2-auth/auth-types.mjs';
import * as log from '../log.mjs';


/****************************************
  Core Model for Default Functionality 
  - overwrite methods when necessary-
  - Does not fully implement BASE_MODEL
*****************************************/
export default abstract class CORE_MODEL {
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


   /********************************
    * CONSTRUCTOR & INITIALIZATION *
    ********************************/
    constructor() { }

   /**********************
    * PROPERTY UTILITIES *
    **********************/  
    hasProperty = (property:string) => this.propertyList.includes(property);

    isIDProperty = (property:string, value:number):boolean => this.hasProperty(property) && property.toUpperCase().includes('ID') && (value === this.ID);
   
    abstract getValidProperties:(properties:string[], includeID:boolean) => Map<string, any>;
  
    getDatabaseProperties = ():Map<string, any> => this.getValidProperties(this.databaseTableColumnList, false);
  
    getDatabaseIdentifyingProperties = ():Map<string, any> => this.getValidProperties(this.databaseIdentifyingPropertyList, false);
  
    toJSON = () => Object.fromEntries(this.getValidProperties(this.propertyList, true));
  
    abstract toListItem: () => {};
    
    toString = ():string => JSON.stringify(Object.fromEntries(this.getValidProperties(this.propertyList, true)));
 

   /***********************************
    * PROPERTY NAME MAPPING UTILITIES *
    * Defined: jsonToModelMapping     *
    * Defined: databaseToModelMapping *
    ***********************************/  
    getPropertyFromJsonField = (jsonField:string, fallbackToField:boolean = true):string|undefined => 
      this.jsonToModelMapping.getByKey(jsonField) ?? (fallbackToField && this.propertyList.includes(jsonField) ? jsonField : undefined);
  
    getJsonField = (property:string, fallbackToProperty:boolean = true):string|undefined => 
      this.jsonToModelMapping.getByValue(property) ?? (fallbackToProperty && this.propertyList.includes(property) ? property : undefined);
  
    getPropertyFromDatabaseColumn = (databaseColumn:string, fallbackToColumn:boolean = true):string|undefined => 
      this.databaseToModelMapping.getByKey(databaseColumn) ?? (fallbackToColumn && this.propertyList.includes(databaseColumn) ? databaseColumn : undefined);
  
    getDatabaseColumn = (property:string, fallbackToProperty:boolean = true):string|undefined => 
      this.databaseToModelMapping.getByValue(property) ?? (fallbackToProperty && this.databaseTableColumnList.includes(property) ? property : undefined);
    

   /*********************************
    * createModelFromJSON UTILITIES *
    *********************************/  
   validateModelSpecificField = ({field, value, jsonObj}:{field:InputField, value:string, jsonObj:JwtRequest['body']}):boolean|undefined => undefined;
  
   parseModelSpecificField = ({field, jsonObj}:{field:InputField, jsonObj:JwtRequest['body']}):boolean|undefined => undefined;
 
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


   /*********************************************
    * STATIC | ADDITIONAl CONSTRUCTOR UTILITIES *
    * - Must be Redefined to customize          *
    *********************************************/  
    //MUST copy primitives properties directly and create new complex types to avoid reference linking
    //Use 'complexColumnMap' to skip columns: ()=>{}
    static constructByDatabaseUtility = <T extends CORE_MODEL>({ DB, newModel, defaultModel, complexColumnMap = new Map() }
                                                                : { DB:any; newModel:T; defaultModel:T; complexColumnMap?:Map<string, (DB:any, newModel:T) => void|Error> }):T => {
      try {
        if(DB === undefined) throw new Error('Undefined Database Object');
  
        for(const column of newModel.prioritySortFieldList(newModel.databaseTableColumnList)) {
            const property:string|undefined = newModel.getPropertyFromDatabaseColumn(column, true);
  
            if(property === undefined && !complexColumnMap.has(column))
                log.db(`CORE_MODEL.constructByDatabaseUtility | Skipping column found in databaseTableColumnList, advise updating complexColumnMap to skip in ${newModel.modelType}.`, column);
          
            const databaseValue = DB[column];
            if(databaseValue !== undefined && databaseValue !== null) {
                if(complexColumnMap.has(column))
                    complexColumnMap.get(column)(DB, newModel);

                //Handling primitive direct assignment only, without casting
                else if(typeof databaseValue === 'string' || typeof databaseValue === 'number' || typeof databaseValue === 'boolean')
                    newModel[property] = databaseValue;

                else if(databaseValue instanceof Date)
                newModel[property] = new Date(databaseValue.getTime());

                else //(typeof databaseValue === 'object' || typeof databaseValue === 'function')
                    log.db(`CORE_MODEL.constructByDatabaseUtility | Skipping unhandled complex type, advise updating complexColumnMap in ${newModel.modelType}.`, column, databaseValue, (typeof databaseValue));
            }
        }
        newModel.isValid = true;
        return newModel;
  
      } catch (error) {
        log.db(`CORE_MODEL.constructByDatabaseUtility | Error parsing Database object for ${defaultModel.modelType}.`, JSON.stringify(DB), error);
        return defaultModel;
      }
    }


    //Clone database model values only (not copying references for ListItems)
    static constructByCloneUtility = <T extends CORE_MODEL>({ currentModel, newModel, defaultModel, propertyList, complexPropertyMap = new Map() }
                                                            : { currentModel:T; newModel:T; defaultModel:T; propertyList:string[]; complexPropertyMap?:Map<string, (currentModel:T, newModel:T) => void|Error> }):T => {
        try {   
          for(const property of currentModel.prioritySortFieldList(propertyList)) {
            const currentValue = currentModel[property];

            if(currentValue === undefined) //Must protect 'typeof'
                continue;

            else if(currentValue === null)
                newModel[property] = null;

            if(complexPropertyMap.has(property))
            complexPropertyMap.get(property)(currentModel, newModel);
    
            //Handling primitive direct assignment only, without casting
            else if((typeof currentValue === 'string') || (typeof currentValue === 'number') || (typeof currentValue === 'boolean'))
                newModel[property] = currentValue;

            else if(Array.isArray(currentValue) && (Array.from(currentValue).length > 0))
                newModel[property] = Array.from(currentValue);

            else if(currentValue instanceof Date)
                newModel[property] = new Date(currentValue.getTime());

            else //(typeof currentValue === 'object'
                log.db(`CORE_MODEL.constructByCloneUtility | Skipping unhandled complex type, advise updating complexPropertyMap in ${newModel.modelType}.`, property, currentValue, (typeof currentValue));
          }
          newModel.isValid = true;
          return newModel;
    
        } catch (error) {
          log.db(`CORE_MODEL.constructByCloneUtility | Error cloning ${defaultModel.modelType}.`, JSON.stringify(currentModel), error);
          return defaultModel;
        }
      }


   /******************************************************************************************************************************
    * STATIC | PROPERTIES FILTER UTILITY                                                                                         *
    * - Intended: getValidProperties() & getUniqueDatabaseProperties() (Must be Redefined to customize)                          *
    * - Parameters: fieldList, complexFieldMap, getModelProperty(field) = (all reference same types)                             *
    * - getUniqueDatabaseProperties() | Properties in model that differ from baseModel | (Must be static is 'this' doesn't work) *
    * - baseModel | set to undefined to getValidProperties on a single model                                                     *
    * - complexColumnMap | Must test for unique and return new copy or undefined                                                 *
    ******************************************************************************************************************************/
    static getUniquePropertiesUtility = <T extends CORE_MODEL>({ fieldList, getModelProperty, model, baseModel, complexFieldMap = new Map(), includeID = false, includeObjects = false, includeNull = false }
                                                               : { fieldList:string[]; getModelProperty:(field: string) => string|undefined; model:T; baseModel?:T; complexFieldMap?: Map<string, (model:T, baseModel:T) => any|undefined|Error>; 
                                                                  includeID?:boolean; includeObjects?:boolean, includeNull?:boolean }):Map<string,any> => {
        const map = new Map<string, any>();

        for(const field of model.prioritySortFieldList(fieldList)) {
            const property:string|undefined = getModelProperty(field);

            if(property === undefined && !complexFieldMap.has(field)) {
                log.db(`CORE_MODEL.getUniqueDatabasePropertiesUtility | Skipping column found in fieldList, advise updating complexFieldMap to skip in ${model.modelType}.`, field);
                continue;
            }
          
            const value = model[property];
            const baseValue = baseModel ? baseModel[property] : undefined;
            if(!includeID && model.isIDProperty(property, value))
                continue;

            else if(complexFieldMap.has(field)) {
                const result = complexFieldMap.get(field)(model, baseModel);
                if(result !== undefined) 
                    map.set(field, result);

            } else if(value === undefined)
                continue;

            else if(includeNull && value === null) //Allowed to clear database
                map.set(field, null);
            
            else if(includeObjects && Array.isArray(value) && (Array.from(value).length > 0) && (JSON.stringify(Array.from(value).sort()) !== JSON.stringify(Array.from(baseValue || []).sort())))
                map.set(field, Array.from(value));

            //Only object allowed; database handles
            else if(value instanceof Date && (baseValue === undefined || (value.getTime() !== baseValue.getTime())))
                map.set(field, new Date(value.getTime()));

            else if(includeObjects && (baseValue === undefined))
                map.set(field, value);

            else if((value !== baseValue) && (typeof value !== 'object')) //Primitives, enums, all other types
                map.set(field, value);
            }
            return map;
        }
  }
