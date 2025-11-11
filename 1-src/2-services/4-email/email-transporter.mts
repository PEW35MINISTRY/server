import { SESClient, SendEmailCommand, SendRawEmailCommand } from '@aws-sdk/client-ses';
import nodemailer from 'nodemailer';
import fs, { readFileSync } from 'fs';
import * as log from '../10-utilities/logging/log.mjs';
import { EMAIL_SENDER_ADDRESS, EmailAttachment } from './email-types.mjs';
import { LogType } from '../../0-assets/field-sync/api-type-sync/utility-types.mjs';
import { getLogFilePath } from '../10-utilities/logging/log-types.mjs';



/*****************************************************************
 * Core email transport functionality for sending AWS SES Emails *
 * Intended to be used by handlers in email.mts                  * 
 *****************************************************************/
 
//TODO ENVIRONMENT VARIABLE

const client: SESClient = new SESClient({
    region: 'us-east-1',
    //credentials: //Established with SSO login
});

const transporter = nodemailer.createTransport({
    SES: { ses: client, aws: { SendEmailCommand } }
});


//Stronger validation in input configs
const EMAIL_ADDRESS_REGEX_SIMPLE: RegExp = new RegExp(/^[^\s@]+@[^\s@]+\.(com|net|org|io|edu|tech)$/i);


/********************************************************
* HTML TEMPLATE EMAILS | (Does not support attachments) *
*********************************************************/
export const sendTemplateEmail = async(subject:string, htmlBody:string, senderAddress:EMAIL_SENDER_ADDRESS, recipientMap:Map<number, string>):Promise<boolean> => {
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

        const command = new SendEmailCommand({
            Source: senderAddress,
            Destination: {
                ToAddresses: recipientAddresses
            },
            Message: {
                Subject: {
                    Data: subject,
                    Charset: 'UTF-8'
                },
                Body: {
                    Html: {
                        Data: htmlBody,
                        Charset: 'UTF-8'
                    }
                }
            },
            ReplyToAddresses: [ (senderAddress === EMAIL_SENDER_ADDRESS.ADMIN) ? EMAIL_SENDER_ADDRESS.ADMIN : EMAIL_SENDER_ADDRESS.SUPPORT ]
        });

        const result = await client.send(command);
        return result.$metadata.httpStatusCode === 200;
    } catch (error) {
        log.error('Failed to send HTML email: ', subject, 'with error: ', error, 'to recipients: ', JSON.stringify(recipientMap), 'with body: ', htmlBody);
        return false;
    }
}


/****************************************************
* TEXT EMAILS | (Simple Plain Text w/o attachments) *
*****************************************************/
export const sendTextEmail = async(subject:string, text:string, senderAddress:EMAIL_SENDER_ADDRESS, recipientMap:Map<number, string>):Promise<boolean> => {
    try {
        const recipientAddresses:string[] = [...recipientMap.entries()]
            .filter(([userID, email]) => {
                if (!EMAIL_ADDRESS_REGEX_SIMPLE.test(email)) {
                    log.warn('Rejected TEXT Email Address for userID:', userID, email, subject);
                    return false;
                } else return true;
            }).map(([userID, email]) => email);

        if(recipientAddresses.length === 0) {
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
                (senderAddress === EMAIL_SENDER_ADDRESS.ADMIN) ? EMAIL_SENDER_ADDRESS.ADMIN : EMAIL_SENDER_ADDRESS.SUPPORT
            ],
        });

        await client.send(command);
        return true;
    } catch (error) {
        log.error('Failed to send TEXT email: ', subject, 'with error: ', error, 'to recipients: ', JSON.stringify(recipientMap), 'with text body: ', text); return false;
    }
};



/**************************************************************
 * LOG PLAIN TEXT EMAILS | (Plain Texts with log attachments) *
 **************************************************************/
export const sendLogTextEmail = async(subject:string, text:string, recipientMap:Map<number, string>):Promise<boolean> => {
    try {
        const recipientAddresses:string[] = [...recipientMap.entries()]
                .filter(([userID, email]) => {
                    if (!EMAIL_ADDRESS_REGEX_SIMPLE.test(email)) {
                        log.warn('Rejected TEXT Email Address for userID:', userID, email, subject);
                        return false;
                    } else return true;
                }).map(([userID, email]) => email);

        if(recipientAddresses.length === 0) {
            console.error('Blocked TEXT Email - No valid recipients', JSON.stringify(recipientMap), subject);
            return false;
        }

        const boundary = `----=_Part_${Date.now()}`;

        //Email body part (plain text)
        const bodyPart:string = [
            `--${boundary}`,
            'Content-Type: text/plain; charset="UTF-8"',
            'Content-Transfer-Encoding: 7bit',
            '',
            text
        ].join('\r\n');

        const localLogAttachments:EmailAttachment[] = [
            getLogFileAttachment(LogType.ERROR),
            getLogFileAttachment(LogType.WARN),
            getLogFileAttachment(LogType.DB),

            { //Attach Email Contents as an Attachment
                filename: `${subject}_${Date.now() % 3600000}.txt`,
                content: Buffer.from(text, 'utf8'),
                mimeType: 'text/plain'
            }
        ];

        const attachmentParts:string = localLogAttachments.map(file => [
            `--${boundary}`,
            `Content-Type: ${file.mimeType}; name="${file.filename}"`,
            `Content-Disposition: attachment; filename="${file.filename}"`,
            'Content-Transfer-Encoding: base64',
            '',
            file.content.toString('base64')
        ].join('\r\n')).join('\r\n');

        const rawMessage = [
            `From: ${EMAIL_SENDER_ADDRESS.SYSTEM}`,
            `To: ${recipientAddresses.join(', ')}`,
            `Subject: ${subject}`,
            'MIME-Version: 1.0',
            `Content-Type: multipart/mixed; boundary="${boundary}"`,
            '',
            bodyPart,
            attachmentParts,
            `--${boundary}--`
        ].join('\r\n');

        const command = new SendRawEmailCommand({
            RawMessage: {
                Data: Buffer.from(rawMessage)
            },
            Source: EMAIL_SENDER_ADDRESS.SYSTEM,
            Destinations: recipientAddresses
        });

        await client.send(command);
        return true;
    } catch (error) {
        log.error('Failed to send LOG attachment email: ', subject, 'with error: ', error, 'to recipients: ', JSON.stringify(recipientMap), 'with body: ', text);
        return false;
    }
}


/******************
* Local Utilities *
******************/
const getLogFileAttachment = (type:LogType, date:Date = new Date()):EmailAttachment|undefined => {
    
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
