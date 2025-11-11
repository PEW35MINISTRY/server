import * as log from '../10-utilities/logging/log.mjs';
import LOG_ENTRY from '../10-utilities/logging/logEntryModel.mjs';
import { EMAIL_SENDER_ADDRESS } from './email-types.mjs';
import { applyTemplate, EMAIL_REPLACEMENTS, EMAIL_TEMPLATE_TYPE } from './email-template-manager.mjs';
import { DB_SELECT_USER, DB_SELECT_USER_BATCH_EMAIL_MAP } from '../2-database/queries/user-queries.mjs';
import USER from '../1-models/userModel.mjs';
import { getEnvironment } from '../10-utilities/utilities.mjs';
import { makeDisplayText } from '../../0-assets/field-sync/input-config-sync/inputField.mjs';
import { LogType } from '../../0-assets/field-sync/api-type-sync/utility-types.mjs';
import { sendLogTextEmail, sendTemplateEmail, sendTextEmail } from './email-transporter.mjs';
import { htmlSummaryTable } from './components/email-template-table.mjs';
import { htmlPartnershipBlock, renderEmailCircle, renderEmailCircleAnnouncements, renderEmailCircleAnnouncementsAll, renderEmailCircleList, renderEmailPartnership, renderEmailProfile } from './components/email-template-items.mjs';
import { htmlHeader, htmlTitle, htmlText, htmlNumberedList, htmlBulletList, htmlSection, htmlAccessCode, htmlActionButton, htmlFooter, htmlVerticalSpace, htmlDetailList } from './components/email-template-components.mjs';
import { renderDatabaseTableUsage, htmlUserStats, htmlUserRoleDistribution, htmlUserWalkLevelDistribution, renderLogList } from './components/email-template-renders.mjs';
import { formatDate, getEmailSignature } from './email-utilities.mjs';
import { WebsiteSubscription } from '../../1-api/2-auth/auth-types.mjs';
import { DB_SELECT_EMAIL_SUBSCRIPTION_RECENT } from '../2-database/queries/queries.mjs';
import { NewPartnerListItem } from '../../0-assets/field-sync/api-type-sync/profile-types.mjs';
import { DB_SELECT_PENDING_PARTNER_PAIR_LIST, DB_SELECT_UNASSIGNED_PARTNER_USER_LIST } from '../2-database/queries/partner-queries.mjs';
import { DATABASE_TABLE } from '../2-database/database-types.mjs';



/***************************************
* TRANSACTIONAL BRANDED EMAIL HANDLERS *
****************************************/
export const sendEmailMessage = async(subject:string, message:string, ...userIDList:number[]):Promise<boolean> =>
    sendBrandedEmail({subject, sender:EMAIL_SENDER_ADDRESS.ADMIN, userIDList, bodyList:[htmlText(message)], 
        getPlainTextBody:(name) => [...(name ? [name + ','] : []), message, '\n', ...getEmailSignature(EMAIL_SENDER_ADDRESS.ADMIN)].join('\n')});

export const sendEmailAction = async({subject, message, buttonTitle, buttonList, sender=EMAIL_SENDER_ADDRESS.SYSTEM, userIDList}:{subject:string, message?:string, buttonTitle?:string, buttonList:{label:string; link:string; style?:'PRIMARY'|'ACCENT'|'OUTLINE'}[], sender?:EMAIL_SENDER_ADDRESS, userIDList:number[]}) =>
    sendBrandedEmail({subject, sender, userIDList, bodyList:[
        ...(message ? [htmlText(message)] : []),
        htmlActionButton(buttonList, buttonTitle)
    ],
    getPlainTextBody:(name) => [...(name ? [name + ','] : []), message, '\n\n', ...buttonList.map(b=>`\n${b.label}: ${b.link}`), '\n\n', ...getEmailSignature(sender)].join('\n')});


export const sendEmailToken = async({subject, token, message, buttonTitle, buttonList, sender=EMAIL_SENDER_ADDRESS.SYSTEM, userIDList}:{subject:string, token:string, message?:string, buttonTitle?:string, buttonList?:{label:string; link:string; style?:'PRIMARY'|'ACCENT'|'OUTLINE'}[], sender?:EMAIL_SENDER_ADDRESS, userIDList:number[]}) =>
    sendBrandedEmail({subject, sender, userIDList, bodyList:[
        ...(message ? [htmlText(message)] : []),
        htmlAccessCode(token),
        ...(message ? [htmlActionButton(buttonList, buttonTitle)] : []),
    ],
    getPlainTextBody:(name) => [...(name ? [name + ','] : []), message, '\n\n', ...buttonList.map(b=>`\n${b.label}: ${b.link}`), '\n\n', ...getEmailSignature(sender)].join('\n')});


