import InputField, { InputType, isListType, InputSelectionField, InputRangeField, ENVIRONMENT_TYPE } from "../../0-assets/field-sync/input-config-sync/inputField.mjs";
import validateInputFields, { InputValidationResult } from '../../0-assets/field-sync/input-config-sync/inputValidation.mjs';
import { JwtClientRequest } from "../../1-api/2-auth/auth-types.mjs";
import { Exception } from "../../1-api/api-types.mjs";
import { getEnvironment } from "../10-utilities/utilities.mjs";
import * as log from "../10-utilities/logging/log.mjs";
import BASE_MODEL from "./baseModel.mjs";

/* BASE_MODEL_UTILITY */
export default {

    /*********************************************
    * STATIC | ADDITIONAl CONSTRUCTOR UTILITIES *
    * - Must be Redefined to customize          *
    *********************************************/
    //MUST copy primitives properties directly and create new complex types to avoid reference linking
    //Use 'complexColumnMap' to skip columns:()=>{}
    constructByDatabaseUtility: <M extends BASE_MODEL<any, any, any>>({ DB, newModel, defaultModel, complexColumnMap = new Map(), columnList}
        :{ DB:any; newModel:M; defaultModel:M; complexColumnMap?:Map<string, (DB:any, newModel:M) => void | Error>, columnList?:string[] }):M => {
        try {
            if (DB === undefined) throw new Error('Undefined Database Object');

            for (const column of (columnList || newModel.prioritySortFieldList(newModel.DATABASE_COLUMN_LIST))) {
                const property:string | undefined = newModel.getPropertyFromDatabaseColumn(column, true);

                if (property === undefined && !complexColumnMap.has(column))
                    log.db(`BASE_MODEL_UTILITY.constructByDatabaseUtility | Skipping column found in databaseTableColumnList, advise updating complexColumnMap to skip in ${newModel.modelType}.`, column);

                const databaseValue = DB[column];
                if (databaseValue !== undefined && databaseValue !== null) {
                    if (complexColumnMap.has(column))
                        complexColumnMap.get(column)(DB, newModel);

                    //Handling primitive direct assignment only, without casting
                    else if (typeof databaseValue === 'string' || typeof databaseValue === 'number' || typeof databaseValue === 'boolean')
                        newModel[property] = databaseValue;

                    else if (databaseValue instanceof Date)
                        newModel[property] = new Date(databaseValue.getTime());

                    else //(typeof databaseValue === 'object' || typeof databaseValue === 'function')
                        log.db(`BASE_MODEL_UTILITY.constructByDatabaseUtility | Skipping unhandled complex type, advise updating complexColumnMap in ${newModel.modelType}.`, column, databaseValue, (typeof databaseValue));
                }
            }
            newModel.isValid = true;
            return newModel;

        } catch (error) {
            log.db(`BASE_MODEL_UTILITY.constructByDatabaseUtility | Error parsing Database object for ${defaultModel.modelType}.`, JSON.stringify(DB), error, error.message);
            return defaultModel;
        }
    },



    constructByCloneUtility: <M extends BASE_MODEL<any, any, any>>({ currentModel, newModel, defaultModel, propertyList, complexPropertyMap = new Map() }
        :{ currentModel:M; newModel:M; defaultModel:M; propertyList:string[]; complexPropertyMap?:Map<string, (currentModel:M, newModel:M) => void | Error> }):M => {
        try {
            for (const property of [...currentModel.prioritySortFieldList(propertyList)]) {
                const currentValue = currentModel[property];

                if (currentValue === undefined) //Must protect 'typeof'
                    continue;

                else if (currentValue === null)
                    newModel[property] = null;

                if (complexPropertyMap.has(property))
                    complexPropertyMap.get(property)(currentModel, newModel);

                //Handling primitive direct assignment only, without casting
                else if ((typeof currentValue === 'string') || (typeof currentValue === 'number') || (typeof currentValue === 'boolean'))
                    newModel[property] = currentValue;

                else if (Array.isArray(currentValue)) {
                    if(Array.from(currentValue).length > 0)
                        newModel[property] = Array.from(currentValue);

                } else if (currentValue instanceof Date)
                    newModel[property] = new Date(currentValue.getTime());

                else //(typeof currentValue === 'object'
                    log.db(`BASE_MODEL_UTILITY.constructByCloneUtility | Skipping unhandled complex type, advise updating complexPropertyMap in ${newModel.modelType}.`, property, currentValue, (typeof currentValue));
            }
            newModel.isValid = true;
            return newModel;

        } catch (error) {
            log.db(`BASE_MODEL_UTILITY.constructByCloneUtility | Error cloning ${defaultModel.modelType}.`, JSON.stringify(currentModel), error, error.message);
            return defaultModel;
        }
    },



    /******************************************************************************************************************************
    * STATIC | PROPERTIES FILTER UTILITY                                                                                         *
    * - Intended:getValidProperties() & getUniqueDatabaseProperties() (Must be Redefined to customize)                          *
    * - Parameters:fieldList, complexFieldMap, getModelProperty(field) = (all reference same types)                             *
    * - getUniqueDatabaseProperties() | Properties in model that differ from baseModel | (Must be static is 'this' doesn't work) *
    * - baseModel | set to undefined to getValidProperties on a single model                                                     *
    * - complexColumnMap | Must test for unique and return new copy or undefined                                                 *
    ******************************************************************************************************************************/
    getUniquePropertiesUtility: <M extends BASE_MODEL<any, any, any>>({ fieldList, getModelProperty, model, baseModel, complexFieldMap = new Map(), includeID = false, includeObjects = false, includeNull = false }
        : { fieldList:string[]; getModelProperty:(field:string) => string | undefined; model:M; baseModel?:M; complexFieldMap?:Map<string, (model:M, baseModel:M) => any | undefined | Error>;
            includeID?:boolean; includeObjects?:boolean, includeNull?:boolean}):Map<string, any> => {
        const map = new Map<string, any>();

        for (const field of model.prioritySortFieldList(fieldList)) {
            const property:string | undefined = getModelProperty(field);

            if (property === undefined && !complexFieldMap.has(field)) {
                log.db(`BASE_MODEL_UTILITY.getUniqueDatabasePropertiesUtility | Skipping column found in fieldList, advise updating complexFieldMap to skip in ${model.modelType}.`, field);
                continue;
            }

            const value = model[property];
            const baseValue = baseModel ? baseModel[property] :undefined;
            if (!includeID && model.isIDProperty(property, value))
                continue;

            else if (complexFieldMap.has(field)) {
                const result = complexFieldMap.get(field)(model, baseModel);
                if (result !== undefined)
                    map.set(field, result);

            } else if (value === undefined)
                continue;

            else if (includeNull && value === null) //Allowed to clear database
                map.set(field, null);

            else if (includeObjects && Array.isArray(value) && (Array.from(value).length > 0) && (JSON.stringify(Array.from(value).sort()) !== JSON.stringify(Array.from(baseValue || []).sort())))
                map.set(field, Array.from(value));

            //Only object allowed; database handles
            else if (value instanceof Date && (baseValue === undefined || (value.getTime() !== baseValue.getTime())))
                map.set(field, new Date(value.getTime()));

            else if (includeObjects && (baseValue === undefined))
                map.set(field, value);

            else if ((value !== baseValue) && (typeof value !== 'object')) //Primitives, enums, all other types
                map.set(field, value);
        }
        return map;
    },



   /***************************************************************
    * constructByJson => populateFromJson                       *
    * Returns: modified model or undefined with Express Exception *
    ***************************************************************/
    constructByJson: async<M extends BASE_MODEL<any, any, any>>({currentModel, jsonObj, fieldList}:{currentModel:M, jsonObj:JwtClientRequest['body'], fieldList:InputField[]}):Promise<M | Exception> => {
        const model:M = currentModel.constructByClone();

        if(model === undefined) {
            log.error('Unexpected Undefined Model | createFromJSON');
            return new Exception(500, 'Unexpected model type; unable to parse JSON.');
        }

        const relevantFields:InputField[] = fieldList.filter((field: InputField) => field.environmentList.includes(getEnvironment()));

        for(let field of relevantFields) {
            if(field.required && currentModel[currentModel.getPropertyFromJsonField(field.field)] === undefined 
                && (jsonObj[field.field] === undefined || jsonObj[field.field] === null || jsonObj[field.field] === '')) {
                    return new Exception(400, `${model.modelType} | ${field.title} is Required.`, `${field.title} is Required.`);

            } else if(jsonObj[field.field] === undefined) {
                continue;

            }

            const modelValidateResult:boolean|undefined = await model.validateModelSpecificField({field, value: jsonObj[field.field], jsonObj});
            if(modelValidateResult === false) {
                if(field.required)
                    return new Exception(400, `${model.modelType} | ${field.title} input failed to validate.`, `${field.title} is invalid and required.`);
                else
                    log.warn(`${model.modelType} | ${field.field} failed model specific validations.`);

            } else if(modelValidateResult === undefined && model.hasProperty(field.field) && !validateInput({field, value: jsonObj[field.field], jsonObj}).passed) {
                const result:InputValidationResult = validateInput({field, value: jsonObj[field.field], jsonObj});

                if(field.required)
                    return new Exception(400, `${model.modelType} | ${field.title} failed validation: ${result.description}.`, `${field.title}: ${result.message}`);
                else
                    log.warn(`${model.modelType} | ${field.field} failed field-config validations:`, jsonObj[field.field], result.description);

            } else {
                try {
                    const modelParseResult:boolean|undefined = await model.parseModelSpecificField({field, jsonObj: jsonObj});
                    if(modelParseResult === true)
                        continue;
                        
                    else if(modelParseResult === false)
                        throw `${model.modelType} | ${model.ID} | Failed parseModelSpecificField`;
                    
                    else if(!model.hasProperty(field.field)) {
                        if(getEnvironment() === ENVIRONMENT_TYPE.LOCAL) log.warn('*Skipping non model recognized field', model.modelType, field.field, JSON.stringify(jsonObj[field.field]));
                        continue;

                    } else {
                        model[field.field] = parseInput({field, value:jsonObj[field.field]});

                        /* Max Field | Already validated within validateInput */
                        if(field instanceof InputRangeField && field.maxField && model.hasProperty(field.maxField)) {
                            model[field.maxField] = parseInput({field, value:jsonObj[field.maxField]});
                        }
                    }

                } catch(error) {
                    log.warn(`Failed to parse profile field: ${field.field} with value:`, JSON.stringify(jsonObj[field.field]), error, error.message);
                    model[field.field] = undefined;

                    if(field.required) {
                        return new Exception(500, `${model.modelType} | ${field.title} is Required; but failed to parse.`, `${field.title} Failed.`);
                    }                
                }
                continue;
            } 
        }
        model.isValid = true;
        return model;
    },
}



