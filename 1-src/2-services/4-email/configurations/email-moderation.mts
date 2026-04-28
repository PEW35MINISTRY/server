import { makeDisplayText } from '../../../0-assets/field-sync/input-config-sync/inputField.mjs';
import { EmailSubscription } from '../../../0-assets/field-sync/input-config-sync/profile-field-config.mjs';
import USER from '../../1-models/userModel.mjs'
import { getEnvironment } from '../../10-utilities/env-utilities.mjs';
import { getEnv } from '../../10-utilities/utilities.mjs';
import { DB_SELECT_USER_EMAIL_SUBSCRIPTION_RECIPIENT_MAP } from '../../2-database/queries/user-security-queries.mjs';
import { htmlSection, htmlTitle, htmlText, htmlDetailList, htmlNumberedList, htmlVerticalSpace, htmlBulletLinkList, htmlSummaryList } from '../components/email-template-components.mjs';
import { htmlProfileBlock, htmlUserContextProfile } from '../components/email-template-items.mjs';
import { EMAIL_SENDER_ADDRESS } from '../email-types.mjs';
import { formatDate, getEmailSignature, minorInvolved } from '../email-utilities.mjs';
import { sendBrandedEmail } from '../email.mjs';


/* Generic User Flagging & Reporting Broadcast to Internal Safety Team */
export const sendModerationEmail = async({ reportingSubject, description, reportingUser, minorInvolved, flaggedHTMLList, relatedHTMLList = [], alternativeTextBody }
                                        :{ reportingSubject:string, description:string, reportingUser:USER, minorInvolved:boolean, flaggedHTMLList:string[], relatedHTMLList?:string[], alternativeTextBody?:string }):Promise<boolean> => {

    const recipientMap:Map<number, string> = await DB_SELECT_USER_EMAIL_SUBSCRIPTION_RECIPIENT_MAP(EmailSubscription.SAFETY_TEAM);

    //Under 18, must include EMAIL_YOUTH_SAFETY for communication record
    if(minorInvolved && getEnv('EMAIL_YOUTH_PROTECTION', 'string', false)) 
        recipientMap.set(-2, getEnv('EMAIL_YOUTH_PROTECTION'));
    
    return await sendBrandedEmail({
        subject: `EP Flagged ${makeDisplayText(reportingSubject)} - Action Required`,
        sender: EMAIL_SENDER_ADDRESS.SYSTEM,
        userIDList: Array.from(recipientMap.keys()),
        emailRecipientMap: recipientMap,
        bodyList: [
            htmlText('Safety Team,'),
            htmlText(`The following ${makeDisplayText(reportingSubject)} has been flagged and requires investigation.  `
                + 'Please review the details below carefully in accordance with the Encouraging Prayer Policies and Terms of Use.  '
                + 'This case requires manual action in the Admin Portal. The system will take no further automated action, and the status will remain pending until resolved.'
            ),
            ...(minorInvolved ? [
                htmlSummaryList([['IMPORTANT:', `A user involved in this report is under 18.  Youth Protection (${getEnv('EMAIL_YOUTH_PROTECTION')}) has been included and must be included in all further communication related to this situation.`]]),
            ] : []),

            htmlNumberedList([
                `Log in to the Admin Portal and review the reported ${makeDisplayText(reportingSubject)}.`,
                `'Reply All', to discuss the incident with the other ${recipientMap.size - (minorInvolved ? 2 : 1)} recipients of this email.`,
                `If the report is a false flag, reinstate the ${makeDisplayText(reportingSubject)} within the Admin Portal.`,
                `If the report is valid, delete the ${makeDisplayText(reportingSubject)} within the Admin Portal.`,
                'Complete communication with all parties involved.'
            ]),

            htmlSection(`Flagged ${makeDisplayText(reportingSubject)}`),
            htmlSummaryList([['Description:', description]]),
            htmlVerticalSpace(10),
            ...flaggedHTMLList.map((html):string => html),

            ...(relatedHTMLList.length === 0 ? [] : [
                htmlSection('Related Records'),
                ...relatedHTMLList.map((html):string => html),
            ]),
            htmlVerticalSpace(10),

            htmlTitle('Reporting User'),
            htmlUserContextProfile(reportingUser),
            htmlVerticalSpace(10),

            htmlBulletLinkList([
                { label: 'Terms of Use', link: 'https://ep-cdn-data-prod.s3.us-east-2.amazonaws.com/EP_Terms_Of_Use.pdf' },
                { label: 'Privacy Policy', link: `${getEnv('ENVIRONMENT_BASE_URL')}/privacy-policy` },
                { label: 'Child Safety Policy', link: `${getEnv('ENVIRONMENT_BASE_URL')}/child-safety-policy` },
                { label: 'Youth Protection', link: 'https://ep-cdn-data-prod.s3.us-east-2.amazonaws.com/EP_Youth_Protection_Policy.pdf' }
            ], 'Additional Policy Links'),

            htmlDetailList([
                ['Information Generated (CST):', formatDate(new Date(), true)],
                ['Environment:', makeDisplayText(getEnvironment())]
            ], 'Environment Details:')
        ],
        getAlternativeTextBody:():string => alternativeTextBody ?? `Moderation Report :: ${makeDisplayText(reportingSubject)}\n\n${description}`
    });
}



