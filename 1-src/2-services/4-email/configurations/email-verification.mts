import * as log from '../../10-utilities/logging/log.mjs';
import { generateToken } from '../../../1-api/2-auth/auth-utilities.mjs';
import { DATABASE_TOKEN_TYPE_ENUM } from '../../2-database/database-types.mjs';
import { DB_SELECT_UNVERIFIED_EMAIL_MAP } from '../../2-database/queries/user-queries.mjs';
import { DB_INSERT_TOKEN, DB_DELETE_TOKEN, DB_INSERT_TOKEN_BATCH, DB_DELETE_TOKEN_BATCH } from '../../2-database/queries/user-security-queries.mjs';
import { htmlHeader, htmlFooter, htmlText, htmlActionButton, htmlAccessCode } from '../components/email-template-components.mjs';
import { applyTemplate, EMAIL_TEMPLATE_TYPE, EMAIL_REPLACEMENT } from '../email-template-manager.mjs';
import { sendTemplateEmail } from '../email-transporter.mjs';
import { EMAIL_SENDER_ADDRESS } from '../email-types.mjs';


/****************************************
 * CUSTOM EMAIL SERVICE IMPLEMENTATIONS *
 ****************************************/


//Sends Email only, token must be saved to database
const sendVerifyEmail = async({userID, email, token, firstName}:{userID:number, email:string, token:string, firstName?:string}):Promise<boolean> => {
    const html = await applyTemplate({type: EMAIL_TEMPLATE_TYPE.SIMPLE,
        replacementMap: new Map([[EMAIL_REPLACEMENT.EMAIL_SUBJECT, 'Verify Email Address']]),
        bodyList: [
            htmlHeader(firstName ? (firstName + ',') : undefined),
            htmlText('Please verify your email address to complete your Encouraging Prayer account setup. \nClick the button below to confirm your email. \nThis request is time-limited for your security.  \n\nNote: Email verification is required before resetting your password.'),
            ...(token.length < 10 ? [htmlAccessCode(token, 'Enter in the app:')] : []),
            htmlActionButton([
                //TODO generate a User Report to possibly delete account following review
                {label:'Not Me', link:`${process.env.ENVIRONMENT_BASE_URL}/api/report-token?action=email_verify&email=${encodeURIComponent(email)}&token=${encodeURIComponent(token)}`, style:'OUTLINE'}, 
                {label:'Verify Email', link:`${process.env.ENVIRONMENT_BASE_URL}/api/email-verify?email=${encodeURIComponent(email)}&token=${encodeURIComponent(token)}`, style:'ACCENT'},
            ]),
            htmlFooter(),
        ],
        verticalSpacing: 3
    });

    return await sendTemplateEmail('Verify Email Address', html, EMAIL_SENDER_ADDRESS.SYSTEM, new Map([[userID, email]]));
}


/* Send Email Address Verification Email with embedded Token */
export const sendUserEmailVerification  = async(userID:number, email:string, firstName?:string):Promise<boolean> => {
    const token:string = generateToken(); //Simple enter during sign-up flow

    if(await DB_INSERT_TOKEN({userID, token, type:DATABASE_TOKEN_TYPE_ENUM.EMAIL_VERIFY, expirationDT: new Date(Date.now() + ((Number(process.env.EMAIL_VERIFY_TOKEN_MS) || (36 * 60 * 60 * 1000))))}) == false) { //36 hours
            log.error('sendEmailVerification CANCELED - failed to insert token for userID:', userID);
            return false;

    } else if(await sendVerifyEmail({userID, email, token, firstName}) == false) {
                log.error('sendEmailVerification CANCELED - failed to send email, deleting token for userID:', userID);
                await DB_DELETE_TOKEN(token);
                return false;
            }

    return true;
}


//Weekly CHRON JOB: Send email verification reminders to unverified users
export const sendEmailVerificationReminderBatch = async():Promise<boolean> => {

    const unverifiedUserMap:Map<number, {firstName:string, email:string}> = await DB_SELECT_UNVERIFIED_EMAIL_MAP();
    if(unverifiedUserMap.size === 0)
        return true;

    //Generate Tokens and add all to Database (Must be done first, so token is available during batch email sending)
    const expirationDT:Date = new Date(Date.now() + (Number(process.env.EMAIL_VERIFY_TOKEN_MS) || (36 * 60 * 60 * 1000))); //36 hours

    const tokenEntryList:{userID:number; token:string; type:DATABASE_TOKEN_TYPE_ENUM; expirationDT:Date}[] =
        Array.from(unverifiedUserMap.keys()).map(userID => ({userID, token:generateToken(32, 'BYTES'), type:DATABASE_TOKEN_TYPE_ENUM.EMAIL_VERIFY, expirationDT}));

    if(await DB_INSERT_TOKEN_BATCH(tokenEntryList) == false) {
        log.error('sendEmailVerificationReminderBatch CANCELED - failed to insert token batch');
        return false;
    }

    const failedTokenList:string[] = [];
    for(let i:number = 0; i < tokenEntryList.length; i += 10) {
        const batch = tokenEntryList.slice(i, i + 10);

        await Promise.all(batch.map(async entry => {
            const user = unverifiedUserMap.get(entry.userID);

            const sent:boolean = await sendVerifyEmail({
                userID: entry.userID,
                email: user?.email ?? '',
                token: entry.token,
                firstName: user?.firstName
            });

            if(sent == false)
                failedTokenList.push(entry.token);
        }));
    }

    if(failedTokenList.length > 0)
        await DB_DELETE_TOKEN_BATCH(failedTokenList);

    return (failedTokenList.length === 0);
}
