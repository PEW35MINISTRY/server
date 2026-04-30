import { getEnv } from '../10-utilities/utilities.mjs';
import USER from '../1-models/userModel.mjs';
import { EMAIL_SENDER_ADDRESS, EmailSenderAddress  } from './email-types.mjs';
import { getDateYearsAgo } from '../../0-assets/field-sync/input-config-sync/profile-field-config.mjs';



/*******************************
 * INDEPENDENT EMAIL UTILITIES *
 *******************************/

export const isInternalEmail = (email:string):boolean => {
    return (getEnv('EMAIL_DOMAIN')) &&
        email.toLowerCase().trim().split('@')[1]?.endsWith((getEnv('EMAIL_DOMAIN')).toLowerCase().trim()) === true;
}

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
}


export const formatDuration = (startDate:Date, endDate:Date = new Date()):string => {
    const difference:number = endDate.getTime() - startDate.getTime();
    const duration:number = Math.abs(difference);
    return `${(difference < 0) ? '-' : ''}${Math.floor(duration / (24 * 60 * 60 * 1000))}D ${Math.floor(duration / (60 * 60 * 1000)) % 24}H ${Math.floor(duration / (60 * 1000)) % 60}M ${Math.floor(duration / 1000) % 60}S ${duration % 1000}ms`;
}

export const getEmailSignature = (sender:EmailSenderAddress): string[] => {
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

//Under 18, must include EMAIL_YOUTH_SAFETY for communication record
export const minorInvolved = (...userList:USER[]):boolean => {
    return userList.some(user => !!user.dateOfBirth && user.dateOfBirth.getTime() > getDateYearsAgo(18).getTime());
}
