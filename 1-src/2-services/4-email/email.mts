import { readFileSync, existsSync } from 'fs';
import * as log from '../10-utilities/logging/log.mjs';
import LOG_ENTRY from '../10-utilities/logging/logEntryModel.mjs';
import { AWSMetadata, EMAIL_SENDER_ADDRESS, EmailReportContent, EmailSenderAddress  } from './email-types.mjs';
import { sendLogTextEmail, sendTemplateEmail, sendTextEmail } from './email-transporter.mjs';
import { applyTemplate, EMAIL_REPLACEMENT, EMAIL_TEMPLATE_TYPE } from './email-template-manager.mjs';
import { htmlHeader, htmlText, htmlAccessCode, htmlActionButton, htmlFooter, htmlVerticalSpace, htmlDetailList } from './components/email-template-components.mjs';
import { DB_SELECT_USER, DB_SELECT_USER_BATCH_EMAIL_MAP } from '../2-database/queries/user-queries.mjs';
import { ENVIRONMENT_TYPE, makeDisplayText } from '../../0-assets/field-sync/input-config-sync/inputField.mjs';
import { DB_SELECT_USER_EMAIL_SUBSCRIPTION_RECIPIENT_MAP } from '../2-database/queries/user-security-queries.mjs';
import { assembleDailyLogReport as assembleDailyLogReportText, assembleDeploymentSystemReport, assembleLogAlertReport, assembleWeeklySystemReport as assembleWeeklySystemReportText } from './configurations/email-reports-logs.mjs';
import { assembleUserReportHTML, assemblePartnerReportHTML } from './configurations/email-reports-user.mjs';
import { EmailSubscription } from '../../0-assets/field-sync/input-config-sync/profile-field-config.mjs';
import { LogType } from '../../0-assets/field-sync/api-type-sync/utility-types.mjs';
import { getEmailSignature } from './email-utilities.mjs';
import { getEnvironment, getAWSMetadata, getEnv } from '../10-utilities/utilities.mjs';
import { SERVER_START_TIMESTAMP, SERVER_START_TIMESTAMP_PATH } from '../../server.mjs';
import { PRINT_LOGS_TO_CONSOLE } from '../10-utilities/logging/log-types.mjs';



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
export const sendBrandedEmail = async({subject, sender = EMAIL_SENDER_ADDRESS.SYSTEM, userIDList, emailRecipientMap, bodyList, getAlternativeTextBody}
                              :{subject:string, sender:EmailSenderAddress, userIDList:number[], emailRecipientMap?:Map<number, string>, bodyList:string[], getAlternativeTextBody?:(name?:string) => string}):Promise<boolean> => {
    //At least one real userID is required | (Filters negatives used for injected additional recipients)
    userIDList = userIDList.filter(id => id > 0);
    if(userIDList.length === 0) {
        log.error(`sendBrandedEmail :: subject="${subject}" :: Real userIDs required to send Branded Email, email canceled.`);
        return false;
    }

    const recipientMap:Map<number, string> = emailRecipientMap ?? await DB_SELECT_USER_BATCH_EMAIL_MAP(userIDList); //Validated in sendTemplateEmail

    const unverifiedEmailUserIDList:number[] = userIDList.filter(id => !recipientMap.has(id));
    if(unverifiedEmailUserIDList.length > 0) log.warn(`sendBrandedEmail :: subject="${subject}" :: Recipients skipped for unverified email addresses=${JSON.stringify(unverifiedEmailUserIDList)}`);
    if(recipientMap.size === 0) return false;

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
export const getEmailReportContent = async(subscription:EmailSubscription):Promise<EmailReportContent> => {
    switch(subscription) {
        case EmailSubscription.SYSTEM_DEPLOYMENT:
            return await assembleDeploymentSystemReport();

        case EmailSubscription.SYSTEM_DAILY:
            return await assembleDailyLogReportText(LogType.ERROR);

        case EmailSubscription.SYSTEM_WEEKLY:
            return await assembleWeeklySystemReportText();

        case EmailSubscription.USER_WEEKLY:
            return await assembleUserReportHTML();

        case EmailSubscription.PARTNER_WEEKLY:
            return await assemblePartnerReportHTML();

        default:
            log.error(`getEmailReportContent :: Email Report of unsupported subscription type requested: ${subscription}`);
            return { subject: '', body:'', isHTML: false };
    }
}


export const sendEmailReport = async(subscription:EmailSubscription, emailRecipientMap?:Map<number, string>, sendIndividually:boolean = false):Promise<boolean> => {
    const recipientMap:Map<number, string> = emailRecipientMap ?? await DB_SELECT_USER_EMAIL_SUBSCRIPTION_RECIPIENT_MAP(subscription);
    if(recipientMap.size === 0)
        return false;

    const { subject, body, isHTML }:EmailReportContent = await getEmailReportContent(subscription);
    if(subject.length === 0 || body.length === 0)
        return false;

    if(sendIndividually) { //Append unsubscribe link
        return (await Promise.all(
            Array.from(recipientMap.entries()).map(async([receiverID, emailAddress]) =>
                isHTML
                    ? await sendTemplateEmail(subject,
                        body +
                            htmlVerticalSpace(5) +
                            htmlActionButton([
                                { label:'Unsubscribe', link:`${getEnv('ENVIRONMENT_BASE_URL')}/api/report-unsubscribe/client/${receiverID}/subscription/${subscription}`, style:'OUTLINE' },
                            ]),
                        EMAIL_SENDER_ADDRESS.ADMIN, new Map([[receiverID, emailAddress]])
                    )
                    : await sendLogTextEmail(subject, body + `\n\nUnsubscribe: ${getEnv('ENVIRONMENT_BASE_URL')}/api/report-unsubscribe/client/${receiverID}/subscription/${subscription}`, new Map([[receiverID, emailAddress]]))
            )
        )).every(Boolean);

    } else {
        return isHTML
            ? await sendTemplateEmail(subject,
                body +
                    htmlVerticalSpace(5) +
                    htmlDetailList([
                        ['*', `Contact <a href="mailto:${EMAIL_SENDER_ADDRESS.ADMIN}">${EMAIL_SENDER_ADDRESS.ADMIN}</a> to unsubscribe from ${makeDisplayText(subscription)}.`],
                    ]),
                EMAIL_SENDER_ADDRESS.ADMIN, recipientMap )
            : await sendLogTextEmail(subject, body + `\n\n* Contact ${EMAIL_SENDER_ADDRESS.ADMIN} to unsubscribe from ${makeDisplayText(subscription)}.`, recipientMap);
    }
}


/*************************
 * CUSTOM EMAIL HANDLERS *
 *************************/
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
                ['*', `Contact <a href="mailto:${EMAIL_SENDER_ADDRESS.ADMIN}">${EMAIL_SENDER_ADDRESS.ADMIN}</a> to unsubscribe from ${EmailSubscription.SYSTEM_IMMEDIATE} alerts.`],
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


/* Triggers on System Restart */
export const sendEmailSystemDeploymentReport = async():Promise<void> => {
    try {
        if(getEnvironment() === ENVIRONMENT_TYPE.LOCAL) 
            return;

        const awsMetadata:AWSMetadata|undefined = await getAWSMetadata();
        if(awsMetadata === undefined) //Indicates not on EC2 environment
             return;

        //Prevent Infinite Loop
        if(existsSync(SERVER_START_TIMESTAMP_PATH)) {
            const previousServerStartTimestamp:Date = new Date(readFileSync(SERVER_START_TIMESTAMP_PATH, 'utf8').trim());

            if(!isNaN(previousServerStartTimestamp.getTime()) && ((SERVER_START_TIMESTAMP.getTime() - previousServerStartTimestamp.getTime()) / (1000 * 60)) < 1) {
                return;
            }
        }

        if(PRINT_LOGS_TO_CONSOLE)
            console.log((await assembleDeploymentSystemReport()).body);
        else
            await sendEmailReport(EmailSubscription.SYSTEM_DEPLOYMENT, undefined, true);
        
    } catch(error) {
        log.warn('WARNING - Failed to handle system start deployment report', error);
    }
};
