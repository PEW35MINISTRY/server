import { GenderEnum, RoleEnum } from "./profile-types.mjs";

const EMAIL_REGEX = new RegExp(/^(([^<>()\[\]\.,;:\s@\"]+(\.[^<>()\[\]\.,;:\s@\"]+)*)|(\".+\"))@(([^<>()\.,;\s@\"]+\.{0,1})+([^<>()\.,;:\s@\"]{2,}|[\d\.]+))$/);
const DATE_REGEX = new RegExp(/\d{4}-(?:0[1-9]|1[0-2])-(?:0[1-9]|[1-2]\d|3[0-1])T(?:[0-1]\d|2[0-3]):[0-5]\d:[0-5]\dZ/); //1970-01-01T00:00:00.013Z
    
export enum InputType {
    TEXT = 'TEXT',
    NUMBER = 'NUMBER',
    EMAIL = 'EMAIL',
    PASSWORD = 'PASSWORD',
    DATE = 'DATE',
    SELECT_LIST = 'SELECT_LIST',
    PARAGRAPH = 'PARAGRAPH'
}

export class InputField {
    title: string;
    field: string;
    value: string | number;
    type: InputType;
    required: boolean;
    unique: boolean;
    validationRegex: RegExp;
    validationMessage: string;
    selectOptionList: string[] | number[];

    constructor({title, field, value, type=InputType.TEXT, required=false, unique=false, validationRegex=new RegExp('/.*/'), validationMessage='Invalid Input', selectOptionList=[]} :
        {title:string, field:string, value?:number | string, type?: InputType, required?:boolean, unique?:boolean, validationRegex?: RegExp, validationMessage?: string, selectOptionList?: string[]|number[]}) {
        this.title = title;
        this.field = field;
        this.value = value;
        this.type = type;
        this.unique = unique;
        this.required = unique || required;
        this.validationRegex = validationRegex;
        this.validationMessage = validationMessage;
        this.selectOptionList = selectOptionList;
    };

    setValue(value: string | number): void {this.value = value; }

    toJSON() {
        return {
            title: this.title,
            field: this.field,
            value: this.value || '',
            type: this.type,
            required: this.required,
            validationRegex: this.validationRegex.source,
            validationMessage: this.validationMessage,
            selectOptionList: this.selectOptionList
        };
    }
}

const getDateYearsAgo = (years: number = 13):Date => {
    let date = new Date();
    date.setFullYear(date.getFullYear() - years);
    return date;
}

//Note: extending list forces the order, may need a sortID or duplicating for now
export const EDIT_PROFILE_FIELDS = [
    new InputField({title: 'First Name', field: 'firstName', required: true, validationRegex: new RegExp(/.{1,30}/), validationMessage: 'Required, max 30 characters.' }),
    new InputField({title: 'Last Name', field: 'lastName', required: true, validationRegex: new RegExp(/.{1,30}/), validationMessage: 'Required, max 30 characters.' }),
    new InputField({title: 'Public Name', field: 'displayName', unique: true, validationRegex: new RegExp(/.{1,15}/), validationMessage: 'Must be unique, max 15 characters.' }),
    new InputField({title: 'Password', field: 'password', type: InputType.PASSWORD, required: true, validationRegex: new RegExp(/.{5,20}/), validationMessage: 'Required, 5-20 characters.' }),
    new InputField({title: 'Verify Password', field: 'passwordVerify', type: InputType.PASSWORD, required: true, validationRegex: new RegExp(/.{5,20}/), validationMessage: 'Required, must match password field.' }),
    new InputField({title: 'Postal Code', field: 'postalCode', required: true, validationRegex: new RegExp(/.{5,15}/), validationMessage: 'Required, 5-15 characters.' }),
];

export const SIGNUP_PROFILE_FIELDS_STUDENT = [
    new InputField({title: 'First Name', field: 'firstName', required: true, validationRegex: new RegExp(/.{1,30}/), validationMessage: 'Required, max 30 characters.' }),
    new InputField({title: 'Last Name', field: 'lastName', required: true, validationRegex: new RegExp(/.{1,30}/), validationMessage: 'Required, max 30 characters.' }),
    new InputField({title: 'Public Name', field: 'displayName', unique: true, validationRegex: new RegExp(/.{1,15}/), validationMessage: 'Must be unique, max 15 characters.' }),
    new InputField({title: 'Email Address', field: 'email', type: InputType.EMAIL, unique: true,  validationRegex: EMAIL_REGEX, validationMessage: 'Required, invalid email format.' }),
    new InputField({title: 'Password', field: 'password', type: InputType.PASSWORD, required: true, validationRegex: new RegExp(/.{5,20}/), validationMessage: 'Required, 5-20 characters.' }),
    new InputField({title: 'Verify Password', field: 'passwordVerify', type: InputType.PASSWORD, required: true, validationRegex: new RegExp(/.{5,20}/), validationMessage: 'Required, must match password field.' }),
    new InputField({title: 'Postal Code', field: 'postalCode', required: true, validationRegex: new RegExp(/.{5,15}/), validationMessage: 'Required, 5-15 characters.' }),
    new InputField({title: 'Gender', field: 'gender', type: InputType.SELECT_LIST, required: true, selectOptionList: Object.keys(GenderEnum)}),
    new InputField({title: 'Date of Birth', field: 'dateOfBirth', type: InputType.DATE, value: getDateYearsAgo().toJSON(), required: true, validationRegex: DATE_REGEX, validationMessage: 'Required, invalid UTC date format.' }),
];

//SIGNUP all other roles
export const SIGNUP_PROFILE_FIELDS = [    
    new InputField({title: 'Account Type', field: 'userRole', type: InputType.SELECT_LIST, required: true, selectOptionList: Object.keys(RoleEnum)}),
    new InputField({title: 'New Account Token', field: 'token', type: InputType.TEXT, required: true}),
    ...SIGNUP_PROFILE_FIELDS_STUDENT,
];

//SIGNUP and EDIT
export const PROFILE_FIELDS_ADMIN = [    
    new InputField({title: 'Active Account', field: 'isActive', required: true, type: InputType.SELECT_LIST, selectOptionList: ['TRUE', 'FALSE']}),
    ...SIGNUP_PROFILE_FIELDS,
    new InputField({title: 'Walk Level', field: 'walkLevel', required: true, type: InputType.SELECT_LIST, selectOptionList: [1,2,3,4,5,6,7,8,9,10]}),
    new InputField({title: 'Profile Notes', field: 'notes', type: InputType.PARAGRAPH, validationRegex: new RegExp(/.{0,3000}/), validationMessage: 'Max 3000 characters.'}),
];
