import express, { NextFunction, Request, Response, Router } from 'express';
import * as log from '../../2-services/10-utilities/logging/log.mjs';
import { Exception } from '../api-types.mjs';
import { EmailSubscription } from '../../0-assets/field-sync/api-type-sync/utility-types.mjs';
import { EmailReportRequest } from './email-types.mjs';
import { makeDisplayText } from '../../0-assets/field-sync/input-config-sync/inputField.mjs';
import { EMAIL_ADDRESS_REGEX_SIMPLE, EmailReportContent } from '../../2-services/4-email/email-types.mjs';
import { DB_DELETE_USER_EMAIL_SUBSCRIPTION_BATCH } from '../../2-services/2-database/queries/user-security-queries.mjs';
import { DB_SELECT_USER } from '../../2-services/2-database/queries/user-queries.mjs';
import USER from '../../2-services/1-models/userModel.mjs';
import { getEmailReportContent, sendEmailReport } from '../../2-services/4-email/email.mjs';



/**************************************
 * EMAIL REPORTING & MESSAGING ROUTES *
 **************************************/
export const GET_EmailSubscriptionUnsubscribe = async(request:Request, response:Response):Promise<void> => {
    const clientID:number = Number(request.params.clientID);
    const subscription:EmailSubscription = request.params.subscription as EmailSubscription;

    if(!Number.isInteger(clientID) || clientID <= 0
        || !Object.values(EmailSubscription).includes(subscription as EmailSubscription)) {
        response.status(303).redirect(`${process.env.ENVIRONMENT_BASE_URL}/failed`)
        return;
    } else
        response.status(303).redirect(`${process.env.ENVIRONMENT_BASE_URL}/confirmation`); //Always success

    if(await DB_DELETE_USER_EMAIL_SUBSCRIPTION_BATCH(clientID, subscription))
        log.event(`User ${clientID} has successfully unsubscribed from ${subscription} internal emails.`);
    else
        log.warn(`FAILED - User ${clientID} has failed to unsubscribed from ${subscription} internal emails.`);
}


export const GET_EmailReportDownloadFile = async(request:Request, response:Response, next:NextFunction) => {
    const reportType:EmailSubscription|undefined =
        EmailSubscription[String(request.params.type ?? '').toUpperCase().trim() as keyof typeof EmailSubscription];

    if(reportType === undefined)
        return next(new Exception(400, `Invalid 'type' parameter :: ${request.params.type}`, 'Invalid Report Type'));

    const { subject, body, isHTML }:EmailReportContent = await getEmailReportContent(reportType);

    const fileName:string = `${reportType}_report_${Math.floor((Date.now() % (24 * 60 * 60 * 1000)) / 1000)}.${isHTML ? 'html' : 'txt'}`;

    response.setHeader('Content-Disposition', `attachment; filename='${fileName}'`);
    response.setHeader('X-Report-Subject', subject);
    response.setHeader('Content-Type', isHTML ? 'text/html; charset=utf-8' : 'text/plain; charset=utf-8');
    return response.status(200).send(body);
}


//Sends individual report: Accepts either request.clientID or query ?email=address
export const POST_EmailReportAdmin = async(request:EmailReportRequest, response:Response, next:NextFunction) => {
    const reportType:EmailSubscription|undefined = EmailSubscription[String(request.params.type ?? '').toUpperCase().trim() as keyof typeof EmailSubscription];
    let emailRecipient:string|undefined;

    if(request.clientID != undefined) {
        const client:USER = await DB_SELECT_USER(new Map([['userID', request.clientID]]));
        emailRecipient = client.isValid ? client.email : undefined;
    } else
        emailRecipient = request.query.email ? String(request.query.email).trim() : undefined;

    if(reportType === undefined)
        return next(new Exception(400, `Invalid 'type' parameter :: ${request.params.type}`, 'Invalid Report Type'));

    else if(request.query.email && request.clientID != undefined)
        return next(new Exception(400, 'Provide either ?email= OR clientID, not both.', 'Invalid Recipient'));

    else if(emailRecipient == undefined)
        return next(new Exception(400, 'Recipient missing. Provide ?email= or clientID.', 'Invalid Recipient'));

    else if(!EMAIL_ADDRESS_REGEX_SIMPLE.test(emailRecipient))
        return next(new Exception(400, `Invalid email format: ${emailRecipient}`, 'Invalid Email'));

    //Send Email Report
    const success:boolean = await sendEmailReport(reportType, new Map([[request.clientID ?? -1, emailRecipient]]), true);

    if(success)
        return response.status(200).json({ success:true, message:`${makeDisplayText(reportType)} email report sent successfully!` });

    return next(new Exception(500, 'Email report failed to send', 'Email Delivery Failure'));
}


//Broadcast report immediately to all current subscribers of report type
export const POST_EmailSubscriptionBroadcastAdmin = async(request:Request, response:Response, next:NextFunction) => {
    const reportType:EmailSubscription|undefined = EmailSubscription[String(request.params.type ?? '').toUpperCase().trim() as keyof typeof EmailSubscription];

    if(reportType === undefined)
        return next(new Exception(400, `Invalid 'type' parameter :: ${request.params.type}`, 'Invalid Report Type'));

    if(await sendEmailReport(reportType))
        return response.status(200).json({ success:true, message:`${makeDisplayText(reportType)} email subscription broadcast sent successfully!` });

    return next(new Exception(500, 'Email subscription broadcast failed to send', 'Email Delivery Failure'));
}
