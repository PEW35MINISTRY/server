import { createHash } from 'crypto';
import { S3Client, ListBucketsCommand } from '@aws-sdk/client-s3';
import { ENVIRONMENT_TYPE } from '../../0-assets/field-sync/input-config-sync/inputField.mjs';
import { DATABASE_MODEL_SOURCE_ENVIRONMENT_ENUM } from '../2-database/database-types.mjs';



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
      
export const getSHA256Hash = (value:string) => createHash('sha256').update(value).digest('hex');

//Converts any object into array of strings; optional field sanitization
export const toStringArray = (initialObject:any, sanitizePropertyKeywords:string[] = [], maxFieldLength:number = 100):string[] => {
    const result:string[] = [];

    const calculateRecursiveProperty = (obj:any, fieldPath='') => {
        if(obj === null) {
            result.push(`${fieldPath}: null`);
            return;

        } else if(obj === undefined) {
            result.push(`${fieldPath}: ${obj}`);
            return;

        //Truncate long fields
        } else if(typeof obj !== 'object') {
            result.push(`${fieldPath}: ${String(obj).length > maxFieldLength ? String(obj).slice(0, maxFieldLength)+'...' : String(obj)}`);
            return;

        //Iterate arrays, adds current fieldPath as a prefix
        } else if(Array.isArray(obj)) {
            for(const [idx,item] of obj.entries()) calculateRecursiveProperty(item, `${fieldPath}[${idx}]`);
            return;
        }

        /* Redacting & Filtering */
        const objects:[string, any][] = [];
        for(const [field, value] of Object.entries(obj)) {
            const fullPath = fieldPath ? `${fieldPath}.${field}` : field;
            //Redact fields that include substring from sanitizeFields case-insensitive
            if(sanitizePropertyKeywords.some(field => fullPath.toLowerCase().includes(field.toLowerCase()))) {
                result.push(`${fullPath}: [REDACTED]`);
            //Objects are sorted to the end for readability
            } else if(value !== null && typeof value === 'object') {
                objects.push([field,value]);
            } else {
                result.push(`${fullPath}: ${String(value).length > maxFieldLength ? String(value).slice(0,maxFieldLength)+'...' : String(value)}`);
            }
        }

        //Recursively format objects
        for(const [k,v] of objects) {
            const fullPath = fieldPath ? `${fieldPath}.${k}` : k;
            calculateRecursiveProperty(v, fullPath);
        }
    };

    calculateRecursiveProperty(initialObject);
    return result;
};




/***************************************
*  THOROUGH ERROR CONVERSION FOR LOGS  *
* Supporting AWS SDK V3 Error Response *
****************************************/
export const stringifyErrorMessage = (message:any):string => {
  try {
    if(message === undefined) return 'UNDEFINED';
    else if(message === null) return 'NULL';

    //AWS SDK V3 Error Object
    else if(message?.Error?.Code && message?.Error?.Message)
      return `${message.Error.Code}: ${message.Error.Message}`;

    //AWS SDK V2 & JS Error object
    else if(message instanceof Error)
      return `${message.name}: ${message.message}`;

    else if(typeof message === 'object') {
      try {
        return JSON.stringify(message);
      } catch {
        console.log('UNSERIALIZABLE log message:', message);
        return '[UNSERIALIZABLE]';
      }
    }

    else if(typeof message === 'string')
      return (message.trim().length === 0) ? 'BLANK' : message;

    else
        return String(message);
  } catch {
    return '[UNSERIALIZABLE]';
  }
}
