import * as log from '../10-utilities/logging/log.mjs';
import LOG_ENTRY from '../10-utilities/logging/logEntryModel.mjs';
import { EMAIL_COLOR, EMAIL_SENDER_ADDRESS, EmailSenderAddress  } from './email-types.mjs';
import { sendLogTextEmail, sendTemplateEmail, sendTextEmail } from './email-transporter.mjs';
import { htmlPartnershipBlock, htmlProfileBlock } from './components/email-template-items.mjs';
import { applyTemplate, EMAIL_REPLACEMENT, EMAIL_TEMPLATE_TYPE } from './email-template-manager.mjs';
import { htmlHeader, htmlTitle, htmlText, htmlSection, htmlAccessCode, htmlActionButton, htmlFooter, htmlVerticalSpace, htmlDetailList } from './components/email-template-components.mjs';
import { renderDatabaseTableUsage, htmlUserStats, htmlUserRoleDistribution, htmlUserWalkLevelDistribution, renderLogList } from './components/email-template-renders.mjs';
import { formatDate, getEmailSignature } from './email-utilities.mjs';
import { DB_SELECT_USER, DB_SELECT_USER_BATCH_EMAIL_MAP } from '../2-database/queries/user-queries.mjs';
import { getEnvironment } from '../10-utilities/utilities.mjs';
import { DATABASE_TABLE } from '../2-database/database-types.mjs';
import { makeDisplayText } from '../../0-assets/field-sync/input-config-sync/inputField.mjs';
import { LogType } from '../../0-assets/field-sync/api-type-sync/utility-types.mjs';
import { WebsiteSubscription } from '../../1-api/2-auth/auth-types.mjs';
import { DB_SELECT_EMAIL_SUBSCRIPTION_RECENT } from '../2-database/queries/queries.mjs';
import { NewPartnerListItem } from '../../0-assets/field-sync/api-type-sync/profile-types.mjs';
import { DB_SELECT_PENDING_PARTNER_PAIR_LIST, DB_SELECT_UNASSIGNED_PARTNER_USER_LIST } from '../2-database/queries/partner-queries.mjs';



/***************************************
* TRANSACTIONAL BRANDED EMAIL HANDLERS *
****************************************/
export const sendEmailMessage = async(subject:string, message:string, ...userIDList:number[]):Promise<boolean> =>
    sendBrandedEmail({subject, sender:EMAIL_SENDER_ADDRESS.ADMIN, userIDList, bodyList:[htmlText(message)], 
        getAlternativeTextBody:(name) => [...(name ? [name + ','] : []), message, '\n', ...getEmailSignature(EMAIL_SENDER_ADDRESS.ADMIN)].join('\n')});

export const sendEmailAction = async({subject, message, buttonTitle, buttonList, sender=EMAIL_SENDER_ADDRESS.SYSTEM, userIDList}:{subject:string, message?:string, buttonTitle?:string, buttonList:{label:string; link:string; style?:'PRIMARY'|'ACCENT'|'OUTLINE'}[], sender?:EmailSenderAddress, userIDList:number[]}) =>
    sendBrandedEmail({subject, sender, userIDList, bodyList:[
        ...(message ? [htmlText(message)] : []),
        htmlActionButton(buttonList, buttonTitle)
    ],
    getAlternativeTextBody:(name) => [...(name ? [name + ','] : []), message, '\n\n', ...buttonList.map(b=>`\n${b.label}: ${b.link}`), '\n\n', ...getEmailSignature(sender)].join('\n')});


export const sendEmailToken = async({subject, token, message, buttonTitle, buttonList, sender=EMAIL_SENDER_ADDRESS.SYSTEM, userIDList}:{subject:string, token:string, message?:string, buttonTitle?:string, buttonList?:{label:string; link:string; style?:'PRIMARY'|'ACCENT'|'OUTLINE'}[], sender?:EmailSenderAddress, userIDList:number[]}) =>
    sendBrandedEmail({subject, sender, userIDList, bodyList:[
        ...(message ? [htmlText(message)] : []),
        htmlAccessCode(token),
        ...(message ? [htmlActionButton(buttonList, buttonTitle)] : []),
    ],
    getAlternativeTextBody:(name) => [...(name ? [name + ','] : []), message, '\n\n', ...buttonList.map(b=>`\n${b.label}: ${b.link}`), '\n\n', ...getEmailSignature(sender)].join('\n')});


