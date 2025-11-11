


/*******************************
 * INDEPENDENT EMAIL UTILITIES *
 *******************************/

import { EMAIL_SENDER_ADDRESS } from "./email-types.mjs";

export const formatDate = (value?:Date|string, includeTime?:boolean, timeZone:string = 'America/Chicago'):string => {
    if(!value) return '';

    const date = value instanceof Date ? value : new Date(value);
    if (isNaN(date.getTime())) return '';

    let showTime = includeTime;
    if(showTime === undefined) {
        const now = new Date();
        const diffMs = Math.abs(now.getTime() - date.getTime());
        showTime = (diffMs <= (2 * 24 * 60 * 60 * 1000)); //2days
    }

    const options: Intl.DateTimeFormatOptions = showTime
        ? { month: '2-digit', day: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit', hour12: true, timeZone }
        : { month: '2-digit', day: '2-digit', year: 'numeric', timeZone };

    return new Intl.DateTimeFormat('en-US', options).format(date);
};


export const getEmailSignature = (sender:EMAIL_SENDER_ADDRESS): string[] => {
  switch(sender) {
    case EMAIL_SENDER_ADDRESS.ADMIN:
      return ['— EP Admin Team'];

    case EMAIL_SENDER_ADDRESS.SUPPORT:
      return [
        '— EP Support', '',
        'Need help? Reply to:',
        'support@encouragingprayer.org'
      ];

    case EMAIL_SENDER_ADDRESS.SYSTEM:
    default:
      return [];
  }
};
