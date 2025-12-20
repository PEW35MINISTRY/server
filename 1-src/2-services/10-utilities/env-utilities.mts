import { ENVIRONMENT_TYPE } from "../../0-assets/field-sync/input-config-sync/inputField.mjs";

/***************************************************************************
* Base Utility for retrieving Environment Variables                        *
* Logger is required parameter fo avoid circular dependencies with log.mts *
* Use simplified wrappers in utilities.mts for most use cases              *
****************************************************************************/

/* Parse Environment | Required, terminate if missing */
export const getEnvironment = ():ENVIRONMENT_TYPE => {
    const environmentValue:string | undefined = getEnvBase<string>(console.error, 'ENVIRONMENT', 'string');

    if(environmentValue === ENVIRONMENT_TYPE.LOCAL) return ENVIRONMENT_TYPE.LOCAL;
    if(environmentValue === ENVIRONMENT_TYPE.DEVELOPMENT) return ENVIRONMENT_TYPE.DEVELOPMENT;
    if(environmentValue === ENVIRONMENT_TYPE.PRODUCTION) return ENVIRONMENT_TYPE.PRODUCTION;

    throw new Error(`Missing ENVIRONMENT variable:${environmentValue}`);
}

export const isEnvironment = (...environments:ENVIRONMENT_TYPE[]):boolean => environments.includes(getEnvironment());


/* Retrieve Environment variable and cast accordingly */
export const getEnvBase = <T=string,>(logger:(...args:string[]) => void, name:string, expectedType:'string' | 'number' | 'boolean' = 'string', defaultValue?:T):T | undefined => {
    const rawValue:string | undefined = process.env[name];
    if(rawValue === undefined || rawValue === undefined || String(rawValue).trim() === '') {
        if(defaultValue === undefined) logger('Missing Environment Variable with No default provided:', name);
        return defaultValue;
    }

    const value:string = String(rawValue).trim();
    if(expectedType === undefined || expectedType === 'string') return value as T;

    if(expectedType === 'number') {
        const numeric: number = Number(value);
        return Number.isNaN(numeric) ? defaultValue : (numeric as T);
    }

    if(expectedType === 'boolean') {
        const val: string = value.toLowerCase();
        if(val === 'true') return true as T;
        if(val === 'false') return false as T;
        return defaultValue;
    }

    return defaultValue;
}


/* Retrieve Environment variable and verify valid enum selection */
export const getEnvEnumBase = <T extends Record<string, string>>(logger:(...args:string[]) => void, name:string, enumObject:T, defaultValue?:T[keyof T]):T[keyof T]|undefined => {
  const rawValue = getEnvBase(logger, name, 'string', defaultValue);

  const allowedOptions:string[] = Object.values(enumObject) as string[];
  if(allowedOptions.includes(rawValue)) 
    return (rawValue as T[keyof T]);
  else {
    logger('Invalid Environment Variable Enum:', name, rawValue, 'Valid Options Include:', ...allowedOptions);
    return defaultValue;
  }
}

/* String test used for validations */
export const getEnvExists = (name:string, options?:string[]):string | undefined => {
  const rawValue:string|undefined = process.env[name];

  if(rawValue === undefined || rawValue === null) return undefined;

  const value:string = String(rawValue).trim();
  if(value === '') return undefined;

  if(options && !options.includes(value)) {
    return undefined;
  }

  return value;
}
