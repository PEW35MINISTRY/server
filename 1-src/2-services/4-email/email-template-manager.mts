import { PathLike } from 'fs';
import fs, { readFileSync } from 'fs';
import path, { join } from 'path';
const __dirname = path.resolve();
import * as log from '../10-utilities/logging/log.mjs';


/*******************************
* APPLY DATA TO HTML TEMPLATES *
********************************/

export enum EMAIL_TEMPLATE_TYPE {
    MESSAGE = 'MESSAGE',
    STATS_REPORT = 'STATS_REPORT',
}

const getTemplateFilePath = (type:EMAIL_TEMPLATE_TYPE):PathLike => {
    switch(type) {
        case EMAIL_TEMPLATE_TYPE.STATS_REPORT: return path.join(__dirname, '1-src', '2-services', '4-email', 'templates', 'stats_report.html');
        default: return path.join(__dirname, '1-src', '2-services', '4-email', 'templates', 'message.html'); //Simple Message
    }
}

//String replacements in html templates
export enum EMAIL_REPLACEMENTS {
    HEADER = '[HEADER]',
    RECIPIENT = '[RECIPIENT]',
    MESSAGE = '[MESSAGE]',
    DATE = '[DATE]',
    ENVIRONMENT = '[ENVIRONMENT]',
    BODY = '[BODY]', //Includes components in email-template-components.mts added to bodyHtmlList
    SENDER = '[SENDER]',
    FOOTER = '[FOOTER]',
}

export const applyTemplate = async(type:EMAIL_TEMPLATE_TYPE, replacementMap:Map<EMAIL_REPLACEMENTS, string> = new Map(), bodyHtmlList:string[] = []):Promise<string> => {
    try {
        let html:string = await readFileSync(getTemplateFilePath(type), 'utf-8');

        //Simple String Replacements
        for(const [key, value] of replacementMap) {
            html = html.replace(key, value);
        }

        //Custom Body Components
        html = html.replace(EMAIL_REPLACEMENTS.BODY, bodyHtmlList.join('\n\n'));
        html = html.replace(EMAIL_REPLACEMENTS.FOOTER, bodyHtmlList.join('\n\n'));

        return html;
    } catch(error) {
        log.error(`Error Applying Email ${type} Template`, error, getTemplateFilePath(type), JSON.stringify(replacementMap), ...bodyHtmlList);
        return [...Array.from(replacementMap.values()), ...bodyHtmlList].join('\n\n');
    }
}


