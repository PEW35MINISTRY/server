import { makeDisplayText } from '../../../0-assets/field-sync/input-config-sync/inputField.mjs';
import { EmailSubscription } from '../../../0-assets/field-sync/input-config-sync/profile-field-config.mjs';
import { ModeratedContentListItem } from '../../../1-api/11-content/content-types.mjs';
import { ModeratedProfileListItem } from '../../../1-api/3-profile/profile-types.mjs';
import { ModeratedCircleListItem } from '../../../1-api/4-circle/circle-types.mjs';
import { ModeratedPrayerRequestListItem, ModeratedPrayerRequestCommentListItem } from '../../../1-api/5-prayer-request/prayer-request-types.mjs';
import USER from '../../1-models/userModel.mjs'
import { getEnvironment } from '../../10-utilities/env-utilities.mjs';
import { getEnv, getModelSourceEnvironment } from '../../10-utilities/utilities.mjs';
import { DB_SELECT_CIRCLE_UNDER_MODERATION } from '../../2-database/queries/circle-queries.mjs';
import { DB_SELECT_CONTENT_UNDER_MODERATION } from '../../2-database/queries/content-queries.mjs';
import { DB_SELECT_PRAYER_REQUEST_UNDER_MODERATION, DB_SELECT_PRAYER_REQUEST_COMMENT_UNDER_MODERATION } from '../../2-database/queries/prayer-request-queries.mjs';
import { DB_SELECT_USER_EMAIL_SUBSCRIPTION_RECIPIENT_MAP, DB_SELECT_USER_UNDER_MODERATION } from '../../2-database/queries/user-security-queries.mjs';
import { htmlSection, htmlTitle, htmlText, htmlDetailList, htmlNumberedList, htmlVerticalSpace, htmlBulletLinkList, htmlSummaryList, htmlFooter, htmlHeader } from '../components/email-template-components.mjs';
import { htmlCircleBlock, htmlContentBlock, htmlPrayerRequestBlock, htmlPrayerRequestCommentBlock, htmlProfileBlock, htmlUserContextProfile } from '../components/email-template-items.mjs';
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



/****************************************
 *       MODERATION UNDER REVIEW        *
 *         Safety Team Reminder         *
 ****************************************/
