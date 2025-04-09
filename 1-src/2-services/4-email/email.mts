import { SESClient, SendEmailCommand, SendRawEmailCommand } from '@aws-sdk/client-ses';
import nodemailer from 'nodemailer';
import fs, { readFileSync } from 'fs';
import * as log from '../10-utilities/logging/log.mjs';
import LOG_ENTRY from '../10-utilities/logging/logEntryModel.mjs';
import { EMAIL_SENDER_ADDRESS, EmailAttachment } from './email-types.mjs';
import { applyTemplate, EMAIL_REPLACEMENTS, EMAIL_TEMPLATE_TYPE } from './email-template-manager.mjs';
import { DB_SELECT_USER, DB_SELECT_USER_BATCH_EMAIL_MAP } from '../2-database/queries/user-queries.mjs';
import { htmlActionButton, htmlDatabaseTableUsage, htmlFooter, htmlLogList, htmlSummaryTable, htmlUserRoleDistribution, htmlUserStats, htmlUserWalkLevelDistribution } from './email-template-components.mjs';
import USER from '../1-models/userModel.mjs';
import { getEnvironment } from '../10-utilities/utilities.mjs';
import dotenv from 'dotenv';
import { makeDisplayText } from '../../0-assets/field-sync/input-config-sync/inputField.mjs';
import { getLogFilePath } from '../10-utilities/logging/log-types.mjs';
import { LogType } from '../../0-assets/field-sync/api-type-sync/utility-types.mjs';
import { fetchS3LogsByDateRange, fetchS3LogsByDay } from '../10-utilities/logging/log-s3-utilities.mjs';
dotenv.config();


const client: SESClient = new SESClient({
    region: 'us-east-1',
    //credentials: //Established with SSO login
});

const transporter = nodemailer.createTransport({
    SES: { ses: client, aws: { SendEmailCommand } }
});

//Stronger validation in input configs
const EMAIL_ADDRESS_REGEX_SIMPLE: RegExp = new RegExp(/^[^\s@]+@[^\s@]+\.(com|net|org|io|edu)$/i);

/* Simple Plain Text w/o attachments | Higher Deliverability (Admin Fallback)*/
export const sendTextEmail = async (subject: string, text: string, senderAddress: EMAIL_SENDER_ADDRESS, recipientMap: Map<number, string>): Promise<boolean> => {
    try {

        const recipientAddresses: string[] = [...recipientMap.entries()]
            .filter(([userID, email]) => {
                if (!EMAIL_ADDRESS_REGEX_SIMPLE.test(email)) {
                    log.warn('Rejected TEXT Email Address for userID:', userID, email, subject);
                    return false;
                } else return true;
            }).map(([userID, email]) => email);

        if (recipientAddresses.length === 0) {
            console.error('Blocked TEXT Email - No valid recipients', JSON.stringify(recipientMap), subject);
            return false;
        }

        const command = new SendEmailCommand({
            Source: senderAddress,
            Destination: {
                ToAddresses: recipientAddresses,
            },
            Message: {
                Subject: { Data: subject },
                Body: {
                    Text: { Data: text },
                },
            },
            ReplyToAddresses: [
                senderAddress === EMAIL_SENDER_ADDRESS.ADMIN ? EMAIL_SENDER_ADDRESS.ADMIN : EMAIL_SENDER_ADDRESS.SUPPORT
            ],
        });

        await client.send(command);
        return true;
    } catch (error) {
        log.error('Failed to send TEXT email: ', subject, 'with error: ', error, 'to recipients: ', JSON.stringify(recipientMap), 'with text body: ', text); return false;
    }
};


