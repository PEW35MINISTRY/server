import InputField, { InputType } from "./inputField.mjs";

//New Device Entry; endpointARN is assigned by server
export const NOTIFICATION_DEVICE_FIELDS:InputField[] = [
    new InputField({title: 'Device Name', field: 'deviceName', type:InputType.TEXT, validationRegex: new RegExp(/^[a-zA-Z0-9' _.-]{1,100}$/), validationMessage: 'Required, 5-100 chars, letters, numbers, dashes, underscores.' }),
    new InputField({title: 'Token', field: 'deviceToken', type:InputType.TEXT, validationRegex: new RegExp(/^[a-zA-Z0-9.:_-]{1,255}$/), validationMessage: 'Required, 5-100 chars, letters, numbers, dashes, underscores.' })
];

//Only fields saved to out database are editable
export const EDIT_NOTIFICATION_DEVICE_FIELDS_ADMIN:InputField[] = [
    new InputField({title: 'Device Name', field: 'deviceName', type:InputType.TEXT, validationRegex: new RegExp(/^[a-zA-Z0-9' _.-]{1,100}$/), validationMessage: '1-100 chars, letters, numbers, dashes, underscores.' }),
    new InputField({title: 'Endpoint ARN', field: 'endpointARN', type:InputType.TEXT, validationRegex: new RegExp(/^[a-zA-Z0-9.:_-]{1,255}$/), validationMessage: '5-255 chars' })
];
