import { IdentityRequest } from "../../api/auth/auth-types.mjs";
import { InputField } from "./Fields-Sync/profile-field-config.mjs";

/**********************************
   Base Model for Data Structure 
***********************************/
export default interface BASE_MODEL {
    
  modelType:string;

  getID: () => number;

  /* Used for JSON parsing */
  hasProperty: (field:string) => boolean;

  getValidProperties: (properties:string[], includeID:boolean) => Map<string, any>;

  getUniqueDatabaseProperties: (model:any) => Map<string, any>;

  toListItem: () => {};

  toString: () => string;

  /** Utility methods for createModelFromJSON **/
  validateModelSpecificField: ({field, value}:{field:InputField, value:string}) => boolean;

  //Returns undefined for no-match; indicator to parseInput traditionally | Returns false for error
  parseModelSpecificField: ({field, jsonObj}:{field:InputField, jsonObj:IdentityRequest['body']}) => boolean|undefined;
} 