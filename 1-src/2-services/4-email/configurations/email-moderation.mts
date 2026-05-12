import { ModeratedCircleListItem } from '../../../0-assets/field-sync/api-type-sync/circle-types.mjs';
import { ModeratedContentListItem } from '../../../0-assets/field-sync/api-type-sync/content-types.mjs';
import { ModeratedPrayerRequestListItem, ModeratedPrayerRequestCommentListItem } from '../../../0-assets/field-sync/api-type-sync/prayer-request-types.mjs';
import { ModeratedProfileListItem } from '../../../0-assets/field-sync/api-type-sync/profile-types.mjs';
import { ENVIRONMENT_TYPE, makeDisplayText } from '../../../0-assets/field-sync/input-config-sync/inputField.mjs';
import { EmailSubscription } from '../../../0-assets/field-sync/input-config-sync/profile-field-config.mjs';
import USER from '../../1-models/userModel.mjs'
import { getEnvironment, isEnvironment } from '../../10-utilities/env-utilities.mjs';
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
    if(minorInvolved && getEnv('EMAIL_YOUTH_PROTECTION', 'string', false) && isEnvironment(ENVIRONMENT_TYPE.PRODUCTION)) 
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
    if(minorInvolved(user) && getEnv('EMAIL_YOUTH_PROTECTION', 'string', false) && isEnvironment(ENVIRONMENT_TYPE.PRODUCTION)) 
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
    if(minorInvolved(user) && getEnv('EMAIL_YOUTH_PROTECTION', 'string', false) && isEnvironment(ENVIRONMENT_TYPE.PRODUCTION)) 
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
export const sendModerationReminderEmail = async():Promise<boolean> => {
    const recipientMap:Map<number, string> = await DB_SELECT_USER_EMAIL_SUBSCRIPTION_RECIPIENT_MAP(EmailSubscription.SAFETY_TEAM);

    if(getEnv('EMAIL_YOUTH_PROTECTION', 'string', false) && isEnvironment(ENVIRONMENT_TYPE.PRODUCTION))
        recipientMap.set(-2, getEnv('EMAIL_YOUTH_PROTECTION'));

    if(recipientMap.size === 0) return false;

    const activeModeration:{total:number, htmlList:string[], text:string} = await htmlActiveModerationList('SECTION');
    if(activeModeration.total === 0) return false;

    return await sendBrandedEmail({
        subject: `EP Moderation Reminder - ${activeModeration.total} Pending`,
        sender: EMAIL_SENDER_ADDRESS.SYSTEM,
        userIDList: Array.from(recipientMap.keys()),
        emailRecipientMap: recipientMap,
        bodyList: [
            htmlText('Safety Team,'),

            htmlText(
                `There are currently ${activeModeration.total} records still under moderation review. `
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

            ...activeModeration.htmlList,

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
        ],

        getAlternativeTextBody:():string => (
            'Moderation Review Reminder\n\n'
            + `Information Generated (CST): ${formatDate(new Date(), true)}\n\n`
            + `Records under moderation review: ${activeModeration.total}\n`
            +  activeModeration.text
            + '\n\n'
            + 'Please investigate and resolve these records quickly. Check the Safety Team inbox for the original individual reports before making final decisions.'
        )
    });
}


/* Active Under Moderation */
export const htmlActiveModerationList = async(separator:'SECTION'|'TITLE'|'NONE' = 'SECTION'):Promise<{total:number, htmlList:string[], text:string}> => {
    const [
        moderatedUserList,
        moderatedCircleList,
        moderatedPrayerRequestList,
        moderatedPrayerRequestCommentList,
        moderatedContentList
    ] = await Promise.all([
        DB_SELECT_USER_UNDER_MODERATION(),
        DB_SELECT_CIRCLE_UNDER_MODERATION(),
        DB_SELECT_PRAYER_REQUEST_UNDER_MODERATION(),
        DB_SELECT_PRAYER_REQUEST_COMMENT_UNDER_MODERATION(),
        DB_SELECT_CONTENT_UNDER_MODERATION()
    ]);

    const total:number = moderatedUserList.length
        + moderatedCircleList.length
        + moderatedPrayerRequestList.length
        + moderatedPrayerRequestCommentList.length
        + moderatedContentList.length;

    const title = (text:string):string => (separator === 'SECTION') ? htmlSection(text) 
                                          : (separator === 'TITLE') ? htmlTitle(text) : '';

    return {
        total,

        htmlList: [
            ...(moderatedUserList.length ? [
                title(`Users Under Moderation (${moderatedUserList.length})`),
                ...moderatedUserList.flatMap((user:ModeratedProfileListItem):string[] => [
                    htmlProfileBlock(user, true, [['Moderation Status:', user.moderationStatus], ['Last Modified:', formatDate(user.modifiedDT, true)]], true),
                    htmlVerticalSpace(10)
                ])
            ] : []),

            ...(moderatedCircleList.length ? [
                title(`Circles Under Moderation (${moderatedCircleList.length})`),
                ...moderatedCircleList.flatMap((circle:ModeratedCircleListItem):string[] => [
                    htmlCircleBlock(circle, true, [['Moderation Status:', circle.moderationStatus], ['Last Modified:', formatDate(circle.modifiedDT, true)]], true),
                    htmlVerticalSpace(10)
                ])
            ] : []),

            ...(moderatedPrayerRequestList.length ? [
                title(`Prayer Requests Under Moderation (${moderatedPrayerRequestList.length})`),
                ...moderatedPrayerRequestList.flatMap((prayerRequest:ModeratedPrayerRequestListItem):string[] => [
                    htmlPrayerRequestBlock(prayerRequest, true, [['Moderation Status:', prayerRequest.moderationStatus], ['Last Modified:', formatDate(prayerRequest.modifiedDT, true)]]),
                    htmlVerticalSpace(10)
                ])
            ] : []),

            ...(moderatedPrayerRequestCommentList.length ? [
                title(`Prayer Request Comments Under Moderation (${moderatedPrayerRequestCommentList.length})`),
                ...moderatedPrayerRequestCommentList.flatMap((comment:ModeratedPrayerRequestCommentListItem):string[] => [
                    htmlPrayerRequestCommentBlock(comment, true, [['Moderation Status:', comment.moderationStatus], ['Last Modified:', formatDate(comment.modifiedDT, true)]]),
                    htmlVerticalSpace(10)
                ])
            ] : []),

            ...(moderatedContentList.length ? [
                title(`Content Under Moderation (${moderatedContentList.length})`),
                ...moderatedContentList.flatMap((content:ModeratedContentListItem):string[] => [
                    htmlContentBlock(content, true, [['Moderation Status:', content.moderationStatus], ['Last Modified:', formatDate(content.modifiedDT, true)]]),
                    htmlVerticalSpace(10)
                ])
            ] : [])
        ].filter(html =>( html !== '')),

        text: [
            `Records under moderation review: ${total}`,
            '',
            `Users Under Moderation (${moderatedUserList.length})`,
            ...moderatedUserList.map((user:ModeratedProfileListItem):string => `- #${user.userID} ${user.firstName} ${user.displayName ? `(${user.displayName})` : ''} | ${user.moderationStatus} | ${formatDate(user.modifiedDT, true)}`),

            '',
            `Circles Under Moderation (${moderatedCircleList.length})`,
            ...moderatedCircleList.map((circle:ModeratedCircleListItem):string => `- #${circle.circleID} ${circle.name} | ${circle.moderationStatus} | ${formatDate(circle.modifiedDT, true)}`),

            '',
            `Prayer Requests Under Moderation (${moderatedPrayerRequestList.length})`,
            ...moderatedPrayerRequestList.map((prayerRequest:ModeratedPrayerRequestListItem):string => `- #${prayerRequest.prayerRequestID} ${prayerRequest.topic} | ${prayerRequest.moderationStatus} | ${formatDate(prayerRequest.modifiedDT, true)}`),

            '',
            `Prayer Request Comments Under Moderation (${moderatedPrayerRequestCommentList.length})`,
            ...moderatedPrayerRequestCommentList.map((comment:ModeratedPrayerRequestCommentListItem):string => `- #${comment.commentID} Prayer Request #${comment.prayerRequestID} | ${comment.moderationStatus} | ${formatDate(comment.modifiedDT, true)}`),

            '',
            `Content Under Moderation (${moderatedContentList.length})`,
            ...moderatedContentList.map((content:ModeratedContentListItem):string => `- #${content.contentID} ${content.title ?? content.url} | ${content.moderationStatus} | ${formatDate(content.modifiedDT, true)}`)
        ].join('\n')
    };
}