/************************************************
* PRIVATE | parseInput by config type           *
* ( must be direct mapping to Model property )  *
*************************************************/
const parseInput = ({field, value}:{field:InputField, value:any}):any => {
    try {
        if(value === undefined)
            throw `${field.title} is undefined.`;

        else if(value === null) //Valid for clearing fields in database
            return null;

        /* NOTE: All  */
        else if(['true', 'false'].includes((String(value) || '').toLowerCase()))
            return ((String(value) || '').toLowerCase() === 'true') as boolean;

        else if(field.type === InputType.DATE)
            return new Date(value);

        else if(field.type === InputType.NUMBER)
            return parseFloat(value) as number;

        else if(isListType(field.type))
            return Array.from(value);

        else
            return value;

    } catch(error) {
        log.warn(`Failed to parse profile field: ${field.field} with value: ${value}`, error, error.message);
        return undefined;
    }
}

/************************************************
* PRIVATE | validateInput using validationRegex *
*************************************************/
const validateInput = ({field, value, jsonObj}:{field:InputField, value:string, jsonObj:Object}):InputValidationResult => {

    /* UNDEFINED */
    if(value === undefined) {
        return { passed: true, message: "Missing", description: "Value is undefined" };

    /* NULL | Valid for clearing fields in database */
    } else if(value === null) {
        return { passed: true, message: "Cleared", description: "Value is null" };

    } else {    
        const result:InputValidationResult = validateInputFields({ field, value, getInputField:(f) => jsonObj[f], simpleValidationOnly: false });
    
        if(!result.passed) log.warn('Failed Validation:', value, result.description);
    
        return result;
    };
}
