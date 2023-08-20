/***** NO DEPENDENCIES - Define all types locally *****/

/*******************************************************
*        PRAYER REQUEST FIELD CONFIGURATION FILE
* Sync across all repositories: server, portal
*******************************************************/
export const DATE_REGEX = new RegExp(/^\d{4}-[01]\d-[0-3]\dT[0-2]\d:[0-5]\d:[0-5]\d\.\d+([+-][0-2]\d:[0-5]\d|Z)$/); //1970-01-01T00:00:00.013Z
    
/***************************************
*    PRAYER REQUEST TYPES AND DEPENDENCIES
****************************************/
//Note: enums must have matching values to cast (string as Enum) or define (Enum[string]) equally
export enum PrayerRequestTagEnum { //List doesn't sync with database; stored as list of strings stringified as `tagsStringified`
    SELF = 'SELF',
    FAMILY = 'FAMILY',
    SCHOOL = 'SCHOOL',
    HEALING = 'HEALING',
    PRAISE = 'PRAISE',
    GLOBAL = 'GLOBAL'
}

export enum InputType {
    TEXT = 'TEXT',
    NUMBER = 'NUMBER',
    EMAIL = 'EMAIL',
    PASSWORD = 'PASSWORD',
    DATE = 'DATE',
    SELECT_LIST = 'SELECT_LIST',
    MULTI_SELECTION_LIST = 'MULTI_SELECTION_LIST',
    PARAGRAPH = 'PARAGRAPH'
}

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

export class InputField {
    title: string;
    field: string;
    value: string | undefined;
    type: InputType;
    required: boolean;
    unique: boolean;
    validationRegex: RegExp;
    validationMessage: string;
    selectOptionList: string[];
    displayOptionList: string[];

    constructor({title, field, value, type=InputType.TEXT, required=false, unique=false, validationRegex=new RegExp(/.+/), validationMessage='Invalid Input', selectOptionList=[]} :
        {title:string, field:string, value?:string | undefined, type?: InputType, required?:boolean, unique?:boolean, validationRegex?: RegExp, validationMessage?: string, selectOptionList?: string[]}) {
        this.title = title;
        this.field = field;
        this.value = value;
        this.type = type;
        this.unique = unique;
        this.required = unique || required;
        this.validationRegex = validationRegex;
        this.validationMessage = validationMessage;
        this.selectOptionList = selectOptionList;
        this.displayOptionList = makeDisplayList(selectOptionList);

        //Default Handle List Validations
        if(type == InputType.SELECT_LIST && validationRegex.source === '.+') {
            this.validationRegex = new RegExp(selectOptionList.join("|"));
            this.validationMessage = 'Please Select'
        }
    };

    setValue(value: string): void {this.value = value; }

    toJSON():FieldInput {
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

//Converts underscores to spaces and capitalizes each word
export const makeDisplayList = (list:string[]):string[] => list.map(value => value.toLowerCase().split('_'||' ').map((s) => s.charAt(0).toUpperCase() + s.substring(1)).join(' '));

export const getDateDaysFuture = (days: number = 14):Date => {
    let date = new Date();
    date.setDate(date.getDate() + days);
    return date;
}

/*********************************************************************************
*   FIELD LISTS: CREATE | EDIT =>  Used for dynamic display 
**********************************************************************************/

export const CREATE_REQUEST_FIELDS:InputField[] = [
    new InputField({title: 'Topic', field: 'topic', required: true, type: InputType.TEXT, validationRegex: new RegExp(/.{1,30}/), validationMessage: 'Required, max 30 characters.' }),
    new InputField({title: 'Description', field: 'description', required: true, type: InputType.PARAGRAPH, validationRegex: new RegExp(/.{0,200}/), validationMessage: 'Max 200 characters.'}),
    new InputField({title: 'Long Term', field: 'isOnGoing', value: 'false', type: InputType.SELECT_LIST, selectOptionList: ['true', 'false']}),
    new InputField({title: 'Category', field: 'tagList', type: InputType.MULTI_SELECTION_LIST, selectOptionList: Object.values(PrayerRequestTagEnum)}),
    new InputField({title: 'Relevance', field: 'expirationDate', required: true, type: InputType.DATE, value: getDateDaysFuture().toISOString(), validationRegex: DATE_REGEX, validationMessage: 'Required, must be future date.' })
    //addUserRecipientIDList:number[]
    //addCircleRecipientIDList:number[]
];

export const EDIT_PRAYER_REQUEST_FIELDS:InputField[] = [
    new InputField({title: 'Resolved', field: 'isResolved', value: 'false', type: InputType.SELECT_LIST, selectOptionList: ['true', 'false']}),
    ...CREATE_REQUEST_FIELDS,
    //addUserRecipientIDList:number[]
    //addCircleRecipientIDList:number[]
    //removeUserRecipientIDList:number[]
    //removeCircleRecipientIDList:number[]
];

export const PRAYER_REQUEST_FIELDS_ADMIN:InputField[] = [
    ...EDIT_PRAYER_REQUEST_FIELDS,
    new InputField({title: 'Prayer Count', field: 'prayerCount', type: InputType.NUMBER})
];

export const PRAYER_REQUEST_COMMENT_FIELDS:InputField[] = [
    new InputField({title: 'Comment', field: 'message',  required: true, type: InputType.TEXT, validationRegex: new RegExp(/.{10,200}/), validationMessage: 'Required, max 200 characters.' }),
];
