/***** NO DEPENDENCIES - Define all types locally *****/

/*******************************************************
*                    INPUT FIELD                       *
* Sync across all repositories: server, portal, mobile *
********************************************************/

export const SUPPORTED_IMAGE_EXTENSION_LIST = ['png', 'jpg', 'jpeg'];  //Sync with AWS settings

export enum InputType {
    TEXT = 'TEXT',
    NUMBER = 'NUMBER',
    EMAIL = 'EMAIL',
    PASSWORD = 'PASSWORD',
    DATE = 'DATE',
    SELECT_LIST = 'SELECT_LIST',
    MULTI_SELECTION_LIST = 'MULTI_SELECTION_LIST',
    PARAGRAPH = 'PARAGRAPH',
    USER_ID_LIST = 'USER_ID_LIST',        //Indicate fetch & display user contact list
    CIRCLE_ID_LIST = 'CIRCLE_ID_LIST',    //Indicate fetch & display circle membership list
}

export const isListType = (type:InputType):boolean => ((type === InputType.MULTI_SELECTION_LIST) || (type === InputType.USER_ID_LIST) || (type === InputType.CIRCLE_ID_LIST));

export type FieldInput = {
    title: string,
    field: string, 
    value: string | undefined,
    type: InputType,
    required: boolean,
    validationRegex: string,
    validationMessage: string,
    selectOptionList: string[] | number[]
}

export default class InputField {
    title: string;
    field: string;
    value: string | undefined;
    type: InputType;
    required: boolean;
    unique: boolean;
    hide: boolean;
    validationRegex: RegExp;
    validationMessage: string;
    selectOptionList: string[];
    displayOptionList: string[];

    constructor({title, field, value, type=InputType.TEXT, required=false, unique=false, hide=false, validationRegex=new RegExp(/.+/), validationMessage='Invalid Input', selectOptionList=[]} :
        {title:string, field:string, value?:string | undefined, type?: InputType, required?:boolean, unique?:boolean, hide?:boolean, validationRegex?: RegExp, validationMessage?: string, selectOptionList?: string[]}) {
        this.title = title;
        this.field = field;
        this.value = value;
        this.type = type;
        this.unique = unique;
        this.required = unique || required;
        this.hide = hide;
        this.validationRegex = validationRegex;
        this.validationMessage = validationMessage;
        this.selectOptionList = selectOptionList;
        this.displayOptionList = makeDisplayList(selectOptionList);

        //Default Handle List Validations
        if(type == InputType.SELECT_LIST && validationRegex.source === '.+') {
            this.validationRegex = new RegExp(selectOptionList.join('|'));
            this.validationMessage = 'Please Select'
        }
    };

    setValue(value: string): void {this.value = value; }

    toJSON():FieldInput|undefined {
        return this.hide ? undefined
        : {
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

//Converts underscores to spaces and capitalizes each word
export const makeDisplayList = (list:string[]):string[] => list.map(value => value.toLowerCase().split('_'||' ').map((s) => s.charAt(0).toUpperCase() + s.substring(1)).join(' '));