//Applies header/footer and provides plainText fallback
const sendBrandedEmail = async({subject, sender = EMAIL_SENDER_ADDRESS.SYSTEM, userIDList, bodyList, getAlternativeTextBody}
                              :{subject:string, sender:EmailSenderAddress, userIDList:number[], bodyList:string[], getAlternativeTextBody?:(name?:string) => string}):Promise<boolean> => {
    const recipientMap = await DB_SELECT_USER_BATCH_EMAIL_MAP(userIDList); //Validated in sendTemplateEmail
    const firstName:string|undefined = (userIDList.length === 1) ? (await DB_SELECT_USER(new Map([['userID', userIDList[0]]]), false))?.firstName : undefined;

    const html = await applyTemplate({type: EMAIL_TEMPLATE_TYPE.SIMPLE,
        replacementMap: new Map([[EMAIL_REPLACEMENT.EMAIL_SUBJECT, subject]]),
        bodyList: [
            htmlHeader(firstName ? (firstName + ',') : undefined),
            ...bodyList,
            htmlFooter(getEmailSignature(EMAIL_SENDER_ADDRESS.SYSTEM)),
        ],
        verticalSpacing: 3
    });

    const successfullySent:boolean = await sendTemplateEmail(subject, html, sender, recipientMap);

    //Re-attempt | Failed logging handled in sendTemplateEmail
    if(!successfullySent && getAlternativeTextBody && (recipientMap.size === 1) && (sender === EMAIL_SENDER_ADDRESS.SYSTEM)) {
        return await sendTextEmail(subject, getAlternativeTextBody(firstName), sender, recipientMap);
    }
    return successfullySent;
}



/************************
 * HTML REPORT HANDLERS *
 *************************/
export const sendEmailUserReport = async(recipientEmail:string, ...userIDList:number[]):Promise<boolean> => {
    const recipientMap = recipientEmail ? new Map<number, string>([[-1, recipientEmail]]) : await DB_SELECT_USER_BATCH_EMAIL_MAP(userIDList);
    const templateHtml = await assembleUserReportHTML();
    return await sendTemplateEmail(`EP User Status | ${makeDisplayText(getEnvironment())} Environment`, templateHtml, EMAIL_SENDER_ADDRESS.SYSTEM, recipientMap);
}

export const assembleUserReportHTML = async():Promise<string> => {
    const subscriptionList:WebsiteSubscription[] = await DB_SELECT_EMAIL_SUBSCRIPTION_RECENT(90);
    const unassignedProfileList:NewPartnerListItem[] = await DB_SELECT_UNASSIGNED_PARTNER_USER_LIST(200);
    const pendingPartnershipList:[NewPartnerListItem, NewPartnerListItem][] = await DB_SELECT_PENDING_PARTNER_PAIR_LIST(200);

    return await applyTemplate({type: EMAIL_TEMPLATE_TYPE.TABLE_ROWS,
        replacementMap: new Map([[EMAIL_REPLACEMENT.EMAIL_SUBJECT, 'User Status Report']]),
        bodyList: [
            htmlHeader(),
            htmlSection('User Status Report', 'left', EMAIL_COLOR.ACCENT),
            htmlVerticalSpace(30),
            await renderDatabaseTableUsage([DATABASE_TABLE.USER], true),
            await htmlUserStats(),
            await htmlUserRoleDistribution(),
            await htmlUserWalkLevelDistribution(),

            htmlTitle('Prayer Request Trends:'),
            await renderDatabaseTableUsage([DATABASE_TABLE.PRAYER_REQUEST, DATABASE_TABLE.PRAYER_REQUEST_COMMENT], true),

            htmlSection('Partnerships', 'left', EMAIL_COLOR.ACCENT),
            await renderDatabaseTableUsage([DATABASE_TABLE.PARTNER], true),

            htmlTitle('Unassigned Users:'),
            ...unassignedProfileList.slice(0, 10).map(profile => htmlProfileBlock(profile, true)),
            htmlDetailList([['Total Unassigned Users:', `${unassignedProfileList.length}`]]),

            htmlPartnershipBlock(pendingPartnershipList.slice(0, 10).map(partnerPair => ({ profile: partnerPair[0], partner: partnerPair[1] })), 'Pending Partnerships:', true, [['Total Pending Partnerships:', `${pendingPartnershipList.length}`]]),

            htmlActionButton([{label:'Partnership Management', link:`${process.env.ENVIRONMENT_BASE_URL}/portal/partnership/pending`, style:'PRIMARY'}]),

            ...(subscriptionList.length ? [
                htmlSection('Website Subscriptions:', 'left', EMAIL_COLOR.ACCENT),
                await renderDatabaseTableUsage([DATABASE_TABLE.SUBSCRIPTION], true),
                htmlDetailList(subscriptionList.map(sub => [
                    formatDate(sub.createdDT),
                    [sub.email, sub.role, sub.note].filter(Boolean).join(' | ')
                ]))] 
                : []),

            htmlDetailList([
                ['Information Generated (CST):', formatDate(new Date(), true)],
                ['Environment:', makeDisplayText(getEnvironment())],
            ], 'Environment Details:'),
            htmlFooter(),
        ],
        verticalSpacing: 5
    });
}


