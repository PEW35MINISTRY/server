import SQL from 'mysql2';


export interface AWSDatabaseSecrets {
    host: string,
    dbname: string,
    username: string,
    password: string,
    port: number,
    engine: string,
    dbInstanceIdentifier: string
}


export interface CommandResponseType extends SQL.ResultSetHeader {
    'COUNT(*)'?:number
};


/* Determines the type and source model was created for filtering within the same database */
export enum DATABASE_MODEL_SOURCE_ENVIRONMENT_ENUM {   //Allowed Interactions:
    DEVELOPMENT = 'DEVELOPMENT',                       //DEVELOPMENT, MOCK
    MOCK = 'MOCK',                                     //MOCK, INTERNAL
    INTERNAL = 'INTERNAL',                             //PRODUCTION
    PRODUCTION = 'PRODUCTION'
}


/******************************************************************* 
*           Database `user` Table Created: 6/25/2023 
********************************************************************/
export const USER_TABLE_COLUMNS_REQUIRED:string[] = [ 'displayName', 'email', 'passwordHash' ];

export const USER_TABLE_COLUMNS:string[] = [ ...USER_TABLE_COLUMNS_REQUIRED,
    'userID', 'modelSourceEnvironment', 'firstName', 'lastName', 'postalCode', 'dateOfBirth', 'gender', 'isActive', 'walkLevel', 'image', 'notes', 'maxPartners'
];

export type DATABASE_USER = { //Optional Fields for PATCH/UPDATE
    userID: number, 
    modelSourceEnvironment: DATABASE_MODEL_SOURCE_ENVIRONMENT_ENUM,
    firstName?: string,
    lastName?: string,
    displayName?: string,  //Unique
    email?: string,        //Unique
    passwordHash?: string,
    postalCode?: string, 
    dateOfBirth?: Date, 
    gender?: DATABASE_GENDER_ENUM,
    isActive?: boolean,
    walkLevel?: number,
    image?: string,
    notes?: string,
    maxPartners: number,
    userRole?: DATABASE_USER_ROLE_ENUM, //Top role from table user_role_defined
};

export enum DATABASE_GENDER_ENUM {
    MALE = 'MALE',
    FEMALE = 'FEMALE'
}

export enum DATABASE_USER_ROLE_ENUM {
    USER = 'USER',                             //General user only access to mobile app.
    CIRCLE_LEADER = 'CIRCLE_LEADER',           //Allowed to create and manage small groups of users.
    CONTENT_APPROVER = 'CONTENT_APPROVER',     //Special access to content overview.
    DEVELOPER = 'DEVELOPER',                   //Full access to features; but not user data.
    ADMIN = 'ADMIN',                           //All access and privileges.
}


/******************************************************************* 
*           Database `partner` Table Created: 11/11/2023 
********************************************************************/
export const PARTNER_TABLE_COLUMNS_REQUIRED:string[] = [ 'userID', 'partnerID' ];

export const PARTNER_TABLE_COLUMNS:string[] = [ ...PARTNER_TABLE_COLUMNS_REQUIRED,
    'status', 'userContractDT', 'partnerContractDT', 'partnershipDT'
];

export type DATABASE_PARTNER = {
    userID: number, 
    partnerID: number,
    status: DATABASE_PARTNER_STATUS_ENUM,
    userContractDT?: string,
    partnerContractDT?: string, 
    partnershipDT?: boolean,
};

export enum DATABASE_PARTNER_STATUS_ENUM {
    PARTNER = 'PARTNER',
    PENDING_CONTRACT_BOTH = 'PENDING_CONTRACT_BOTH',
    PENDING_CONTRACT_USER = 'PENDING_CONTRACT_USER',
    PENDING_CONTRACT_PARTNER = 'PENDING_CONTRACT_PARTNER',
    ENDED = 'ENDED',
    FAILED = 'FAILED'
}


/******************************************************************* 
*           Database `circle` Table Created: 6/25/2023 
********************************************************************/
export const CIRCLE_TABLE_COLUMNS_REQUIRED:string[] = [ 'leaderID', 'name' ];

export const CIRCLE_TABLE_COLUMNS:string[] = [ ...CIRCLE_TABLE_COLUMNS_REQUIRED,
    'circleID', 'description', 'postalCode', 'isActive', 'inviteToken', 'image', 'notes'
];