/* User-Facing Moderation Review Notice - Account Locked */
export const sendUserLockedAccountEmail = async(user:USER): Promise<boolean> => {
    const recipientMap: Map<number, string> = new Map([[user.userID, user.email]]);

    //Under 18, must include EMAIL_YOUTH_SAFETY for communication record.
    if(minorInvolved(user) && getEnv('EMAIL_YOUTH_PROTECTION', 'string', false)) 
        recipientMap.set(-2, getEnv('EMAIL_YOUTH_PROTECTION'));

    return await sendBrandedEmail({
        subject: 'Encouraging Prayer Account Under Review',
        sender: EMAIL_SENDER_ADDRESS.SYSTEM,
        userIDList: Array.from(recipientMap.keys()),
        emailRecipientMap: recipientMap,
        bodyList: [
            htmlProfileBlock(user.toListItem(), false),

            htmlText(
                'We are writing to inform you that your Encouraging Prayer account has been temporarily locked and is currently under review by our Safety Team. '
                + 'You will not be able to access the Encouraging Prayer App or related services until the review is complete. '
                + 'At this time, your account has not been permanently banned. '
                + 'Our Safety Team is reviewing a reported incident and will be in touch within the next few days. '
                + `If you have additional questions, please contact Support at ${EMAIL_SENDER_ADDRESS.SUPPORT}.`
            ),

            htmlBulletLinkList([
                { label: 'Terms of Use', link: 'https://ep-cdn-data-prod.s3.us-east-2.amazonaws.com/EP_Terms_Of_Use.pdf' },
                { label: 'Privacy Policy', link: `${getEnv('ENVIRONMENT_BASE_URL')}/privacy-policy` },
                { label: 'Child Safety Policy', link: `${getEnv('ENVIRONMENT_BASE_URL')}/child-safety-policy` },
                { label: 'Youth Protection', link: 'https://ep-cdn-data-prod.s3.us-east-2.amazonaws.com/EP_Youth_Protection_Policy.pdf' }
            ], 'Policy Links')
        ],
        getAlternativeTextBody: (): string => (
            `${user.firstName},\n\n`
            + 'We are writing to inform you that your Encouraging Prayer account has been temporarily locked and is currently under review by our Safety Team. '
            + 'You will not be able to access the Encouraging Prayer App or related services until the review is complete.\n\n'
            + 'At this time, your account has not been permanently banned. '
            + 'Our Safety Team is reviewing a reported incident and will be in touch within the next few days.\n\n'
            + `If you have additional questions, please contact Support at ${EMAIL_SENDER_ADDRESS.SUPPORT}.\n\n`
            + getEmailSignature(EMAIL_SENDER_ADDRESS.ADMIN).join('\n')
        )
    });
}


/* User-Facing Moderation Review Notice - Temporarily Removed */
export const sendUserModeratedItemRemovedEmail = async(user:USER, {subject, title, flaggedHTMLList = []}:{subject:string, title:string, flaggedHTMLList?:string[]}):Promise<boolean> => {
    const recipientMap:Map<number, string> = new Map([[user.userID, user.email]]);

    //Under 18, must include EMAIL_YOUTH_SAFETY for communication record.
    if(minorInvolved(user) && getEnv('EMAIL_YOUTH_PROTECTION', 'string', false)) 
        recipientMap.set(-2, getEnv('EMAIL_YOUTH_PROTECTION'));

    return await sendBrandedEmail({
        subject: `Encouraging Prayer ${makeDisplayText(subject)} Under Review`,
        sender: EMAIL_SENDER_ADDRESS.SYSTEM,
        userIDList: Array.from(recipientMap.keys()),
        emailRecipientMap: recipientMap,
        bodyList: [
            htmlText(
                `We are writing to inform you that your ${makeDisplayText(subject).toLowerCase()}, “${makeDisplayText(title)}”, has been temporarily removed and is currently under review by our Safety Team. `
                + 'Your account has not been locked or banned, and you may continue using the Encouraging Prayer App while this review is pending. '
                + `Our Safety Team is reviewing a reported incident involving this ${makeDisplayText(subject).toLowerCase()} and will be in touch within the next few days. `
                + `If you have additional questions, please contact Support at ${EMAIL_SENDER_ADDRESS.SUPPORT}.`
            ),

            ...flaggedHTMLList,

            htmlBulletLinkList([
                { label: 'Terms of Use', link: 'https://ep-cdn-data-prod.s3.us-east-2.amazonaws.com/EP_Terms_Of_Use.pdf' },
                { label: 'Privacy Policy', link: `${getEnv('ENVIRONMENT_BASE_URL')}/privacy-policy` },
                { label: 'Child Safety Policy', link: `${getEnv('ENVIRONMENT_BASE_URL')}/child-safety-policy` },
                { label: 'Youth Protection', link: 'https://ep-cdn-data-prod.s3.us-east-2.amazonaws.com/EP_Youth_Protection_Policy.pdf' }
            ], 'Policy Links')
        ],
        getAlternativeTextBody: (): string => (
            `${user.firstName},\n\n`
            + `We are writing to inform you that your ${makeDisplayText(subject).toLowerCase()}, "${makeDisplayText(title)}", has been temporarily removed and is currently under review by our Safety Team. `
            + 'Your account has not been locked or banned, and you may continue using the Encouraging Prayer App while this review is pending.\n\n'
            + `Our Safety Team is reviewing a reported incident involving this ${makeDisplayText(subject).toLowerCase()} and will be in touch within the next few days.\n\n`
            + `If you have additional questions, please contact Support at ${EMAIL_SENDER_ADDRESS.SUPPORT}.\n\n`
            + getEmailSignature(EMAIL_SENDER_ADDRESS.ADMIN).join('\n')
        )
    });
}