/********************************
 * LOGS & ADMIN REPORT HANDLERS *
 ********************************/
//TODO Auto determine recipients
export const sendEmailLogAlert = async(entry:LOG_ENTRY, ...userIDList:number[]):Promise<boolean> => 
    sendBrandedEmail({
        subject: `EP Alert: System ${entry.type}`,
        sender: EMAIL_SENDER_ADDRESS.SYSTEM,
        userIDList,
        bodyList: [
            htmlText(entry.toString()),
            htmlVerticalSpace(5),
            htmlActionButton([{label:'More Details', link:entry.fileKey, style:'OUTLINE'},
                {label:'Portal Logs', link:`${process.env.ENVIRONMENT_BASE_URL}/portal/logs`, style:'ACCENT'}]),
            htmlSection('Latest Error Logs'),
            await renderLogList(LogType.ERROR, 25, true)
        ],
        getAlternativeTextBody:(name) =>
            [...(name?[name]:[]),
            entry.toString(),
            `\nPortal Logs: ${entry.fileKey}`,
            `\nMore Details: ${process.env.ENVIRONMENT_BASE_URL}/portal/logs\n`,
            renderLogList(LogType.ERROR, 25, false),
      ].join('\n')
    });


export const sendEmailLogReport = async(recipientEmail:string, ...userIDList:number[]):Promise<boolean> => {
    const recipientMap = recipientEmail ? new Map<number, string>([[-1, recipientEmail]]) : await DB_SELECT_USER_BATCH_EMAIL_MAP(userIDList);
    const textBody = await assembleLogReportText();
    return await sendLogTextEmail(`EP Server Status | ${makeDisplayText(getEnvironment())} Environment`, textBody, recipientMap);
}

export const assembleLogReportText = async():Promise<string> => {
    return `SERVER STATUS REPORT\n`
        + `Date:${new Date().toISOString()}\n`
        + `Environment:${getEnvironment()}`
        + '\n\n'
        + await renderDatabaseTableUsage([DATABASE_TABLE.USER, DATABASE_TABLE.PARTNER, DATABASE_TABLE.SUBSCRIPTION], false, 'User Database Usage')
        + '\n\n'
        + await renderDatabaseTableUsage([DATABASE_TABLE.CIRCLE, DATABASE_TABLE.CIRCLE_USER, DATABASE_TABLE.CIRCLE_ANNOUNCEMENT], false, 'Circle Database Usage')
        + '\n\n'
        + await renderDatabaseTableUsage([DATABASE_TABLE.PRAYER_REQUEST, DATABASE_TABLE.CONTENT], false, 'Content Database Usage')
        + '\n\n'
        + await renderLogList(LogType.ERROR, 50, false)
        + '\n\n'
        + await renderLogList(LogType.WARN, 25, false)
        + '\n\n'
        + await renderLogList(LogType.DB, 25, false)
        + '\n\n'
        + `== See Latest Logs ==\n${process.env.ENVIRONMENT_BASE_URL}/portal/logs`;
}
