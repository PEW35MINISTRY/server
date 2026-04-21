import { makeDisplayText } from '../../../0-assets/field-sync/input-config-sync/inputField.mjs';
import { EmailSubscription, getDateYearsAgo } from '../../../0-assets/field-sync/input-config-sync/profile-field-config.mjs';
import USER from '../../1-models/userModel.mjs'
import { getEnvironment } from '../../10-utilities/env-utilities.mjs';
import { getModelSourceEnvironment, getEnv } from '../../10-utilities/utilities.mjs';
import { DB_SELECT_USER_EMAIL_SUBSCRIPTION_RECIPIENT_MAP } from '../../2-database/queries/user-security-queries.mjs';
import { htmlHeader, htmlSection, htmlTitle, htmlFooter, htmlText, htmlDetailList, htmlNumberedList, htmlBulletList } from '../components/email-template-components.mjs';
import { htmlUserContextProfile } from '../components/email-template-items.mjs';
import { EMAIL_SENDER_ADDRESS } from '../email-types.mjs';
import { formatDate } from '../email-utilities.mjs';
import { sendBrandedEmail } from '../email.mjs';


/* Generic User Flagging & Reporting Broadcast to Internal Safety Team */
export const sendModerationEmail = async({ reportingSubject, description, reportingUser, flaggedHTMLList, relatedHTMLList = [], alternativeTextBody }
                                        :{ reportingSubject:string, description:string, reportingUser:USER, flaggedHTMLList:string[], relatedHTMLList?:string[], alternativeTextBody?:string }):Promise<boolean> => {

    const recipientMap:Map<number, string> = await DB_SELECT_USER_EMAIL_SUBSCRIPTION_RECIPIENT_MAP(EmailSubscription.SAFETY_TEAM);

    //Under 18, must include EMAIL_YOUTH_SAFETY for communication record
    const minorInvolved:boolean = !!reportingUser.dateOfBirth && (reportingUser.dateOfBirth.getTime() < getDateYearsAgo(18).getTime());
    if(minorInvolved) 
        recipientMap.set(-2, getEnv('EMAIL_YOUTH_PROTECTION'));
    
    return await sendBrandedEmail({
        subject: `EP Flagged ${makeDisplayText(reportingSubject)} - Action Required`,
        sender: EMAIL_SENDER_ADDRESS.SYSTEM,
        userIDList: Array.from(recipientMap.keys()),
        emailRecipientMap: recipientMap,
        bodyList: [
            htmlHeader('Safety Team'),
            htmlText(
                `The following ${makeDisplayText(reportingSubject)} has been flagged and requires investigation.  `
                + 'Please review the details below carefully in accordance with the Encouraging Prayer Policies and Terms of Use.  '
                + 'This case requires manual action in the Admin Portal. The system will take no further automated action, and the status will remain pending until resolved.'
            ),
            ...(minorInvolved ? [
                htmlText(`A user involved in this report is under 18.  Youth Protection (${getEnv('EMAIL_YOUTH_PROTECTION')}) has been included and must be included in all further communication related to this situation.`)
            ] : []),

            htmlNumberedList([
                `Log in to the Admin Portal and review the reported ${makeDisplayText(reportingSubject)}.`,
                `'Reply All', to discuss the incident with the other ${recipientMap.size - 1} recipients of this email.`,
                `If the report is a false flag, reinstate the ${makeDisplayText(reportingSubject)} within the Admin Portal.`,
                `If the report is valid, delete the ${makeDisplayText(reportingSubject)} within the Admin Portal.`,
                'Complete communication with all parties involved.'
            ]),

            htmlSection(`Flagged ${makeDisplayText(reportingSubject)}`),
            htmlText(description),
            ...flaggedHTMLList.map((html):string => html),

            ...(relatedHTMLList.length === 0 ? [] : [
                htmlTitle('Related Records'),
                ...relatedHTMLList.map((html):string => html),
            ]),

            htmlTitle('Reporting User'),
            htmlUserContextProfile(reportingUser),

            htmlBulletList([
                'Terms of Use: https://ep-cdn-data-prod.s3.us-east-2.amazonaws.com/EP_Terms_Of_Use.pdf',
                `Privacy Policy: ${getEnv('ENVIRONMENT_BASE_URL')}/privacy-policy`,
                `Child Safety Policy: ${getEnv('ENVIRONMENT_BASE_URL')}/child-safety-policy`, 
                'Youth Protection: https://ep-cdn-data-prod.s3.us-east-2.amazonaws.com/EP_Youth_Protection_Policy.pdf',
            ], 'Additional Policy Links'),

            htmlDetailList([
                ['Information Generated (CST):', formatDate(new Date(), true)],
                ['Environment:', makeDisplayText(getEnvironment())],
                ['User Source Environment:', makeDisplayText(getModelSourceEnvironment())],
            ], 'Environment Details:'),
            htmlFooter()
        ],
        getAlternativeTextBody:():string => alternativeTextBody ?? `Moderation Report :: ${makeDisplayText(reportingSubject)}\n\n${description}`
    });
}