export const sendModerationReviewReminderEmail = async():Promise<boolean> => {
    const recipientMap:Map<number, string> = await DB_SELECT_USER_EMAIL_SUBSCRIPTION_RECIPIENT_MAP(EmailSubscription.SAFETY_TEAM);
    if(recipientMap.size === 0) return false;

    const moderatedUserList:ModeratedProfileListItem[] = await DB_SELECT_USER_UNDER_MODERATION();
    const moderatedPrayerRequestList:ModeratedPrayerRequestListItem[] = await DB_SELECT_PRAYER_REQUEST_UNDER_MODERATION();
    const moderatedPrayerRequestCommentList:ModeratedPrayerRequestCommentListItem[] = await DB_SELECT_PRAYER_REQUEST_COMMENT_UNDER_MODERATION();
    const moderatedContentList:ModeratedContentListItem[] = await DB_SELECT_CONTENT_UNDER_MODERATION();
    const moderatedCircleList:ModeratedCircleListItem[] = await DB_SELECT_CIRCLE_UNDER_MODERATION();

    const totalUnderModeration:number = moderatedUserList.length
        + moderatedPrayerRequestList.length
        + moderatedPrayerRequestCommentList.length
        + moderatedContentList.length
        + moderatedCircleList.length;

    if(totalUnderModeration === 0) return false;

    return await sendBrandedEmail({
        subject: `EP Moderation Reminder - ${totalUnderModeration} Pending`,
        sender: EMAIL_SENDER_ADDRESS.SYSTEM,
        userIDList: Array.from(recipientMap.keys()),
        emailRecipientMap: recipientMap,
        bodyList: [
            htmlHeader('Safety Team'),

            htmlText(
                `There are currently ${totalUnderModeration} records still under moderation review. `
                + 'Please review each item and update its moderation status after a decision has been made. '
                + 'If a record should be reinstated, restore access or visibility as appropriate. '
                + 'If a policy violation is confirmed, apply the appropriate consequence. '
                + 'Timely resolution helps reduce unnecessary user disruption while preserving the safety and integrity of the Encouraging Prayer community.'
            ),

            htmlSummaryList([
                ['Note:',  'At this time, we do not have a complete database record of each incident. Please check your inbox for the original individual moderation reports.']
            ]),

            htmlNumberedList([
                'Review each pending moderation item listed below.',
                'Find the original report email and review the full incident context.',
                'Determine whether the item should be reinstated, removed, escalated, or otherwise resolved.',
                'Update the applicable record in the Admin Portal so moderationStatus no longer remains pending.',
                'Complete any required communication with users involved.'
            ], 'Review Steps'),

            ...(moderatedUserList.length ? [
                htmlSection(`Users Under Moderation (${moderatedUserList.length})`),
                ...moderatedUserList.map((user:ModeratedProfileListItem):string => htmlProfileBlock(user, true, [
                    ['Moderation Status:', user.moderationStatus],
                    ['Last Modified:', formatDate(user.modifiedDT, true)]
                ], true))
            ] : []),

            ...(moderatedCircleList.length ? [
                htmlSection(`Circles Under Moderation (${moderatedCircleList.length})`),
                ...moderatedCircleList.map((circle:ModeratedCircleListItem):string => htmlCircleBlock([circle], undefined, true, [
                    ['Moderation Status:', circle.moderationStatus],
                    ['Last Modified:', formatDate(circle.modifiedDT, true)]
                ]))
            ] : []),

            ...(moderatedPrayerRequestList.length ? [
                htmlSection(`Prayer Requests Under Moderation (${moderatedPrayerRequestList.length})`),
                ...moderatedPrayerRequestList.map((prayerRequest:ModeratedPrayerRequestListItem):string => htmlPrayerRequestBlock(prayerRequest, true, [
                    ['Moderation Status:', prayerRequest.moderationStatus],
                    ['Last Modified:', formatDate(prayerRequest.modifiedDT, true)]
                ]))
            ] : []),

            ...(moderatedPrayerRequestCommentList.length ? [
                htmlSection(`Prayer Request Comments Under Moderation (${moderatedPrayerRequestCommentList.length})`),
                ...moderatedPrayerRequestCommentList.map((comment:ModeratedPrayerRequestCommentListItem):string => htmlPrayerRequestCommentBlock(comment, true, [
                    ['Moderation Status:', comment.moderationStatus],
                    ['Last Modified:', formatDate(comment.modifiedDT, true)]
                ]))
            ] : []),

            ...(moderatedContentList.length ? [
                htmlSection(`Content Under Moderation (${moderatedContentList.length})`),
                ...moderatedContentList.map((content:ModeratedContentListItem):string => htmlContentBlock(content, true, [
                    ['Moderation Status:', content.moderationStatus],
                    ['Last Modified:', formatDate(content.modifiedDT, true)]
                ]))
            ] : []),

            htmlBulletLinkList([
                {label: 'Terms of Use', link: 'https://ep-cdn-data-prod.s3.us-east-2.amazonaws.com/EP_Terms_Of_Use.pdf'},
                {label: 'Privacy Policy', link: `${getEnv('ENVIRONMENT_BASE_URL')}/privacy-policy`},
                {label: 'Child Safety Policy', link: `${getEnv('ENVIRONMENT_BASE_URL')}/child-safety-policy`},
                {label: 'Youth Protection', link: 'https://ep-cdn-data-prod.s3.us-east-2.amazonaws.com/EP_Youth_Protection_Policy.pdf'}
            ], 'Additional Policy Links'),

            htmlDetailList([
                ['Information Generated (CST):', formatDate(new Date(), true)],
                ['Environment:', makeDisplayText(getEnvironment())],
                ['User Source Environment:', makeDisplayText(getModelSourceEnvironment())]
            ], 'Environment Details:'),

            htmlFooter()
        ],
        getAlternativeTextBody:():string => (
            'Moderation Review Reminder\n\n'
            + `Information Generated (CST): ${formatDate(new Date(), true)}\n\n`
            + `Records under moderation review: ${totalUnderModeration}\n`
            + `Users: ${moderatedUserList.length}\n`
            + `Prayer Requests: ${moderatedPrayerRequestList.length}\n`
            + `Prayer Request Comments: ${moderatedPrayerRequestCommentList.length}\n`
            + `Content: ${moderatedContentList.length}\n`
            + `Circles: ${moderatedCircleList.length}\n\n`
            + 'Please investigate and resolve these records quickly. Check the Safety Team inbox for the original individual reports before making final decisions.'
        )
    });
}
