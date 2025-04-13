import { createHash } from 'crypto';
import { S3Client, ListBucketsCommand } from "@aws-sdk/client-s3";
import { ENVIRONMENT_TYPE } from '../../0-assets/field-sync/input-config-sync/inputField.mjs';
import { DATABASE_MODEL_SOURCE_ENVIRONMENT_ENUM } from '../2-database/database-types.mjs';
import dotenv from 'dotenv';
dotenv.config(); 



/**************************************************************
 * ENVIRONMENT MODEL SOURCE SETTINGS                          *
 *  - Effects new models & search cache                       *
 *  - Only applies to user table; circles inherit from leader *
 **************************************************************/
/* Parse Environment | (Don't default to PRODUCTION for security) */
export const getEnvironment = ():ENVIRONMENT_TYPE => ENVIRONMENT_TYPE[process.env.ENVIRONMENT as keyof typeof ENVIRONMENT_TYPE] || ENVIRONMENT_TYPE.DEVELOPMENT;

export const getModelSourceEnvironment = (): DATABASE_MODEL_SOURCE_ENVIRONMENT_ENUM => {
    return DATABASE_MODEL_SOURCE_ENVIRONMENT_ENUM[process.env.DEFAULT_MODEL_SOURCE_ENVIRONMENT as keyof typeof DATABASE_MODEL_SOURCE_ENVIRONMENT_ENUM] 
        ?? DATABASE_MODEL_SOURCE_ENVIRONMENT_ENUM[getEnvironment() as keyof typeof DATABASE_MODEL_SOURCE_ENVIRONMENT_ENUM] 
        ?? DATABASE_MODEL_SOURCE_ENVIRONMENT_ENUM.DEVELOPMENT;
};

/* AWS SSO Authentication | Provides access to S3 & SNS utilities */
export const checkAWSAuthentication = async():Promise<boolean> => {
    try { //Fetch list of buckets as a test
        const s3Client = new S3Client({ region: process.env.LOG_BUCKET_REGION });
        await s3Client.send(new ListBucketsCommand({}));       
        return true;
    } catch(error) {
        console.error('WARNING - AWS Credentials Not Verified');
        return false;
    }
}

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

export const getSHA256Hash = (value:string) => createHash('sha256').update(value).digest('hex');

//Difference +/- days from now
export const getDaysAway = (date:Date, min?:number, max?:number):number => {
    if(!date || isNaN(date.valueOf())) return 0;
  
    const now = new Date();
    const timeDifference = date.getTime() - now.getTime();
    let days = Math.floor(timeDifference / (1000 * 60 * 60 * 24));
    
    if(min !== undefined) days = Math.max(min, days);
    if(max !== undefined) days = Math.min(max, days);  
    return days;
}

//Numeric list: calculates the closest value from list of options
export const findClosestListOption = (value:number, optionList:number[], roundDown:boolean = true):number => {
    if (optionList.length === 0) return value;
  
    const sorted = [...optionList].sort((a, b) => a - b); 

    if(roundDown) {
      return sorted.filter(opt => opt <= value).pop() ?? sorted[0];
    } else {
      return sorted.find(opt => opt >= value) ?? sorted[sorted.length - 1];
    }
}
  