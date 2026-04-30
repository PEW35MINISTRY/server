import { SESClient, SendEmailCommand, SendRawEmailCommand } from '@aws-sdk/client-ses';
import fs from 'fs';
import * as log from '../10-utilities/logging/log.mjs';
import { getEnv } from '../10-utilities/utilities.mjs';
import { EMAIL_ADDRESS_REGEX_SIMPLE, EMAIL_SENDER_ADDRESS, EmailAttachment, EmailSenderAddress } from './email-types.mjs';
import { LogType } from '../../0-assets/field-sync/api-type-sync/utility-types.mjs';
import { getLogFilePath } from '../10-utilities/logging/log-types.mjs';



/*****************************************************************
 * Core email transport functionality for sending AWS SES Emails *
 * Intended to be used by handlers in email.mts                  * 
 *****************************************************************/
 
const client:SESClient = new SESClient({
    region: process.env.EMAIL_SES_REGION,
    //credentials: //Established with SSO login
});


/********************************************************
* HTML TEMPLATE EMAILS | (Does not support attachments) *
*********************************************************/
export const sendTemplateEmail = async(subject:string, htmlBody:string, senderAddress:EmailSenderAddress, recipientMap:Map<number, string>):Promise<boolean> => {
    try {
        /* Validate Recipients */
        const recipientAddresses: string[] = [...recipientMap.entries()]
            .filter(([userID, email]) => {
                if(!EMAIL_ADDRESS_REGEX_SIMPLE.test(email)) {
                    log.warn('Rejected HTML Email Address for userID:', userID, email, subject);
                    return false;
                } else return true;
            }).map(([userID, email]) => email);

        if((recipientAddresses.length === 0) || !EMAIL_ADDRESS_REGEX_SIMPLE.test(senderAddress)) {
            log.error('Blocked HTML Email - No valid recipients', recipientMap, 'from sender: ', senderAddress, subject);
            return false;
        }

        if(!getEnv('SEND_EMAILS', 'boolean', false)) {
            console.log('Email Sending Disabled - ', subject, ' to: ', ...recipientMap.entries());
            return true;
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
        const succeeded:boolean = (result.$metadata.httpStatusCode === 200);
        log.email(succeeded ? 'Successfully sent HTML email' : 'Failed to send HTML email', subject, 'to recipients: ', recipientAddresses, 'from original recipient map: ', recipientMap, 'from sender: ', senderAddress);
        return succeeded;
    } catch (error) {
        log.error('Failed to send HTML email: ', subject, 'with error: ', error, 'to recipients: ', recipientMap, 'from sender: ', senderAddress); 
        log.email('Error Failed to send HTML email', subject, 'to recipients: ', recipientMap, 'from sender: ', senderAddress, 'with error: ', error);
        return false;
    }
}


/****************************************************
* TEXT EMAILS | (Simple Plain Text w/o attachments) *
*****************************************************/
export const sendTextEmail = async(subject:string, text:string, senderAddress:EmailSenderAddress, recipientMap:Map<number, string>):Promise<boolean> => {
    try {
        const recipientAddresses:string[] = [...recipientMap.entries()]
            .filter(([userID, email]) => {
                if (!EMAIL_ADDRESS_REGEX_SIMPLE.test(email)) {
                    log.warn('Rejected TEXT Email Address for userID:', userID, email, subject);
                    return false;
                } else return true;
            }).map(([userID, email]) => email);

        if((recipientAddresses.length === 0) || !EMAIL_ADDRESS_REGEX_SIMPLE.test(senderAddress)) {
            log.error('Blocked TEXT Email - No valid recipients', recipientMap, 'from sender: ', senderAddress, subject);
            return false;
        }

        if(process.env.SEND_EMAILS !== 'true') {
            console.log('Email Sending Disabled - ', subject, ' to: ', ...recipientMap.entries());
            return true;
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

        const result = await client.send(command);
        const succeeded:boolean = (result.$metadata.httpStatusCode === 200);
        log.email(succeeded ? 'Successfully sent TEXT email' : 'Failed to send TEXT email', subject, 'to recipients: ', recipientAddresses, 'from original recipient map: ', recipientMap, 'from sender: ', senderAddress);
        return succeeded;
    } catch (error) {
        log.error('Failed to send TEXT email: ', subject, 'with error: ', error, 'to recipients: ', recipientMap, 'from sender: ', senderAddress, 'with text body: ', text); 
        log.email('Error Failed to send TEXT email', subject, 'to recipients: ', recipientMap, 'from sender: ', senderAddress, 'with error: ', error);
        return false;
    }
};



/**************************************************************
 * LOG PLAIN TEXT EMAILS | (Plain Texts with log attachments) *
 **************************************************************/
export const sendLogTextEmail = async(subject:string, text:string, recipientMap:Map<number, string>):Promise<boolean> => {
    try {
        if(subject.length === 0 || text.length === 0)
            return false;

        const recipientAddresses:string[] = [...recipientMap.entries()]
                .filter(([userID, email]) => {
                    if (!EMAIL_ADDRESS_REGEX_SIMPLE.test(email)) {
                        log.warn('Rejected TEXT Email Address for userID:', userID, email, subject);
                        return false;
                    } else return true;
                }).map(([userID, email]) => email);

        if((recipientAddresses.length === 0) || !EMAIL_ADDRESS_REGEX_SIMPLE.test(EMAIL_SENDER_ADDRESS.SYSTEM)) {
            log.error('Blocked TEXT Email - No valid recipients', recipientMap, 'from sender: ', EMAIL_SENDER_ADDRESS.SYSTEM, subject);
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

        if(process.env.SEND_EMAILS !== 'true' && process.env.SEND_LOG_EMAILS !== 'true') {
            console.log('Email Log Sending Disabled - ', subject, ' to: ', ...recipientMap.entries());
            return true;
        }

        const command = new SendRawEmailCommand({
            RawMessage: {
                Data: Buffer.from(rawMessage)
            },
            Source: EMAIL_SENDER_ADDRESS.SYSTEM,
            Destinations: recipientAddresses
        });

        const result = await client.send(command);
        const succeeded:boolean = (result.$metadata.httpStatusCode === 200);
        log.email(succeeded ? 'Successfully sent LOG ATTACHMENT email' : 'Failed to send LOG ATTACHMENT email', subject, 'to recipients: ', recipientAddresses, 'from original recipient map: ', recipientMap, 'from sender: ', EMAIL_SENDER_ADDRESS.SYSTEM);
        return succeeded;
    } catch (error) {
        log.error('Failed to send LOG ATTACHMENT email: ', subject, 'with error: ', error, 'to recipients: ', recipientMap, 'from sender: ', EMAIL_SENDER_ADDRESS.SYSTEM, 'with text body: ', text); 
        log.email('Error Failed to send LOG ATTACHMENT email', subject, 'to recipients: ', recipientMap, 'from sender: ', EMAIL_SENDER_ADDRESS.SYSTEM, 'with error: ', error);
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
