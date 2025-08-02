import InputField, { isListType, InputType, InputRangeField, InputSelectionField } from './inputField.mjs';
import { getDOBMaxDate, getDOBMinDate, RoleEnum } from './profile-field-config.mjs';


/* VALIDATION UTILITIES */
export const getAgeFromDate = (date: Date):number => Math.floor((new Date().getTime() - date.getTime()+(25*60*60*1000)) / (365.25 * 24 * 60 * 60 * 1000));  //Reverse offset one day for delay

//JSON: 'userRoleTokenList' | Searches Profile Input for max userRole for accurate validations
export const getHighestRole = (roleMap:Map<string, string>|undefined):RoleEnum => Object.values(RoleEnum).reverse().find((role, index) => (roleMap?.has(RoleEnum[role]))) as RoleEnum ?? RoleEnum.USER;

export const getValidationLength = (value:string|number):number => [...String(value)].length;

export const validateLength = (field:InputField, value:string|number):string|undefined => {
    if(field.length !== undefined) {  
        if(getValidationLength(value) < field.length.min) return `Too Short`;
        if(getValidationLength(value) > field.length.max) return `Too Long`;
    }  
    return undefined;
}
  
export const validateListEntryLength = (field:InputField, values:(string|number)[]):string|undefined => {
    for(let i = 0; i < values.length; i++) {
        if(validateLength(field, values[i])) 
            return `[${i + 1}] Too ${validateLength(field, values[0])}`;
    }
    return undefined;
}

export const validateListRegex = (field:InputField, values:(string|number)[]):string|undefined => {
    for(let i = 0; i < values.length; i++) {
        if(!(new RegExp(field.validationRegex).test(String(values[i]))))
            return `[${i + 1}] Invalid`;
    }
    return undefined;
}

export const isURLValid = (url:string):boolean => {
    try { new URL(url); return true; } catch { return false; }
}


/************************************************
* VALIDATE INPUTS                               *
* Success => undefined                          *
* Failed => Error Message                       *
* simpleValidationOnly: skips dependent validations *
*************************************************/
export type InputValidationResult = { 
    passed:boolean,
    message:string,
    description:string 
}

export type InputTypesAllowed = string | string [] | number | number[] | undefined; //Lists are identified and converted individually