//Applies header/footer and provides plainText fallback
const sendBrandedEmail = async({subject, sender = EMAIL_SENDER_ADDRESS.SYSTEM, userIDList, bodyList, getPlainTextBody}:{subject:string, sender:EMAIL_SENDER_ADDRESS, userIDList:number[], bodyList:string[], getPlainTextBody?:(name?:string) => string}):Promise<boolean> => {
    const recipientMap = await DB_SELECT_USER_BATCH_EMAIL_MAP(userIDList); //Validated in sendTemplateEmail
    const firstName:string|undefined = (userIDList.length === 1) ? (await DB_SELECT_USER(new Map([['userID', userIDList[0]]]), false))?.firstName : undefined;

    const html = await applyTemplate({type: EMAIL_TEMPLATE_TYPE.SIMPLE,
        replacementMap: new Map([[EMAIL_REPLACEMENTS.EMAIL_SUBJECT, subject]]),
        bodyList: [
            htmlHeader(firstName ? (firstName + ',') : undefined),
            ...bodyList,
            htmlFooter(getEmailSignature(EMAIL_SENDER_ADDRESS.SYSTEM)),
        ],
        verticalSpacing: 3
    });

    const successfullySent:boolean = await sendTemplateEmail(subject, html, sender, recipientMap);

    //Re-attempt | Failed logging handled in sendTemplateEmail
    if(!successfullySent && getPlainTextBody && (recipientMap.size === 1) && (sender === EMAIL_SENDER_ADDRESS.SYSTEM)) {
        return await sendTextEmail(subject, getPlainTextBody(firstName), sender, recipientMap);
    }
    return successfullySent;
}



/************************
 * HTML REPORT HANDLERS *
 *************************/
export const sendEmailUserReport = async() => {
    const subscriptionList:WebsiteSubscription[] = await DB_SELECT_EMAIL_SUBSCRIPTION_RECENT(90);
    const unassignedProfileList:NewPartnerListItem[] = await DB_SELECT_UNASSIGNED_PARTNER_USER_LIST(200);
    const pendingPartnershipList:[NewPartnerListItem, NewPartnerListItem][] = await DB_SELECT_PENDING_PARTNER_PAIR_LIST(200);

    const templateHtml = await applyTemplate({type: EMAIL_TEMPLATE_TYPE.TABLE_ROWS,
        replacementMap: new Map([[EMAIL_REPLACEMENTS.EMAIL_SUBJECT, 'User Status Report']]),
        bodyList: [
            htmlHeader(),
            htmlSection('User Status Report'),
            await renderDatabaseTableUsage([DATABASE_TABLE.USER], true),
            await htmlUserStats(),
            await htmlUserRoleDistribution(),
            await htmlUserWalkLevelDistribution(),

            htmlTitle('Prayer Request Trends:'),
            await renderDatabaseTableUsage([DATABASE_TABLE.PRAYER_REQUEST, DATABASE_TABLE.PRAYER_REQUEST_COMMENT], true),

            htmlSection('Partnerships'),
            await renderDatabaseTableUsage([DATABASE_TABLE.PARTNER], true),

            htmlTitle('Unassigned Users:'),
            ...unassignedProfileList.slice(0, 10).map(profile => htmlProfileBlock(profile)),
            htmlDetailList([['Total Unassigned Users:', `${unassignedProfileList.length}`]]),

            htmlPartnershipBlock(pendingPartnershipList.slice(0, 10).map(partnerPair => ({ profile: partnerPair[0], partner: partnerPair[1] })), 'Pending Partnerships:', true, [['Total Pending Partnerships:', `${pendingPartnershipList.length}`]]),

            htmlActionButton([{label:'Partnership Management', link:`${process.env.ENVIRONMENT_BASE_URL}/portal/partnership/pending`, style:'PRIMARY'}]),

            ...(subscriptionList.length ? [
                htmlSection('Website Subscriptions:'),
                await renderDatabaseTableUsage([DATABASE_TABLE.SUBSCRIPTION], true),
                htmlDetailList(subscriptionList.map(sub => [
                    formatDate(sub.createdDT),
                    [sub.email, sub.role, sub.note].filter(Boolean).join(' | ')
                ]))] : []),

            htmlDetailList([
                ['Information Generated (CST):', formatDate(new Date(), true)],
                ['Environment:', makeDisplayText(getEnvironment())],
            ], 'Environment Details:'),
            htmlFooter(),
        ],
        verticalSpacing: 5
    });

    const successfullySent:boolean = await sendTemplateEmail(
        `EP User Status | ${makeDisplayText(getEnvironment())} Environment`, templateHtml,
        EMAIL_SENDER_ADDRESS.SYSTEM, new Map([[-1, EMAIL_SENDER_ADDRESS.ADMIN]]));

    return successfullySent;
}


/********************************
 * LOGS & ADMIN REPORT HANDLERS *
 ********************************/
//TODO Auto determine recipients
export const sendEmailLogAlert = async(entry:LOG_ENTRY, ...userIDList:number[]) => 
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
        getPlainTextBody:(name) =>
            [...(name?[name]:[]),
            entry.toString(),
            `\nPortal Logs: ${entry.fileKey}`,
            `\nMore Details: ${process.env.ENVIRONMENT_BASE_URL}/portal/logs\n`,
            renderLogList(LogType.ERROR, 25, false),
      ].join('\n')
    });


export const sendEmailLogReport = async():Promise<boolean> => {
    const textBody:string =
        `SERVER STATUS REPORT\n`
        + `Date:${new Date().toISOString()}\n`
        + `Environment:${getEnvironment()}`
        + '\n\n'
        + await renderDatabaseTableUsage([DATABASE_TABLE.USER, DATABASE_TABLE.PARTNER, DATABASE_TABLE.CIRCLE, DATABASE_TABLE.CIRCLE_ANNOUNCEMENT, DATABASE_TABLE.CIRCLE_USER, DATABASE_TABLE.PRAYER_REQUEST, DATABASE_TABLE.CONTENT, DATABASE_TABLE.SUBSCRIPTION], false)
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
}
function htmlProfileBlock(profile: NewPartnerListItem): any {
    throw new Error('Function not implemented.');
}

