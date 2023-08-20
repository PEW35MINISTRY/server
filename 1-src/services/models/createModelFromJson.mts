import * as log from '../../services/log.mjs';
import { GenderEnum, InputField, InputType, RoleEnum } from "./Fields-Sync/profile-field-config.mjs";
import USER from "./userModel.mjs";
import { NextFunction } from "express";
import CIRCLE from "./circleModel.mjs";
import BASE_MODEL from "./baseModel.mjs";
import { JwtClientRequest } from "../../api/auth/auth-types.mjs";
import { Exception } from '../../api/api-types.mjs';
import CIRCLE_ANNOUNCEMENT from './circleAnnouncementModel.mjs';
import PRAYER_REQUEST from './prayerRequestModel.mjs';


/**********************************************************
 * PRIVATE : Local Model Types and constructor
 **********************************************************/
type ModelTypes = BASE_MODEL | USER | CIRCLE | CIRCLE_ANNOUNCEMENT | PRAYER_REQUEST;

const getNewModel = (existingModel:BASE_MODEL):ModelTypes|undefined => {
    if(existingModel !== undefined)
        switch (existingModel.modelType) {
            case 'USER':
                const user = new USER(undefined, (existingModel as USER).userID);
                user.userRoleList = (existingModel as USER).userRoleList;
                return user;

            case 'CIRCLE':
                return new CIRCLE(undefined, (existingModel as CIRCLE).circleID);

            case 'CIRCLE_ANNOUNCEMENT':
                return new CIRCLE_ANNOUNCEMENT(undefined);

            case 'PRAYER_REQUEST':
                return new PRAYER_REQUEST(undefined, (existingModel as PRAYER_REQUEST).prayerRequestID);

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
                next(new Exception(400, `${field.title} is Required.`, `${field.title} is Required.`));
            return undefined;

        } else if(jsonObj[field.field] === undefined)
            continue;

        const modelValidateResult:boolean|undefined = model.validateModelSpecificField({field, value: jsonObj[field.field]});
        if(modelValidateResult === false) {
            log.warn(`${field.title} failed model specific validations for ${model.modelType}.`);

        } else if(modelValidateResult === undefined && validateInput({field, value: jsonObj[field.field], jsonObj}) === false) {
            log.warn(`${field.title} failed field-config validations.`);

        } else {
            try {
                const modelParseResult:boolean|undefined = model.parseModelSpecificField({field, jsonObj: jsonObj});
                if(modelParseResult === true)
                    continue;
                    
                else if(modelParseResult === false)
                    throw `${model.modelType} | ${model.getID} | Failed parseModelSpecificField`;

                else if(model.hasProperty(field.field) && jsonObj[field.field] !== undefined)
                    model[field.field] = parseInput({field:field, value:jsonObj[field.field]});

                else
                    console.info('*Skipping extra field', field.field, jsonObj[field.field]);

            } catch(error) {
                log.error(`Failed to parse profile field: ${field.field} with value: ${jsonObj[field.field]}`, error);
                model[field.field] = undefined;

                if(field.required && next !== undefined) {
                    next(new Exception(500, `${field.title} is Required; but failed to parse.`, `${field.title} Failed.`));
                    return undefined;
                }                
            }
            continue;
        } 

        if(field.required) {
            if(next !== undefined)
                next(new Exception(400, `${field.title} input failed to validate.`, `${field.title} is invalid and required.`));
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

        else if(field.field === 'isActive')
            return (value === 'true') as boolean;

        else if(field.type === InputType.DATE)
            return new Date(value);

        else if(field.type === InputType.NUMBER)
            return parseFloat(value) as number;

        else if(field.type === InputType.MULTI_SELECTION_LIST)
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

    /* Validate general validationRegex from config */
    } else if(!(new RegExp(field.validationRegex).test(value))){
        log.warn(`Validating input for ${field}; failed validation Regex: ${field.validationRegex}`, value);
        return false;

    } else if(field.type === InputType.DATE) {
        const date:Date = new Date(value);

        if(isNaN(date.valueOf())) 
            return false;

        else if(field.field === 'startDate' && jsonObj['endDate'] !== undefined) {
            const startDate = date;
            const endDate = new Date(jsonObj['endDate']);

            if(isNaN(endDate.valueOf()) || startDate > endDate) {
                log.warn(`Validating input for ${field}; failed: endDate is not greater than startDate`, value, jsonObj['endDate']);
                return false;
            }
        }
        
    /* SELECT_LIST */
    } else if(field.type === InputType.SELECT_LIST && !field.selectOptionList.includes(`${value}`)) {
        log.warn(`Validating input for ${field}; failed not included in select option list`, value, JSON.stringify(field.selectOptionList));
        return false;

    /* MULTI_SELECTION_LIST */
    } else if(field.type === InputType.MULTI_SELECTION_LIST && ( !Array.isArray(value)
        || !Array.from(value).every((item:any)=>{
            if(!field.selectOptionList.includes(`${item}`)) {
                log.warn(`Validating input for ${field}; multi selection; missing value in select option list`, item, JSON.stringify(field.selectOptionList));
                return false;
            } else return true;
        }))) {
            log.warn(`Validating input for ${field};  multi selection; mismatched multiple select option list`, JSON.stringify(value), JSON.stringify(field.selectOptionList));
        return false;
    }

    return true;
}