export type DATABASE_CIRCLE = {  //Optional Fields for PATCH/UPDATE
    circleID: number, 
    leaderID?: number,
    name?: string,
    description?: string,
    postalCode?: string, 
    isActive?: boolean,
    inviteToken?: string,
    image?: string,
    notes?: string
};

export enum DATABASE_CIRCLE_STATUS_ENUM {
    MEMBER = 'MEMBER',
    INVITE = 'INVITE',
    REQUEST = 'REQUEST'
}

/******************************************************************** 
*      Database `circle_announcement` Table Created: 7/30/2023 
*********************************************************************/
export const CIRCLE_ANNOUNCEMENT_TABLE_COLUMNS_REQUIRED:string[] = [ 'circleID', 'message', 'endDate' ];

export const CIRCLE_ANNOUNCEMENT_TABLE_COLUMNS:string[] = [ ...CIRCLE_ANNOUNCEMENT_TABLE_COLUMNS_REQUIRED,
    'announcementID', 'startDate'
];

export type DATABASE_CIRCLE_ANNOUNCEMENT = {
    announcementID: number, 
    circleID: number, 
    message?: string,
    startDate?: Date,
    endDate?: Date, 
};


/******************************************************************** 
*      Database `prayer_request` Table Created: 8/9/2023 
*********************************************************************/
export const PRAYER_REQUEST_TABLE_COLUMNS_REQUIRED:string[] = [ 'requestorID', 'topic', 'description', 'expirationDate' ];

export const PRAYER_REQUEST_TABLE_COLUMNS:string[] = [ ...PRAYER_REQUEST_TABLE_COLUMNS_REQUIRED,
    'prayerRequestID', 'prayerCount', 'isOnGoing', 'isResolved', 'tagListStringified'
];

export type DATABASE_PRAYER_REQUEST = {
    prayerRequestID: number, 
    requestorID: number, 
    topic: string,
    description: string,
    prayerCount: number,
    isOnGoing: boolean,
    isResolved: boolean,
    tagListStringified: string,
    expirationDate: Date
};


/******************************************************************** 
*      Database `content` Table Created: 12/9/2023 
*********************************************************************/
export const CONTENT_TABLE_COLUMNS_REQUIRED:string[] = [ 'recorderID', 'type', 'source', 'url' ];

export const CONTENT_TABLE_COLUMNS:string[] = [ ...CONTENT_TABLE_COLUMNS_REQUIRED,
    'contentID', 'customType', 'customSource', 'keywordListStringified', 'title', 'description', 'image', 'likeCount', 'gender', 'minimumAge', 'maximumAge', 'minimumWalkLevel', 'maximumWalkLevel', 'notes'
];

export enum DATABASE_GENDER_SELECTION_ENUM {
    MALE = 'MALE',
    FEMALE = 'FEMALE',
    BOTH = 'BOTH'
}

export type DATABASE_CONTENT = {
    contentID: number, 
    recorderID: number, 
    type: string,
    customType: string|undefined,
    source: string,
    customSource: string|undefined,
    url: string,
    keywordListStringified?: string|undefined,
    title?: string,
    description?: string, 
    likeCount: number,
    gender: DATABASE_GENDER_SELECTION_ENUM, 
    minimumAge: number, 
    maximumAge: number, 
    minimumWalkLevel: number, 
    maximumWalkLevel: number, 
    notes?: string
};


/******************************************************************** 
*      Database `notification_device` Table Created: 12/7/2024      *
*********************************************************************/
export const NOTIFICATION_DEVICE_TABLE_COLUMNS_REQUIRED:string[] = [
    'deviceID', 'userID', 'deviceToken', 'deviceOS'
];

export const NOTIFICATION_DEVICE_TABLE_COLUMNS:string[] = [ ...NOTIFICATION_DEVICE_TABLE_COLUMNS_REQUIRED,
    'deviceName', 'endpointARN'
];

export enum DATABASE_DEVICE_OS_ENUM {
    IOS = 'IOS',
    ANDROID = 'ANDROID',
}

export type DATABASE_NOTIFICATION_DEVICE = {
    deviceID:number, //Auto incrementing, our ID in database
    userID:number,
    deviceName:string,
    endpointARN?:string,
    modifiedDT:Date
}