export default ({ field, value, getInputField, simpleValidationOnly = false }:{ field:InputField, value:InputTypesAllowed, getInputField:(field:string) => InputTypesAllowed, simpleValidationOnly:boolean }):InputValidationResult => {

    /* ----- UNIVERSAL VALIDATIONS ----- */

    /* Required Fields */
    if((value === undefined || String(value).trim().length === 0) && field.required && !simpleValidationOnly) {
        return { passed: false, message: 'Required', description: `Missing required value for ${field.field}` };

    /* UNDEFINED | UI allowed for non-required | Server filters out in BASE_MODEL_UTILITY.constructByJson */
    } else if(value === undefined || String(value).trim().length === 0) {
        return { passed: true, message: 'Missing value', description: `Optional value for ${field.field}` };

    /* NULL | Valid for clearing fields in database */
    } else if(value === null) {
        return { passed: true, message: 'Cleared value', description: 'Value is null — valid for clearing for clearing database' };

    /* Individual Regex */
    } else if(!isListType(field.type) && !(new RegExp(field.validationRegex).test(String(value)))) {
        return { passed: false, message: field.validationMessage, description: `Failed validation Regex: ${field.validationRegex}` };

    /* List Regex */
    } else if(isListType(field.type) && Array.isArray(value) && validateListRegex(field, value)) {
        return { passed: false, message: validateListRegex(field, value) ?? 'Invalid', description: `Failed list validation Regex: ${field.validationRegex} for value: ${validateListRegex(field, value)}` };

    /* Individual Length */
    } else if((field.length !== undefined) && !isListType(field.type) && validateLength(field, String(value))) {
        return { passed: false, message: validateLength(field, String(value)) ?? 'Length', description: `Failed length min: ${field.length.min} and max: ${field.length.max} for value length: ${validateLength(field, String(value))}` };

    /* List Length */
    } else if((field.length !== undefined) && isListType(field.type) && Array.isArray(value) && validateListEntryLength(field, value)) {
        return { passed: false, message: validateListEntryLength(field, value) ?? 'Length', description: `Failed list entry length min: ${field.length.min} and max: ${field.length.max} for value: ${validateListEntryLength(field, value)}` };


    /* ----- INDIVIDUAL FIELD VALIDATIONS ----- */

    /* DATES | dateOfBirth */
    } else if(field.type === InputType.DATE && field.field === 'dateOfBirth') {
        const date:Date = new Date(String(value));

        if(isNaN(date.valueOf()))
            return { passed: false, message: 'Invalid date format.', description: `${field.title} must be a valid date ISO string.` };

        const highestRole:RoleEnum = getHighestRole(getInputField('userRoleTokenList') as unknown as Map<string, RoleEnum>);
        if(date > getDOBMaxDate(highestRole)) {
            return { passed: false, message: 'Must be older.', description: `Must be older than ${getAgeFromDate(getDOBMaxDate(highestRole))} for a ${highestRole} account.` };

        } else if(date < getDOBMinDate(highestRole)) {
            return { passed: false, message: 'Must be younger.', description: `Must be younger than ${getAgeFromDate(getDOBMinDate(highestRole))} for a ${highestRole} account.` };

        } else
            return { passed: true, message: 'Valid date of birth.', description: `DOB passed all validations for a ${highestRole} account.` };

    /* Password Matching */ 
    } else if(field.field === 'passwordVerify' && value !== getInputField('password')) {
        return { passed: false, message: 'Must match password', description: `${field.field}: does not match password field within this input data set.` };

    /* Image URI */
    } else if((field.type === InputType.TEXT) && ['url', 'image'].includes(field.field.toLowerCase()) && !isURLValid(String(value))) {
        return { passed: false, message: 'Invalid URL', description: `Failed isURLValid test with value: ${value}` };

    /* CUSTOM FIELD */
    } else if(value === 'CUSTOM' && field.customField !== undefined 
        && (!(new RegExp(field.validationRegex).test(String(getInputField(field.customField) ?? '')))
            || (field.length !== undefined && validateLength(field, String(getInputField(field.customField) ?? ''))))) {
        return { passed: false, message: 'Custom invalid', description: `Invalid Custom field ${field.customField} for ${field.field}` };


    /* ----- GENERAL TYPE VALIDATIONS ----- */
    } else if(field.type === InputType.CUSTOM) {
        return { passed: true, message: 'Custom Validation', description: 'Custom Type - Bypass General Validations' };

    /* DATE ISO String */
    } else if(field.type === InputType.DATE) {
        const date: Date = new Date(String(value));

        if(isNaN(date.valueOf())) {
            return { passed: false, message: 'Invalid date', description: `Invalid date format for ${field.field}.` };
      
        //startDate and endDate are respective
        } else if(!simpleValidationOnly && field.field === 'startDate' && getInputField('endDate') !== undefined) {
                const startDate = date;
                const endDate = new Date(String(getInputField('endDate') ?? ''));

                if(isNaN(endDate.valueOf()) || startDate > endDate) {
                    return { passed: false, message: 'Start is after end', description: `EndDate is not greater than startDate: startDate: ${value} | endDate: ${getInputField('endDate')}` };
                } else
                    return { passed: true, message: 'Date is valid', description: `StartDate is valid with EndDate: ${getInputField('endDate')}` };

        } else
            return { passed: true, message: 'Date is valid', description: `EndDate is valid` };

    /* RANGE_SLIDER */
    } else if((field instanceof InputRangeField) && (field.type === InputType.RANGE_SLIDER)
            && !isNaN(Number(value)) && (Number(value) < Number(field.minValue) || Number(value) > Number(field.maxValue))) {
        return { passed: false, message: 'Out of range', description: `Range validation: Min: ${field.minValue}, Max: ${field.maxValue}, Value: ${value}` };

    } else if((field instanceof InputRangeField) && (field.type === InputType.RANGE_SLIDER) && field.maxField 
            && !isNaN(Number(getInputField(field.maxField))) && (Number(getInputField(field.maxField)) < Number(value) || Number(getInputField(field.maxField)) > Number(field.maxValue))) {
        return { passed: false, message: 'Max Out of range', description: `Max Range validation: Min: ${field.minValue}, Max: ${field.maxValue}, Max Value: ${getInputField(field.maxField)}` };

    /* Model ID Lists */
    } else if((field.type === InputType.USER_ID_LIST || field.type === InputType.CIRCLE_ID_LIST) 
        && (!Array.isArray(value) || !(value as number[]).every((i:number) => Number.isInteger(Number(i)) && Number(i) > 0))) {
        return { passed: false, message: 'Invalid ID list', description: `Each ID in ${field.field} must be a positive integer. Value: ${JSON.stringify(value)}` };

    /* SELECT_LIST */
    } else if((field instanceof InputSelectionField) && (field.type === InputType.SELECT_LIST) 
            && !field.selectOptionList.includes(`${value}`)) {
        return { passed: false, message: 'Invalid selection', description: `Value not in select options. Value: ${value}, Options: ${JSON.stringify(field.selectOptionList)}` };

    /* MULTI_SELECTION_LIST */
    } else if((field instanceof InputSelectionField) && (field.type === InputType.MULTI_SELECTION_LIST) 
            && (!Array.isArray(value) || !(value as string[]).every((item:string) => (field.selectOptionList.includes(`${item}`))))) {
        return { passed: false, message: 'Invalid selection', description: `Multi-selection mismatch. Value: ${JSON.stringify(value)}, Options: ${JSON.stringify(field.selectOptionList)}` };
    }    

    return { passed: true, message: 'Valid', description: 'All validations passed' };
}
  