import { NextFunction } from 'express';
import InputField, { InputType, isListType } from '../0-assets/field-sync/input-config-sync/inputField.mjs';
import { GenderEnum, RoleEnum } from '../0-assets/field-sync/input-config-sync/profile-field-config.mjs';
import { JwtClientRequest } from '../1-api/2-auth/auth-types.mjs';
import { Exception } from '../1-api/api-types.mjs';
import * as log from './log.mjs';
import BASE_MODEL from './1-models/baseModel.mjs';
import CIRCLE_ANNOUNCEMENT from './1-models/circleAnnouncementModel.mjs';
import CIRCLE from './1-models/circleModel.mjs';
import PRAYER_REQUEST from './1-models/prayerRequestModel.mjs';
import USER from './1-models/userModel.mjs';
import CONTENT_ARCHIVE from './1-models/contentModel.mjs';


/**********************************************************
 * PRIVATE : Local Model Types and constructor
 **********************************************************/
type ModelTypes = BASE_MODEL | USER | CIRCLE | CIRCLE_ANNOUNCEMENT | PRAYER_REQUEST | CONTENT_ARCHIVE;

const getNewModel = (existingModel:BASE_MODEL):ModelTypes|undefined => {
    if(existingModel !== undefined)
        switch (existingModel.modelType) {
            case 'USER':
                return USER.constructByClone(existingModel as USER);

            case 'CIRCLE':
                return CIRCLE.constructByClone(existingModel as CIRCLE);

            case 'CIRCLE_ANNOUNCEMENT':
                return new CIRCLE_ANNOUNCEMENT(undefined);

            case 'PRAYER_REQUEST':
                return PRAYER_REQUEST.constructByClone(existingModel as PRAYER_REQUEST);

            case 'CONTENT_ARCHIVE':
                return CONTENT_ARCHIVE.constructByClone(existingModel as CONTENT_ARCHIVE);

            default:
                log.error('createModelFromJson.getNewModel | modelType not defined', existingModel.modelType);
        }

    return undefined;
}

/**********************************************************
 * PRIVATE : Local Mapping: ONLY FOR VALIDATIONS 
 * ( json defined in profile-field-config.mts )
 **********************************************************/
const jsonToUserMapping = new Map<string, string>([
    ['userRoleTokenList', 'userRoleList'],
    ['password', 'passwordHash'],
    ['passwordVerify', 'passwordHash']
]);

const getJsonToModelFieldMapping = (model:BASE_MODEL, field:string):string => {
    if(model instanceof USER && jsonToUserMapping.has(field))
        return jsonToUserMapping.get(field);
    else
        return field;
}

/**********************************************************
 * PUBLIC : createModelFromJson
 * Returns: new model or undefined with Express Exception
 **********************************************************/
export default ({currentModel: currentModel, jsonObj, fieldList, next}:{currentModel: BASE_MODEL, jsonObj:JwtClientRequest['body'], fieldList:InputField[], next?: NextFunction}):ModelTypes|undefined => {
    const model:BASE_MODEL = getNewModel(currentModel);

    if(model === undefined) {
        log.error('Unexpected Undefined Model | createFromJSON');
        next(new Exception(500, 'Unexpected model type; unable to parse JSON.'));
        return undefined;
    }

    for(let field of fieldList) {
        if(field.required && jsonObj[field.field] === undefined && currentModel[getJsonToModelFieldMapping(currentModel, field.field)] === undefined ) {
            if(next !== undefined)
                next(new Exception(400, `${model.modelType} | ${field.title} is Required.`, `${field.title} is Required.`));
            return undefined;

        } else if(jsonObj[field.field] === undefined) {
            continue;

        }

        const modelValidateResult:boolean|undefined = model.validateModelSpecificField({field, value: jsonObj[field.field], jsonObj});
        if(modelValidateResult === false) {
            log.warn(`${model.modelType} | ${field.field} failed model specific validations.`);

        } else if(modelValidateResult === undefined && model.hasProperty(field.field) && validateInput({field, value: jsonObj[field.field], jsonObj}) === false) {
            log.warn(`${model.modelType} | ${field.field} failed field-config validations.`);

        } else {
            try {
                const modelParseResult:boolean|undefined = model.parseModelSpecificField({field, jsonObj: jsonObj});
                if(modelParseResult === true)
                    continue;
                    
                else if(modelParseResult === false)
                    throw `${model.modelType} | ${model.getID} | Failed parseModelSpecificField`;
                
                else if(!model.hasProperty(field.field)) {
                    log.warn('*Skipping non model recognized field', model.modelType, field.field, JSON.stringify(jsonObj[field.field]));
                    continue;

                } else
                    model[field.field] = parseInput({field:field, value:jsonObj[field.field]});

            } catch(error) {
                log.error(`Failed to parse profile field: ${field.field} with value:`, JSON.stringify(jsonObj[field.field]), error);
                model[field.field] = undefined;

                if(field.required && next !== undefined) {
                    next(new Exception(500, `${model.modelType} | ${field.title} is Required; but failed to parse.`, `${field.title} Failed.`));
                    return undefined;
                }                
            }
            continue;
        } 

        if(field.required) {
            if(next !== undefined)
                next(new Exception(400, `${model.modelType} | ${field.title} input failed to validate.`, `${field.title} is invalid and required.`));
            return undefined;
        }
    }
    model.isValid = true;
    return model;
}

