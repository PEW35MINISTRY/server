/***** ONLY DEPENDENCY: ./inputField - Define all other types locally *****/
import InputField, { InputType } from './inputField.mjs';


/*******************************************************
*    NOTIFICATION DEVICE FIELD CONFIGURATION FILE      *
* Sync across all repositories: server, portal, mobile *
*******************************************************/

//New Device Entry; endpointARN is assigned by server
export const NOTIFICATION_DEVICE_FIELDS:InputField[] = [
    new InputField({title: 'Device Name', field: 'deviceName', type:InputType.TEXT, validationRegex: new RegExp(/^[a-zA-Z0-9' _.-]{1,100}$/), validationMessage: 'Required, 5-100 chars, letters, numbers, dashes, underscores.' }),
    new InputField({title: 'Token', field: 'deviceToken', type:InputType.TEXT, validationRegex: new RegExp(/^[a-zA-Z0-9.:_-]{1,255}$/), validationMessage: 'Required, 5-100 chars, letters, numbers, dashes, underscores.' }),
    new InputField({title: 'DeviceOS', field: 'deviceOS', type:InputType.TEXT, validationRegex: new RegExp(/^ANDROID|IOS$/), validationMessage: 'Required, must be one of ANDROID or iOS' })
];

//Only fields saved to out database are editable
export const EDIT_NOTIFICATION_DEVICE_FIELDS_ADMIN:InputField[] = [
    new InputField({title: 'Owner ID', field: 'userID', type: InputType.NUMBER, required:true, validationRegex: new RegExp(/^[0-9]{1,4}$/), validationMessage: 'Owner is Required.' }),
    new InputField({title: 'Device Name', field: 'deviceName', type:InputType.TEXT, validationRegex: new RegExp(/^[a-zA-Z0-9' _.-]{1,100}$/), validationMessage: '1-100 chars, letters, numbers, dashes, underscores.' }),
    new InputField({title: 'Endpoint ARN', field: 'endpointARN', type:InputType.TEXT, validationRegex: new RegExp(/^[a-zA-Z0-9.:_-]{1,255}$/), validationMessage: '1-255 chars' })
];