/* HTML TEMPLATE EMAILS | (Must be sent as Raw to support attachments) */
const sendTemplateEmail = async(subject:string, htmlBody:string, attachments:EmailAttachment[], senderAddress:EMAIL_SENDER_ADDRESS, recipientMap:Map<number, string>):Promise<boolean> => {
    try {
        /* Validate Recipients */
        const recipientAddresses: string[] = [...recipientMap.entries()]
            .filter(([userID, email]) => {
                if(!EMAIL_ADDRESS_REGEX_SIMPLE.test(email)) {
                    log.warn('Rejected HTML Email Address for userID:', userID, email, subject);
                    return false;
                } else return true;
            }).map(([userID, email]) => email);

        if(recipientAddresses.length === 0) {
            console.error('Blocked HTML Email - No valid recipients', JSON.stringify(recipientMap), subject);
            return false;
        }

        //Build attachment MIME parts & include logo
        if(htmlBody.includes('logo.png'))
            attachments.push({
                filename: 'logo.png',
                content: await readFileSync('/attachment/logo-40.png'),
                mimeType: 'image/png'
            });

        const boundary = 'boundary_string'; //`----=_Part_${Date.now()}`;
        const attachmentParts = attachments.filter((attachment) => (attachment !== null) && (attachment !== undefined)).map((file) =>
            `--${boundary}
                Content-Type: ${file.mimeType}; name='${file.filename}'
                Content-Disposition: attachment; filename='${file.filename}'
                Content-Transfer-Encoding: base64                
                ${file.content.toString('base64')}`
        );

        //HTML Body
        // const messageBody = `--${boundary}
        //     Content-Type: text/html; charset=utf-8
        //     Content-Transfer-Encoding: 7bit            
        //     ${htmlBody}`;

        // const rawMessage = `
        //     From: "${senderAddress}"
        //     To: ${recipientAddresses.join(', ')}
        //     Subject: ${subject}
        //     Reply-To: ${senderAddress === EMAIL_SENDER_ADDRESS.ADMIN ? EMAIL_SENDER_ADDRESS.ADMIN : EMAIL_SENDER_ADDRESS.SUPPORT}
        //     `;

        const rawMessage =
            `MIME-Version: 1.0
            Content-Type: text/html;

            ${htmlBody}

            ${attachmentParts.join('')}
            
            --boundary_string--`;

        const command = new SendRawEmailCommand({
            RawMessage: {
                Data: Buffer.from(rawMessage)
            },
            Source: senderAddress,
            Destinations: recipientAddresses
        });

        const result = await client.send(command);
        return true;
    } catch (error) {
        log.error('Failed to send HTML email: ', subject, 'with error: ', error, 'to recipients: ', JSON.stringify(recipientMap), 'with attachments: ', ...attachments.map(a => a.filename), 'with body: ', htmlBody);
        return false;
    }
};


/***********************************
* EXPORTED EMAIl TEMPLATE HANDLERS *
************************************/
export const sendEmailMessage = async (subject: string, message: string, sender: EMAIL_SENDER_ADDRESS, ...usedIDList: number[]): Promise<boolean> => {
    // const recipientMap: Map<number, string> = await DB_SELECT_USER_BATCH_EMAIL_MAP(usedIDList); //Validated in sendTemplateEmail

//TODo TEMP
const recipientMap: Map<number, string> = new Map([[-1, EMAIL_SENDER_ADDRESS.ADMIN]]);

    const htmlTemplate = await applyTemplate(EMAIL_TEMPLATE_TYPE.MESSAGE, new Map([[EMAIL_REPLACEMENTS.MESSAGE, message]]));

    const successfullySent:boolean = await sendTemplateEmail(subject, htmlTemplate, [], sender, recipientMap);

    //Re-attempt | Failed logging handled in sendTemplateEmail
    if(!successfullySent && recipientMap.size === 1 && sender === EMAIL_SENDER_ADDRESS.SERVER) {
        return await sendTextEmail(subject, message, sender, recipientMap);
    }

    return successfullySent;
};

