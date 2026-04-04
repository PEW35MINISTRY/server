import * as log from '../10-utilities/logging/log.mjs';
import LOG_ENTRY from '../10-utilities/logging/logEntryModel.mjs';
import { EMAIL_COLOR, EMAIL_SENDER_ADDRESS, EmailReportContent, EmailSenderAddress  } from './email-types.mjs';
import { sendLogTextEmail, sendTemplateEmail, sendTextEmail } from './email-transporter.mjs';
import { htmlNewPartnerProfileTable, htmlPartnershipBlock, htmlProfileBlock } from './components/email-template-items.mjs';
import { applyTemplate, EMAIL_REPLACEMENT, EMAIL_TEMPLATE_TYPE } from './email-template-manager.mjs';
import { htmlHeader, htmlTitle, htmlText, htmlSection, htmlAccessCode, htmlActionButton, htmlFooter, htmlVerticalSpace, htmlDetailList } from './components/email-template-components.mjs';
import { renderDatabaseTableUsage, htmlUserStats, htmlUserRoleDistribution, htmlUserWalkLevelDistribution, renderLogList, renderLogTrendTable } from './components/email-template-renders.mjs';
import { formatDate, getEmailSignature } from './email-utilities.mjs';
import { DB_SELECT_USER, DB_SELECT_USER_BATCH_EMAIL_MAP } from '../2-database/queries/user-queries.mjs';
import { getEnvironment } from '../10-utilities/utilities.mjs';
import { DATABASE_TABLE } from '../2-database/database-types.mjs';
import { makeDisplayText } from '../../0-assets/field-sync/input-config-sync/inputField.mjs';
import { DatabasePartnershipStats, EmailSubscription, LogType } from '../../0-assets/field-sync/api-type-sync/utility-types.mjs';
import { WebsiteSubscription } from '../../1-api/2-auth/auth-types.mjs';
import { DB_SELECT_EMAIL_SUBSCRIPTION_RECENT } from '../2-database/queries/queries.mjs';
import { NewPartnerListItem } from '../../0-assets/field-sync/api-type-sync/profile-types.mjs';
import { DB_CALCULATE_PARTNERSHIP_STATS, DB_SELECT_PENDING_PARTNER_PAIR_LIST, DB_SELECT_UNASSIGNED_PARTNER_USER_LIST } from '../2-database/queries/partner-queries.mjs';
import { DB_SELECT_USER_EMAIL_SUBSCRIPTION_RECIPIENT_MAP } from '../2-database/queries/user-security-queries.mjs';
import { assembleDailyLogReport as assembleDailyLogReportText, assembleLogAlertReport, assembleWeeklySystemReport as assembleWeeklySystemReportText } from './configurations/email-log-reports.mjs';



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
const sendBrandedEmail = async({subject, sender = EMAIL_SENDER_ADDRESS.SYSTEM, userIDList, emailRecipientMap, bodyList, getAlternativeTextBody}
                              :{subject:string, sender:EmailSenderAddress, userIDList:number[], emailRecipientMap?:Map<number, string>, bodyList:string[], getAlternativeTextBody?:(name?:string) => string}):Promise<boolean> => {
    let recipientMap:Map<number, string> = emailRecipientMap ?? await DB_SELECT_USER_BATCH_EMAIL_MAP(userIDList); //Validated in sendTemplateEmail

    const unverifiedEmailUserIDList:number[] = userIDList.filter(id => !recipientMap.has(id));
    if(unverifiedEmailUserIDList.length > 0) log.warn(`sendBrandedEmail :: subject="${subject}" :: Recipients skipped for unverified email addresses=${JSON.stringify(unverifiedEmailUserIDList)}`);
    if(recipientMap.size === 0) return false;

    const firstName:string|undefined = (recipientMap.size === 1) ? (await DB_SELECT_USER(new Map([['userID', recipientMap.keys().next().value]]), false))?.firstName : undefined;

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
export const getEmailReportContent = async(subscription:EmailSubscription):Promise<EmailReportContent> => {
    const subject:string = `EP ${makeDisplayText(subscription)} Report`;
    switch(subscription){
        case EmailSubscription.SYSTEM_DAILY:
            return await assembleDailyLogReportText(LogType.ERROR);

        case EmailSubscription.SYSTEM_WEEKLY:
            return await assembleWeeklySystemReportText();

        case EmailSubscription.USER_WEEKLY:
            return await assembleUserReportHTML();

        case EmailSubscription.PARTNER_MONTHLY:
            return await assemblePartnerReportHTML();

        default:
            log.error(`getEmailReportContent :: Email Report of unsupported subscription type requested: ${subscription}`);
            return { subject, body:'', isHTML: false };
    }
}


export const sendEmailReport = async(subscription:EmailSubscription, emailRecipientMap?:Map<number, string>, sendIndividually:boolean = false):Promise<boolean> => {
    const recipientMap:Map<number, string> = emailRecipientMap ?? await await DB_SELECT_USER_EMAIL_SUBSCRIPTION_RECIPIENT_MAP(subscription);
    if(recipientMap.size === 0)
        return false;

    const { subject, body, isHTML }:EmailReportContent = await getEmailReportContent(subscription);

    if(sendIndividually) //Append unsubscribe link
        return (await Promise.all(
            Array.from(recipientMap.entries()).map(async([receiverID, emailAddress]) =>
                isHTML
                    ? await sendTemplateEmail(subject,
                        body +
                            htmlVerticalSpace(5) +
                            htmlActionButton([
                                { label:'Unsubscribe', link:`${process.env.ENVIRONMENT_BASE_URL}/api/report-unsubscribe/client/${receiverID}/subscription/${subscription}`, style:'OUTLINE' },
                            ]),
                        EMAIL_SENDER_ADDRESS.ADMIN, new Map([[receiverID, emailAddress]])
                    )
                    : await sendLogTextEmail(subject, body + `\n\nUnsubscribe: ${process.env.ENVIRONMENT_BASE_URL}/api/report-unsubscribe/client/${receiverID}/subscription/${subscription}`, new Map([[receiverID, emailAddress]]))
            )
        )).every(Boolean);

    return isHTML
        ? await sendTemplateEmail(subject,
            body +
                htmlVerticalSpace(5) +
                htmlDetailList([
                    ['*', `Contact ${EMAIL_SENDER_ADDRESS.ADMIN} to unsubscribe from ${makeDisplayText(subscription)}.`],
                ]),
            EMAIL_SENDER_ADDRESS.ADMIN, recipientMap )
        : await sendLogTextEmail(subject, body + `\n\n* Contact ${EMAIL_SENDER_ADDRESS.ADMIN} to unsubscribe from ${makeDisplayText(subscription)}.`, recipientMap);
}


/********************************
 * LOGS & ADMIN REPORT HANDLERS *
 ********************************/
export const sendEmailLogAlert = async(entry:LOG_ENTRY):Promise<boolean> => {
    const recipientMap:Map<number, string> = await DB_SELECT_USER_EMAIL_SUBSCRIPTION_RECIPIENT_MAP(EmailSubscription.SYSTEM_IMMEDIATE);
    const textBody:string[] = await assembleLogAlertReport(entry, false);
    
    return sendBrandedEmail({
        subject: `EP Alert: System ${entry.type}`,
        sender: EMAIL_SENDER_ADDRESS.SYSTEM,
        emailRecipientMap: recipientMap,
        userIDList: Array.from(recipientMap.keys()),
        bodyList: [
            ...(await assembleLogAlertReport(entry, true)),
            htmlVerticalSpace(5),
            htmlDetailList([
                ['*', `Contact ${EMAIL_SENDER_ADDRESS.ADMIN} to unsubscribe from ${makeDisplayText(EmailSubscription.SYSTEM_IMMEDIATE)} alerts.`],
            ]),
        ],
        getAlternativeTextBody:() =>
            [
                ...textBody,
                '\n\n',
                `* Contact ${EMAIL_SENDER_ADDRESS.ADMIN} to unsubscribe from ${makeDisplayText(EmailSubscription.SYSTEM_IMMEDIATE)} alerts.`,
            ].join('\n')
    });
}



const assembleUserReportHTML = async():Promise<EmailReportContent> => {
    const subscriptionList:WebsiteSubscription[] = await DB_SELECT_EMAIL_SUBSCRIPTION_RECENT(90);
    const partnershipStats:DatabasePartnershipStats = await DB_CALCULATE_PARTNERSHIP_STATS();

    const formatPercent = (value:number, total:number):string => `${Math.round(total > 0 ? (value / total) * 100 : 0)}%`;

    return {subject: 'EP User Status Report', isHTML:true,
        body: await applyTemplate({type: EMAIL_TEMPLATE_TYPE.TABLE_ROWS,
            replacementMap: new Map([[EMAIL_REPLACEMENT.EMAIL_SUBJECT, 'EP User Status Report']]),
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
                htmlDetailList([
                    ['Users in Partnerships:', `${formatPercent(partnershipStats.usersInPartnerships, partnershipStats.totalUsers)} (${partnershipStats.usersInPartnerships})`],
                    ['Unmatched Users:', `${formatPercent(partnershipStats.unassignedPartners, partnershipStats.totalUsers)} (${partnershipStats.unassignedPartners})`],
                    ['Pending Partnerships:', `${formatPercent(partnershipStats.pendingPartnerships, partnershipStats.partnerships + partnershipStats.pendingPartnerships)} (${partnershipStats.pendingPartnerships})`],
                    ['Partnerships Accepted last week:', `${partnershipStats.acceptedLastWeek}`],
                    ['Average Time Waiting to be Matched:', `${Number(partnershipStats.newUserAverageWaitTimeHours).toFixed(1)} Hours`],
                ]),

                htmlActionButton([{label:'Portal Management', link:`${process.env.ENVIRONMENT_BASE_URL}/portal/dashboard`, style:'PRIMARY'}]),

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
        })};
}


export const assemblePartnerReportHTML = async():Promise<EmailReportContent> => {
    const unassignedProfileList:NewPartnerListItem[] = await DB_SELECT_UNASSIGNED_PARTNER_USER_LIST(30);
    const pendingPartnershipList:[NewPartnerListItem, NewPartnerListItem][] = await DB_SELECT_PENDING_PARTNER_PAIR_LIST(15);

    const partnershipStats:DatabasePartnershipStats = await DB_CALCULATE_PARTNERSHIP_STATS();

    const formatPercent = (value:number, total:number):string => `${Math.round(total > 0 ? (value / total) * 100 : 0)}%`;

    return {
        subject: 'EP Partnership Status Report',
        isHTML: true,
        body: await applyTemplate({
            type: EMAIL_TEMPLATE_TYPE.TABLE_ROWS,
            replacementMap: new Map([
                [EMAIL_REPLACEMENT.EMAIL_SUBJECT, 'EP Partnership Status Report'],
            ]),
            bodyList: [
                htmlHeader(),
                htmlSection('Partnership Status Report', 'left', EMAIL_COLOR.ACCENT),
                htmlVerticalSpace(30),

                htmlTitle('Summary'),
                htmlDetailList([
                    ['Total Active Partnerships:', `${partnershipStats.partnerships}`],
                    ['Users in Partnerships:', `${formatPercent(partnershipStats.usersInPartnerships, partnershipStats.totalUsers)} (${partnershipStats.usersInPartnerships})`],
                    ['Pending Partnerships:', `${formatPercent(partnershipStats.pendingPartnerships, partnershipStats.partnerships + partnershipStats.pendingPartnerships)} (${partnershipStats.pendingPartnerships})`],
                    ['Partnerships Accepted last week:', `${partnershipStats.acceptedLastWeek}`],
                    ['Partnerships Accepted last month:', `${partnershipStats.acceptedLastMonth}`],
                ]),

                htmlDetailList([
                    ['Unmatched Users:', `${formatPercent(partnershipStats.unassignedPartners, partnershipStats.totalUsers)} (${partnershipStats.unassignedPartners})`],
                    ['New User Average Time Waiting to be Matched:', `${Number(partnershipStats.newUserAverageWaitTimeHours).toFixed(1)} Hours`],
                    ['Waited More than 24 Hours:', `${partnershipStats.wait24Hours}`],
                    ['Waited More than 7 Days:', `${partnershipStats.wait7Days}`],
                ]),

                htmlTitle('Matching Criteria'),
                htmlDetailList([
                    ['Gender Match Required:', partnershipStats.matchGender ? 'Yes' : 'No'],
                    ['Allowed Age Range:', `±${partnershipStats.ageYearRange} years`],
                    ['Allowed Walk Level Range:', `±${partnershipStats.walkLevelRange}`],
                ]),

                htmlTitle('Partnership Activity'),
                await renderDatabaseTableUsage([DATABASE_TABLE.PARTNER], true),

                htmlSection('Unmatched Users'),
                htmlNewPartnerProfileTable(unassignedProfileList, true),

                htmlSection('Pending Partnerships'),
                htmlPartnershipBlock(
                    pendingPartnershipList.map((partnerPair) => ({ profile: partnerPair[0], partner: partnerPair[1] })), undefined, true ),

                htmlActionButton([{label:'Partnership Management', link:`${process.env.ENVIRONMENT_BASE_URL}/portal/partnership/pending`, style:'PRIMARY'}]),

                htmlDetailList([
                    ['Information Generated (CST):', formatDate(new Date(), true)],
                    ['Environment:', makeDisplayText(getEnvironment())],
                ], 'Environment Details:'),

                htmlFooter(),
            ],
            verticalSpacing: 5,
        }),
    };
}