/**********************************************************
 * PRIVATE : parseInput by config type
 * ( must be direct mapping to USER property )
 **********************************************************/
const parseInput = ({field, value}:{field:InputField, value:any}):any => {
    try {
        if(value === undefined || value === null)
            throw `${field.title} is undefined.`

        /* NOTE: All  */
        else if(field.field === 'userRoleList')
            return Array.from(value as string[]).map(role => RoleEnum[role as string]);

        else if(field.field === 'gender')
            return GenderEnum[value];

        else if(field.field === 'walkLevel')
            return parseInt(value) as number;

        else if(['true', 'false'].includes((String(value) || '').toLowerCase()))
            return ((String(value) || '').toLowerCase() === 'true') as boolean;

        else if(field.type === InputType.DATE)
            return new Date(value);

        else if(field.type === InputType.NUMBER)
            return parseFloat(value) as number;

        else if(isListType(field.type))
            return Array.from(value);

        else if(['displayName', 'email', 'inviteToken'].includes(field.field)) //Lowercase
            return (String(value) || '').toLowerCase();

        else
            return value;

    } catch(error) {
        log.error(`Failed to parse profile field: ${field.field} with value: ${value}`, error);
        return undefined;
    }
}

/**********************************************************
 * PRIVATE : validateInput using validationRegex
 **********************************************************/
const validateInput = ({field, value, jsonObj}:{field:InputField, value:string, jsonObj:Object}):boolean => {

    /* Field Exists */
    if(value === undefined) {
        return false;

    /* List Validate each element against general validationRegex from config */
    } else if(isListType(field.type) && Array.isArray(field.value) && Array.from(field.value).some((element) => !(new RegExp(field.validationRegex).test(value)))){
        log.warn(`Validating input for ${field.field}; failed list validation Regex: ${field.validationRegex}`, JSON.stringify(value));
        return false;

    /* Validate general validationRegex from config */
    } else if(!isListType(field.type) && !(new RegExp(field.validationRegex).test(value))){
        log.warn(`Validating input for ${field.field}; failed validation Regex: ${field.validationRegex}`, value);
        return false;

    } else if(field.type === InputType.DATE) {
        const date:Date = new Date(value);

        if(isNaN(date.valueOf())) 
            return false;

        else if(field.field === 'startDate' && jsonObj['endDate'] !== undefined) {
            const startDate = date;
            const endDate = new Date(jsonObj['endDate']);

            if(isNaN(endDate.valueOf()) || startDate > endDate) {
                log.warn(`Validating input for ${field.field}; failed: endDate is not greater than startDate`, value, jsonObj['endDate']);
                return false;
            }
        }
        
    /* SELECT_LIST */
    } else if(field.type === InputType.SELECT_LIST && !field.selectOptionList.includes(`${value}`)) {
        /* CUSTOM field alternative */
        if(field.selectOptionList.includes('CUSTOM')) {
            log.event(`Validating input for ${field.field}; custom field override SELECT_LIST`, field.field, value);
            return true;

        } else {
            log.warn(`Validating input for ${field.field}; failed not included in select option list`, value, JSON.stringify(field.selectOptionList));
            return false;
        }

    /* MULTI_SELECTION_LIST */
    } else if(field.type === InputType.MULTI_SELECTION_LIST && ( !Array.isArray(value)
        || !Array.from(value).every((item:any)=>{
            if(!field.selectOptionList.includes(`${item}`)) {
                log.warn(`Validating input for ${field.field}; multi selection; missing value in select option list`, item, JSON.stringify(field.selectOptionList));
                return false;
            } else return true;
        }))) {
            log.warn(`Validating input for ${field.field};  multi selection; mismatched multiple select option list`, JSON.stringify(value), JSON.stringify(field.selectOptionList));
        return false;
    }

    return true;
}