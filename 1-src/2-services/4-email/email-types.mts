

export enum EMAIL_SENDER_ADDRESS {
    SERVER = 'server@encouragingprayer.org',
    // ADMIN = 'admin@encouragingprayer.org',
    // SUPPORT = 'support@encouragingprayer.org',

    // SERVER = 'ethanjohnsrud@gmail.com',
    ADMIN = 'ethanjohnsrud@gmail.com',
    SUPPORT = 'ethanjohnsrud@gmail.com',
}

export type EmailAttachment = {
    filename:string, 
    content:Buffer,
    mimeType:string,
}