export const sendEmailAction = async (subject: string, message: string, sender: EMAIL_SENDER_ADDRESS, recipient: string | number, actionLabel: string, actionLink: string): Promise<boolean> => {
    //Recipient can be either email address or userID in which case will fetch email from database
    const recipientMap: Map<number, string> = new Map();
    if (typeof recipient === 'string')
        recipientMap.set(-1, recipient);
    else {
        const user: USER = await DB_SELECT_USER(new Map([['userID', recipient]]), false);
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

    return await sendTemplateEmail(
        subject,
        templateHtml,
        [], //No additional attachments
        sender,
        recipientMap
    );
}


export const sendEmailLogAlert = async(entry: LOG_ENTRY) => {
    const templateHtml = await applyTemplate(EMAIL_TEMPLATE_TYPE.MESSAGE,
        new Map([[EMAIL_REPLACEMENTS.RECIPIENT, 'Admins'], [EMAIL_REPLACEMENTS.MESSAGE, entry.toString()], [EMAIL_REPLACEMENTS.SENDER, `${makeDisplayText(getEnvironment())} Environment`]]),
        [
            htmlActionButton('See Latest Logs', `${process.env.ENVIRONMENT_BASE_URL}/portal/logs`),
        ]
    );

    const successfullySent: boolean = await sendTemplateEmail(
        `EP ALERT | ${getEnvironment()} Environment`, templateHtml,
        [
            getLogFileAttachment(LogType.ERROR),
            getLogFileAttachment(LogType.WARN),
            getLogFileAttachment(LogType.DB)
        ],
        EMAIL_SENDER_ADDRESS.SERVER, new Map([[-1, EMAIL_SENDER_ADDRESS.ADMIN]]));

    //Re-attempt | Failed logging handled in sendTemplateEmail
    if(!successfullySent) {
        return await sendTextEmail(`EP ALERT | ${getEnvironment()} Environment`, entry.toString(), EMAIL_SENDER_ADDRESS.SERVER, new Map([[-1, EMAIL_SENDER_ADDRESS.ADMIN]]));
    }

    return successfullySent;
};


export const sendEmailLogReport = async() => {
    const templateHtml = await applyTemplate(EMAIL_TEMPLATE_TYPE.ADMIN_REPORT,
        new Map([
            [EMAIL_REPLACEMENTS.HEADER, 'Server Status Report'],
            [EMAIL_REPLACEMENTS.DATE, `${new Date().toISOString()}`],
            [EMAIL_REPLACEMENTS.ENVIRONMENT, `${getEnvironment()}`],
        ]),
        [
            await htmlDatabaseTableUsage(['user', 'partner', 'circle', 'circle_announcement', 'circle_user', 'prayer_request', 'content', 'subscription']),

            await htmlLogList(LogType.ERROR, 50),
            await htmlLogList(LogType.WARN, 25),
            await htmlLogList(LogType.DB, 25),

            htmlActionButton('See Latest Logs', `${process.env.ENVIRONMENT_BASE_URL}/portal/logs`),
        ]
    );

    const successfullySent: boolean = await sendTemplateEmail(
        `EP Server Status | ${makeDisplayText(getEnvironment())} Environment`, templateHtml,
        [
            // getLogFileAttachment(LogType.ERROR),
            // getLogFileAttachment(LogType.WARN),
            // getLogFileAttachment(LogType.DB)
        ],
        EMAIL_SENDER_ADDRESS.SERVER, new Map([[-1, EMAIL_SENDER_ADDRESS.ADMIN]]));

    return successfullySent;
};


export const sendEmailUserReport = async() => {
    const templateHtml = await applyTemplate(EMAIL_TEMPLATE_TYPE.ADMIN_REPORT,
        new Map([
            [EMAIL_REPLACEMENTS.HEADER, 'User Status Report'],
            [EMAIL_REPLACEMENTS.DATE, `${new Date().toISOString()}`],
            [EMAIL_REPLACEMENTS.ENVIRONMENT, `${getEnvironment()}`],
        ]),
        [   
            await htmlDatabaseTableUsage(['user']),
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
        [], //No additional attachments
        EMAIL_SENDER_ADDRESS.SERVER, new Map([[-1, EMAIL_SENDER_ADDRESS.ADMIN]]));

    return successfullySent;
};


/* Local Utilities */
const getLogFileAttachment = (type: LogType, date: Date = new Date()): EmailAttachment | undefined => {

    return undefined;
    
    const year = date.getUTCFullYear();
    const month = String(date.getUTCMonth() + 1).padStart(2, '0');
    const day = String(date.getUTCDate()).padStart(2, '0');
    const hour = String(date.getUTCHours()).padStart(2, '0');

    try {
        const content: Buffer = fs.readFileSync(getLogFilePath(type));
        return {
            filename: `${type.toLowerCase()}_${year}_${month}_${day}_${hour}_${date.getTime() % 3600000}.txt`,
            content,
            mimeType: 'text/plain'
        };
    } catch (error) {
        log.error(`Failed to get log file as an attachment for ${type}`, error);
        return undefined;
    }
}
