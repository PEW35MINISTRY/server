

export enum EMAIL_SENDER_ADDRESS {
    SYSTEM = 'server@encouragingprayer.org',
    // ADMIN = 'admin@encouragingprayer.org',
    // SUPPORT = 'support@encouragingprayer.org',

    // SERVER = 'ethanjohnsrud@gmail.com',
    ADMIN = 'ethanjohnsrud@gmail.com',
    SUPPORT = 'ethanjohnsrud@gmail.com',
}



export const DEFAULT_PROFILE_URL:string = 'https://ep-cdn-data-prod.s3.us-east-2.amazonaws.com/assets/images/icons/profile-icon-blue.png';

export const DEFAULT_CIRCLE_URL:string = 'https://ep-cdn-data-prod.s3.us-east-2.amazonaws.com/assets/images/icons/circle-icon-blue.png';

/* EMAIL STYLING */
export enum EMAIL_COLOR {
    PRIMARY     = '#990000',   //'#B12020',
    ACCENT      = '#62D0F5',    
    RED         = '#B12020',
    BLUE        = '#62D0F5',

    TRANSPARENT = 'transparent',
    WHITE       = '#FFFFFF',
    BLACK       = '#000000',
    BLUE_DARK   = '#003F89',
    GRAY_DARK   = '#303030',
    GRAY_LIGHT  = '#A9A9A9',
}

export enum EMAIL_FONT_FAMILY {
    HEADER  = "'Playfair Display', 'Times New Roman', serif",
    SECTION = "'Playfair Display', 'Times New Roman', serif",
    TITLE   = "'EB Garamond', 'Times New Roman', serif",
    TEXT    = "Roboto, Arial, sans-serif",
    DETAIL  = "Roboto, Arial, sans-serif",
}

export enum EMAIL_FONT_SIZE {
    HEADER   = '50px',  //htmlHeader
    SECTION  = '32px',  //htmlSectionHeader
    TITLE    = '25px',  //htmlTitle
    TEXT     = '15px',  //htmlText, tables
    DETAIL   = '11px',  //finer details, notes
}

/* EMAIL LAYOUT UTILITIES */
export const EMAIL_CONTENT_MAX_WIDTH:string = '600px';

export const EMAIL_PROFILE_IMAGE_SIZE:number = 30;

export const EMAIL_ROW_MARGIN:string = '10px';

export const getNumericFontSize = (fontSize:EMAIL_FONT_SIZE):number => parseInt(fontSize); //Removes 'px'

export const getEmailLineHeight = (fontSize:EMAIL_FONT_SIZE, multiplier:number = 1.3):string => `${Math.round(getNumericFontSize(fontSize) * multiplier)}px`;

export const getEmailListIndent = (level:number):string => `${(level + 1) * 12}px`;


/* Type Definitions */
export type EmailAttachment = {
    filename:string, 
    content:Buffer,
    mimeType:string,
}


