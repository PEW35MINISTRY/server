import express, { NextFunction, Request, Response, Router } from 'express';
import * as log from '../../2-services/10-utilities/logging/log.mjs';
import { Exception } from '../api-types.mjs';
import { EmailReport } from '../../0-assets/field-sync/api-type-sync/utility-types.mjs';
import { EmailReportRequest } from './email-types.mjs';
import { makeDisplayText } from '../../0-assets/field-sync/input-config-sync/inputField.mjs';
import { sendEmailLogReport, sendEmailUserReport } from '../../2-services/4-email/email.mjs';



/**************************************
 * EMAIL REPORTING & MESSAGING ROUTES *
 **************************************/

export const POST_EmailReport = async(reportType:EmailReport, request:EmailReportRequest, response:Response, next:NextFunction) => {
    if(!(reportType in EmailReport))
        return next(new Exception(400, `Invalid 'type' parameter :: ${request.params.type}`, 'Invalid Report Type'));

    let success = false;
    switch(reportType) {
        case EmailReport.LOG:
            success = await sendEmailLogReport(request.clientID);
            break;
        case EmailReport.USER:
            success = await sendEmailUserReport(request.clientID);
            break;
        default:
            return next(new Exception(500, `Email Report: ${reportType}, not supported in POST_EmailReport`, `${makeDisplayText(reportType)} Report Unavailable`));
    }

    if(success)
            return response.status(200).json({ success:true, message:`${makeDisplayText(reportType)} email report sent successfully!` });
    else
        return next(new Exception(500, 'Email report failed to send', 'Email Delivery Failure'));
}
