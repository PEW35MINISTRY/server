import * as log from '../10-utilities/logging/log.mjs';
import fs, { PathLike, readFileSync } from 'fs';
import path from 'path';
const __dirname = path.resolve();
import { htmlVerticalSpace } from './components/email-template-components.mjs';


/*******************************
* APPLY DATA TO HTML TEMPLATES *
********************************/

export enum EMAIL_TEMPLATE_TYPE {
    SIMPLE = 'SIMPLE',
    TABLE_ROWS = 'TABLE_ROWS',
}

const BODY_EXPECTING_TABLE_ROWS:EMAIL_TEMPLATE_TYPE[] = [EMAIL_TEMPLATE_TYPE.TABLE_ROWS];

const getTemplateFilePath = (type:EMAIL_TEMPLATE_TYPE):PathLike => {
    switch(type) {
        case EMAIL_TEMPLATE_TYPE.TABLE_ROWS: return path.join(__dirname, '1-src', '2-services', '4-email', 'templates', 'table_rows.html');
        default: return path.join(__dirname, '1-src', '2-services', '4-email', 'templates', 'simple.html');
    }
}

//String replacements in html templates; (Must still occur in corresponding template)
export enum EMAIL_REPLACEMENT {
    EMAIL_SUBJECT = '[EMAIL_SUBJECT]',
    MESSAGE = '[MESSAGE]',
    DATE = '[DATE]',
    ENVIRONMENT = '[ENVIRONMENT]',
    BODY = '[BODY]', //Alternative to bodyList
}


export const applyTemplate=async({type, replacementMap=new Map<EMAIL_REPLACEMENT,string>(), bodyList = [], verticalSpacing = 0}:
                                {type:EMAIL_TEMPLATE_TYPE; replacementMap?:Map<EMAIL_REPLACEMENT,string>; bodyList?:string[]; verticalSpacing?:number}):Promise<string|undefined> => {
    try {
        let html:string = await readFileSync(getTemplateFilePath(type), 'utf-8');

        //Simple String Replacements
        for(const [key, value] of replacementMap) {
            html = html.replace(key, value);
        }

        //Custom Body Components
        html = html.replace(EMAIL_REPLACEMENT.BODY, bodyList.map(row => BODY_EXPECTING_TABLE_ROWS.includes(type) ? 
            `<tr><td align="center" valign="top">${row}</td></tr>`
            : row
        ).join(verticalSpacing ? 
                `\n${BODY_EXPECTING_TABLE_ROWS.includes(type) ? 
                    `<tr><td>${htmlVerticalSpace(verticalSpacing)}</td></tr>`
                    : htmlVerticalSpace(verticalSpacing)}\n`
                : '\n'
        ));

        return html;
    } catch(error) {
        log.error(`Error Applying Email ${type} Template`, error, getTemplateFilePath(type), JSON.stringify(replacementMap));
        return undefined;
    }
}


