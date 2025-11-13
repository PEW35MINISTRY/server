import express, { NextFunction, Request, Response, Router } from 'express';
import * as log from '../../2-services/10-utilities/logging/log.mjs';
import { Exception } from '../api-types.mjs';
import { EmailReport } from '../../0-assets/field-sync/api-type-sync/utility-types.mjs';
import { EmailReportRequest } from './email-types.mjs';
import { makeDisplayText } from '../../0-assets/field-sync/input-config-sync/inputField.mjs';
import { assembleLogReportText, assembleUserReportHTML, sendEmailLogReport, sendEmailUserReport } from '../../2-services/4-email/email.mjs';
import { EMAIL_ADDRESS_REGEX_SIMPLE } from '../../2-services/4-email/email-types.mjs';



/**************************************
 * EMAIL REPORTING & MESSAGING ROUTES *
 **************************************/

export const GET_EmailReport = async(request:EmailReportRequest, response:Response, next:NextFunction) => {
    const reportType:EmailReport|undefined = EmailReport[String(request.params.type ?? '').toUpperCase().trim() as keyof typeof EmailReport];

    if(reportType === undefined)
        return next(new Exception(400, `Invalid 'type' parameter :: ${request.params.type}`, 'Invalid Report Type'));

    let body:string = '';
    switch(reportType){
        case EmailReport.LOG:
            body = await assembleLogReportText();
            response.setHeader('Content-Type', 'text/plain');
            break;

        case EmailReport.USER:
            body = await assembleUserReportHTML();
            response.setHeader('Content-Type', 'text/html');
            break;

        default:
            return next(new Exception(500, `Email Report: ${reportType}, not supported in GET_EmailReport`, `${makeDisplayText(reportType)} Report Unavailable`));
    }

    response.setHeader('Content-Disposition', 'inline');
    return response.status(200).send(body);
}


//Accepts either request.clientID or query ?email=address
export const POST_EmailReport = async(request:EmailReportRequest, response:Response, next:NextFunction) => {
    const reportType:EmailReport|undefined = EmailReport[String(request.params.type ?? '').toUpperCase().trim() as keyof typeof EmailReport];
    const emailRecipient:string|undefined = request.query.email;

    if(reportType === undefined) 
        return next(new Exception(400, `Invalid 'type' parameter :: ${request.params.type}`, 'Invalid Report Type'));

    else if(emailRecipient && request.clientID)
        return next(new Exception(400, 'Provide either ?email= OR clientID, not both.', 'Invalid Recipient'));

    else if(!emailRecipient && !request.clientID)
        return next(new Exception(400, 'Recipient missing. Provide ?email= or clientID.', 'Invalid Recipient'));

    else if(emailRecipient && !EMAIL_ADDRESS_REGEX_SIMPLE.test(emailRecipient))
        return next(new Exception(400, `Invalid email format: ${emailRecipient}`, 'Invalid Email'));


    /* Await Email Report Sending */
    let success = false;
    switch(reportType) {
        case EmailReport.LOG:
            success = await sendEmailLogReport(emailRecipient, request.clientID);
            break;
        case EmailReport.USER:
            success = await sendEmailUserReport(emailRecipient, request.clientID);
            break;
        default:
            return next(new Exception(500, `Email Report: ${reportType}, not supported in POST_EmailReport`, `${makeDisplayText(reportType)} Report Unavailable`));
    }


    if(success)
            return response.status(200).json({ success:true, message:`${makeDisplayText(reportType)} email report sent successfully!` });
    else
        return next(new Exception(500, 'Email report failed to send', 'Email Delivery Failure'));
}
