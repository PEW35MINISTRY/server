import InputField from '../../0-assets/field-sync/input-config-sync/inputField.mjs';
import { JwtRequest } from '../../1-api/2-auth/auth-types.mjs';


/**********************************
   Base Model for Data Structure 
***********************************/
export default interface BASE_MODEL {
    
  modelType:string;

  getID: () => number;

  setID: (id:number) => void;

  isValid: boolean;

  /* Used for JSON parsing */
  hasProperty: (field:string) => boolean;

  getValidProperties: (properties:string[], includeID:boolean) => Map<string, any>;

  getDatabaseProperties: () => Map<string, any>;

  getDatabaseIdentifyingProperties: (model:any) => Map<string, any>;

  toListItem: () => {};

  toString: () => string;

  /** Utility methods for createModelFromJSON **/
  //Returns true/false for matching validation and undefined to continue to general validation
  validateModelSpecificField: ({field, value}:{field:InputField, value:string}) => boolean|undefined;

  //Returns undefined for no-match; indicator to parseInput traditionally | Returns false for error
  parseModelSpecificField: ({field, jsonObj}:{field:InputField, jsonObj:JwtRequest['body']}) => boolean|undefined;
} 