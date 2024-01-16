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
    CUSTOM_STRING_LIST = 'CUSTOM_STRING_LIST',
    RANGE_SLIDER = 'MAX_MIN_SLIDER',
}

export const isListType = (type:InputType):boolean => [InputType.MULTI_SELECTION_LIST, InputType.USER_ID_LIST, InputType.CIRCLE_ID_LIST, InputType.CUSTOM_STRING_LIST].includes(type)

export type FieldInput = { //For toJSON() response
    title: string,
    field: string, 
    value: string | undefined,
    type: InputType,
    required: boolean,
    validationRegex: string,
    validationMessage: string,
}

export default class InputField {
    title: string;
    field: string;
    customField: string | undefined; //Handle Individual Parsing in Model.parseModelSpecificField
    value: string | undefined;
    type: InputType;
    required: boolean;
    unique: boolean;
    hide: boolean;
    validationRegex: RegExp;
    validationMessage: string;

    constructor({title, field, customField, value, type=InputType.TEXT, required=false, unique=false, hide=false, validationRegex=new RegExp(/.+/), validationMessage='Invalid Input' }
        : {title:string, field:string, customField?:string | undefined, value?:string | undefined, type?: InputType, required?:boolean, unique?:boolean, hide?:boolean, validationRegex?: RegExp, validationMessage?: string}) {
        this.title = title;
        this.field = field;
        this.customField = customField;
        this.value = value;
        this.type = type;
        this.unique = unique;
        this.required = unique || required;
        this.hide = hide;
        this.validationRegex = validationRegex;
        this.validationMessage = validationMessage;
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
            validationMessage: this.validationMessage
        };
    }
}

export class InputSelectionField extends InputField {
    selectOptionList: string[];
    displayOptionList: string[];

    constructor({title, field, customField, value, type, required, unique, hide, validationRegex, validationMessage,  
        selectOptionList } :
        {title:string, field:string, customField?:string | undefined, value?:string | undefined, type?: InputType, required?:boolean, unique?:boolean, hide?:boolean, validationRegex?: RegExp, validationMessage?: string, 
            selectOptionList:string[] }) {

        super({title, field, customField, value, type, required, unique, hide, validationRegex, validationMessage});

        this.selectOptionList = selectOptionList;
        this.displayOptionList = makeDisplayList(selectOptionList);

        //Default Handle List Validations
        if(type == InputType.SELECT_LIST && validationRegex?.source === '.+') { //Testing against InputField default
            this.validationRegex = new RegExp(selectOptionList.join('|'));
            this.validationMessage = 'Please Select'
        }

        if(![InputType.SELECT_LIST, InputType.MULTI_SELECTION_LIST].includes(this.type)) throw new Error(`InputSelectionField - ${field} - Invalid type: ${type}`);
    }
}

export class InputRangeField extends InputField {
    minValue: number | Date;
    maxValue: number | Date;
    maxField?: string; //If supplied, implies 'field' is minField and using MAX_MIN_SLIDER

    constructor({title, field, customField, value, type, required, unique, hide, validationRegex, validationMessage,
            minValue, maxValue, maxField } :
        {title:string, field:string, customField?:string | undefined, value?:string | undefined, type?: InputType, required?:boolean, unique?:boolean, hide?:boolean, validationRegex?: RegExp, validationMessage?: string, 
            minValue: number|Date, maxValue: number|Date, maxField?: string }) {

        super({title, field, customField, value, type, required, unique, hide, validationRegex, validationMessage});

        this.minValue = minValue;
        this.maxValue = maxValue;
        this.maxField = maxField;

        if(![InputType.RANGE_SLIDER, InputType.DATE].includes(this.type)) throw new Error(`InputRangeField - ${field} - Invalid type: ${type}`);
    }
}

/*************
 * UTILITIES *
 *************/

//Converts underscores to spaces and capitalizes each word
export const makeDisplayList = (list:string[]):string[] => list.map(value => value.toLowerCase().split('_'||' ').map((s) => s.charAt(0).toUpperCase() + s.substring(1)).join(' '));

//For parsing JSON Response vs FIELD_LIST and optional field properties
export const checkFieldName = (FIELD_LIST:InputField[], fieldName:string, required?:boolean, unique?:boolean, hide?:boolean):boolean =>
    FIELD_LIST.some(f => ((
        (f.field === fieldName) 
        || (f.customField === fieldName) 
        || ((f instanceof InputRangeField) && (f.maxField === fieldName))
    )
    && (required === undefined || f.required)
    && (unique === undefined || f.unique)
    && (hide === undefined || f.hide)
));
