import { createHash } from 'crypto';
import { S3Client, ListBucketsCommand } from '@aws-sdk/client-s3';
import { getEnvBase, getEnvEnumBase, getEnvironment as getEnvironmentSource } from './env-utilities.mjs';
import { ENVIRONMENT_TYPE } from '../../0-assets/field-sync/input-config-sync/inputField.mjs';
import { DATABASE_MODEL_SOURCE_ENVIRONMENT_ENUM } from '../2-database/database-types.mjs';
import * as log from './logging/log.mjs';
import { AWSMetadata } from '../4-email/email-types.mjs';



/**************************************************************
 * ENVIRONMENT MODEL SOURCE SETTINGS                          *
 *  - Effects new models & search cache                       *
 *  - Only applies to user table; circles inherit from leader *
 **************************************************************/
export const getEnv = <T=string,>(name:string, expectedType:'string' | 'number' | 'boolean' = 'string', defaultValue?:T):T | undefined => getEnvBase<T>(log.warn, name, expectedType, defaultValue);

export const getEnvEnum = <T extends Record<string, string>>(name:string, enumObject:T, defaultValue?:T[keyof T]):T[keyof T]|undefined => getEnvEnumBase<T>(log.error, name, enumObject, defaultValue);

//TODO: Temporary redirect to single source
export const getEnvironment = ():ENVIRONMENT_TYPE => getEnvironmentSource();

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


//Undefined indicates Local and non-EC2 without accessible IMDS
export const getAWSMetadata = async():Promise<AWSMetadata | undefined> => {
    try {
        const tokenResponse:Response = await fetch('http://169.254.169.254/latest/api/token', {
            method: 'PUT', headers: { 'X-aws-ec2-metadata-token-ttl-seconds': '21600' },
        });

        if(!tokenResponse.ok) return undefined;
        const token:string = await tokenResponse.text();

        const getValue = async(path:string):Promise<string> => {
            const response:Response = await fetch(`http://169.254.169.254${path}`, {
                method: 'GET', headers: { 'X-aws-ec2-metadata-token': token },
            });

            if(!response.ok) 
                throw new Error('metadata fetch failed');
            else
                return response.text();
        };

        const availabilityZone:string = await getValue('/latest/meta-data/placement/availability-zone');
        return {
            instanceID: await getValue('/latest/meta-data/instance-id'),
            instanceType: await getValue('/latest/meta-data/instance-type'),
            availabilityZone,
            awsRegion: availabilityZone ? availabilityZone.slice(0, -1) : '',
            publicIP: await getValue('/latest/meta-data/public-ipv4').catch(() => ''),
            privateIP: await getValue('/latest/meta-data/local-ipv4').catch(() => ''),
            publicHostname: await getValue('/latest/meta-data/public-hostname').catch(() => ''),
        };
    } catch {
        console.log('Uncaught error while fetching AWS Metadata.');
        return undefined;
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

    else if(message instanceof Map)
      return JSON.stringify(Array.from(message.entries()));

    else if(message instanceof Set)
      return JSON.stringify(Array.from(message.values()));

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



const SAFE_KEY_REGEX:RegExp = new RegExp(/^[A-Za-z0-9]{4,20}$/);        //Alphanumeric keys, 4-20 characters (anything else skipped)
const SAFE_VALUE_REGEX:RegExp = new RegExp(/[^A-Za-z0-9\-_.@]/, 'g');   //Alphanumeric, dash, underscore, period, @ symbol allowed; (anything else filtered)

export const sanitizeKeyValuePairs = (pairs:Record<string, string|number>, { keyRegexValidation = SAFE_KEY_REGEX, valueFilterRegex = SAFE_VALUE_REGEX, maxItems = Number.POSITIVE_INFINITY, maxLength = Number.POSITIVE_INFINITY }
                                                                         : { keyRegexValidation?:RegExp; valueFilterRegex?:RegExp; maxItems?:number; maxLength?:number } = {}): Record<string,string> => {
    const result: Record<string, string> = {};
    for(const key of Object.keys(pairs).slice(0, maxItems)) {

        if(typeof key !== 'string' || !keyRegexValidation.test(key))
            continue;

        let value = pairs[key];
        if(Array.isArray(value))
            value = value[0];

        if(value == null || (typeof value !== 'string' && typeof value !== 'number'))
            continue;

        const cleanValue = String(value).replace(valueFilterRegex, '').slice(0, maxLength);

        if(cleanValue.length > 0)
            result[key] = cleanValue;
    }

    return result;
}


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
