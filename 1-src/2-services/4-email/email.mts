import * as log from '../10-utilities/logging/log.mjs';
import LOG_ENTRY from '../10-utilities/logging/logEntryModel.mjs';
import { EMAIL_SENDER_ADDRESS } from './email-types.mjs';
import { applyTemplate, EMAIL_REPLACEMENTS, EMAIL_TEMPLATE_TYPE } from './email-template-manager.mjs';
import { DB_SELECT_USER } from '../2-database/queries/user-queries.mjs';
import { htmlActionButton, renderDatabaseTableUsage as renderDatabaseTableUsage, htmlFooter, renderLogList, htmlSummaryTable, htmlUserRoleDistribution, htmlUserStats, htmlUserWalkLevelDistribution } from './email-template-components.mjs';
import USER from '../1-models/userModel.mjs';
import { getEnvironment } from '../10-utilities/utilities.mjs';
import { makeDisplayText } from '../../0-assets/field-sync/input-config-sync/inputField.mjs';
import { LogType } from '../../0-assets/field-sync/api-type-sync/utility-types.mjs';
import { sendLogTextEmail, sendTemplateEmail, sendTextEmail } from './email-transporter.mjs';


/***********************************
* EXPORTED EMAIL TEMPLATE HANDLERS *
************************************/
export const sendEmailMessage = async(subject:string, message:string, sender:EMAIL_SENDER_ADDRESS, ...usedIDList:number[]):Promise<boolean> => {
    // const recipientMap: Map<number, string> = await DB_SELECT_USER_BATCH_EMAIL_MAP(usedIDList); //Validated in sendTemplateEmail

//TODO TEMP
const recipientMap:Map<number, string> = new Map([[-1, EMAIL_SENDER_ADDRESS.ADMIN]]);

    const htmlTemplate = await applyTemplate(EMAIL_TEMPLATE_TYPE.MESSAGE, new Map([[EMAIL_REPLACEMENTS.MESSAGE, message]]));

    const successfullySent:boolean = await sendTemplateEmail(subject, htmlTemplate, sender, recipientMap);

    //Re-attempt | Failed logging handled in sendTemplateEmail
    if(!successfullySent && recipientMap.size === 1 && sender === EMAIL_SENDER_ADDRESS.SERVER) {
        return await sendTextEmail(subject, message, sender, recipientMap);
    }

    return successfullySent;
};

export const sendEmailAction = async(subject:string, message:string, sender:EMAIL_SENDER_ADDRESS, recipient:string|number, actionLabel:string, actionLink:string):Promise<boolean> => {
    //Recipient can be either email address or userID in which case will fetch email from database
    const recipientMap:Map<number, string> = new Map();
    if (typeof recipient === 'string')
        recipientMap.set(-1, recipient);
    else {
        const user:USER = await DB_SELECT_USER(new Map([['userID', recipient]]), false);
        if (user.isValid)
            recipientMap.set(user.userID, user.email);
    }

    const templateHtml = await applyTemplate(EMAIL_TEMPLATE_TYPE.MESSAGE,
        new Map([[EMAIL_REPLACEMENTS.RECIPIENT, message], [EMAIL_REPLACEMENTS.MESSAGE, message],
        [EMAIL_REPLACEMENTS.SENDER, (sender === EMAIL_SENDER_ADDRESS.ADMIN) ? 'Encouraging Prayer Administration' : 'Encouraging Prayer Support']]),
        [
            htmlActionButton(actionLabel, actionLink),
            htmlFooter(),
        ]
    );

    return await sendTemplateEmail(subject, templateHtml, sender, recipientMap );
}


/*************************
 * HTML REPORT HANDELERS *
 *************************/
export const sendEmailUserReport = async() => {
    const templateHtml = await applyTemplate(EMAIL_TEMPLATE_TYPE.STATS_REPORT,
        new Map([
            [EMAIL_REPLACEMENTS.HEADER, 'User Status Report'],
            [EMAIL_REPLACEMENTS.DATE, `${new Date().toISOString()}`],
            [EMAIL_REPLACEMENTS.ENVIRONMENT, `${getEnvironment()}`],
        ]),
        [   
            await renderDatabaseTableUsage(['user']),
            await htmlUserStats(),
            await htmlUserRoleDistribution(),
            await htmlUserWalkLevelDistribution(),

            //TODO Partnerships

            //TODO Unmached Partners

            //TODO  new Users with emails to reach out?

            // await htmlLogList(LogType.ERROR, 50),
            // await htmlLogList(LogType.WARN, 25),
            // await htmlLogList(LogType.DB, 25),
            // htmlActionButton('See Latest Logs', `${process.env.ENVIRONMENT_BASE_URL}/portal/logs`),
        ]
    );

    const successfullySent: boolean = await sendTemplateEmail(
        `EP User Status | ${makeDisplayText(getEnvironment())} Environment`, templateHtml,
        EMAIL_SENDER_ADDRESS.SERVER, new Map([[-1, EMAIL_SENDER_ADDRESS.ADMIN]]));

    return successfullySent;
};


/********************************
 * LOGS & ADMIN REPORT HANDLERS *
 ********************************/
export const sendEmailLogAlert = async(entry: LOG_ENTRY) => {
    const templateHtml = await applyTemplate(EMAIL_TEMPLATE_TYPE.MESSAGE,
        new Map([[EMAIL_REPLACEMENTS.RECIPIENT, 'Admins'], [EMAIL_REPLACEMENTS.MESSAGE, entry.toString()], [EMAIL_REPLACEMENTS.SENDER, `${makeDisplayText(getEnvironment())} Environment`]]),
        [
            htmlActionButton('See Latest Logs', `${process.env.ENVIRONMENT_BASE_URL}/portal/logs`),
        ]
    );

    const successfullySent: boolean = await sendLogTextEmail(
        `EP ALERT | ${getEnvironment()} Environment`, templateHtml,
        new Map([[-1, EMAIL_SENDER_ADDRESS.ADMIN]]));

    //Re-attempt | Failed logging handled in sendTemplateEmail
    if(!successfullySent) {
        return await sendTextEmail(`EP ALERT | ${getEnvironment()} Environment`, entry.toString(), EMAIL_SENDER_ADDRESS.SERVER, new Map([[-1, EMAIL_SENDER_ADDRESS.ADMIN]]));
    }

    return successfullySent;
};


export const sendEmailLogReport = async():Promise<boolean> => {
    const textBody:string =
        `SERVER STATUS REPORT\n`
        + `Date: ${new Date().toISOString()}\n`
        + `Environment: ${getEnvironment()}`
        + '\n\n'
        + await renderDatabaseTableUsage(['user', 'partner', 'circle', 'circle_announcement', 'circle_user', 'prayer_request', 'content', 'subscription'], false)
        + '\n\n'
        + await renderLogList(LogType.ERROR, 50, false)
        + '\n\n'
        + await renderLogList(LogType.WARN, 25, false)
        + '\n\n'
        + await renderLogList(LogType.DB, 25, false)
        + '\n\n'
        + `== See Latest Logs ==\n${process.env.ENVIRONMENT_BASE_URL}/portal/logs`;

    const successfullySent:boolean = await sendLogTextEmail(
        `EP Server Status | ${makeDisplayText(getEnvironment())} Environment`, 
        textBody, new Map([[-1, EMAIL_SENDER_ADDRESS.ADMIN]]));

    return successfullySent;
};
