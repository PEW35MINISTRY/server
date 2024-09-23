import { ENVIRONMENT_TYPE } from '../../0-assets/field-sync/input-config-sync/inputField.mjs';
import { DATABASE_MODEL_SOURCE_ENVIRONMENT_ENUM } from '../2-database/database-types.mjs';
import dotenv from 'dotenv';
dotenv.config(); 



/**************************************************************
 * ENVIRONMENT MODEL SOURCE SETTINGS                          *
 *  - Effects new models & search cache                       *
 *  - Only applies to user table; circles inherit from leader *
 **************************************************************/
export const getEnvironment = ():ENVIRONMENT_TYPE => ENVIRONMENT_TYPE[process.env.ENVIRONMENT as keyof typeof ENVIRONMENT_TYPE] || ENVIRONMENT_TYPE.PRODUCTION;

export const getModelSourceEnvironment = (): DATABASE_MODEL_SOURCE_ENVIRONMENT_ENUM => {
    return DATABASE_MODEL_SOURCE_ENVIRONMENT_ENUM[process.env.DEFAULT_MODEL_SOURCE_ENVIRONMENT as keyof typeof DATABASE_MODEL_SOURCE_ENVIRONMENT_ENUM] 
        ?? DATABASE_MODEL_SOURCE_ENVIRONMENT_ENUM[getEnvironment() as keyof typeof DATABASE_MODEL_SOURCE_ENVIRONMENT_ENUM] 
        ?? DATABASE_MODEL_SOURCE_ENVIRONMENT_ENUM.PRODUCTION;
};


/*********************
 * GENERIC UTILITIES *
 *********************/

export const camelCase = (...terms:string[]) => terms.filter(term => term !== undefined && term !== '')
    .map((term:string) => { 
        let newTerm = term.replace(/\s+/g, ''); 
        return newTerm.charAt(0).toUpperCase() + newTerm.slice(1);
    })
    .join('')
    .replace(/^\w/, firstCharacter => firstCharacter.toLowerCase());

export const isEnumValue = <T,>(enumObj: T, value: any): value is T[keyof T] => Object.values(enumObj).includes(value as T[keyof T]);
    
export const isURLValid = (url: string): boolean => {
    try { new URL(url); return true; } catch { return false; }
};
      
export const extractRegexMaxLength = (regex:RegExp, findMin?:boolean):number => {
    const match = regex.toString().match(/\^\.\{(\d+),(\d+)\}\$/);
    return match ? 
        (findMin ? parseInt(match[1], 10) : parseInt(match[2], 10)) 
        : (findMin ? 0 : Number.MAX_SAFE_INTEGER);
}
