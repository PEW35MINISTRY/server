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

export enum DATABASE_TABLE {
    USER = 'user',
    PARTNER = 'partner',

    CIRCLE = 'circle',
    CIRCLE_ANNOUNCEMENT = 'circle_announcement',
    CIRCLE_USER = 'circle_user',

    PRAYER_REQUEST = 'prayer_request',
    PRAYER_REQUEST_COMMENT = 'prayer_request_comment',
    PRAYER_REQUEST_LIKE = 'prayer_request_like',

    CONTENT = 'content',

    SUBSCRIPTION = 'subscription',
    NOTIFICATION_DEVICE = 'notification_device',

    USER_CACHE = 'user_search_cache',
    CONTACT_CACHE = 'user_contact_cache',
    CIRCLE_CACHE = 'circle_search_cache',
}

//Configuration for Reports on Database Tables
export const TABLES_SUPPORTING_DT: Map<DATABASE_TABLE, Array<'createdDT' | 'modifiedDT'>> = new Map([
    [DATABASE_TABLE.USER, ['createdDT', 'modifiedDT']],
    [DATABASE_TABLE.PARTNER, ['createdDT', 'modifiedDT']],

    [DATABASE_TABLE.CIRCLE, ['createdDT', 'modifiedDT']],
    [DATABASE_TABLE.CIRCLE_ANNOUNCEMENT, ['createdDT']],
    [DATABASE_TABLE.CIRCLE_USER, ['modifiedDT']],

    [DATABASE_TABLE.PRAYER_REQUEST, ['createdDT', 'modifiedDT']],
    [DATABASE_TABLE.PRAYER_REQUEST_COMMENT, ['createdDT']],
    [DATABASE_TABLE.PRAYER_REQUEST_LIKE, ['modifiedDT']],

    [DATABASE_TABLE.CONTENT, ['createdDT', 'modifiedDT']],

    [DATABASE_TABLE.SUBSCRIPTION, ['createdDT']],
    [DATABASE_TABLE.NOTIFICATION_DEVICE, ['createdDT', 'modifiedDT']],

    [DATABASE_TABLE.USER_CACHE, ['createdDT']],
    [DATABASE_TABLE.CONTACT_CACHE, ['createdDT']],
    [DATABASE_TABLE.CIRCLE_CACHE, ['createdDT']],
]);


/******************************************************************* 
*           Database `user` Table Created: 6/25/2023 
********************************************************************/
export const USER_TABLE_COLUMNS_REQUIRED:string[] = [ 'displayName', 'email', 'passwordHash' ];

export const USER_TABLE_COLUMNS_EDIT:string[] = [ ...USER_TABLE_COLUMNS_REQUIRED,
    'modelSourceEnvironment', 'firstName', 'lastName', 'isEmailVerified', 'postalCode', 'dateOfBirth', 'gender', 'walkLevel', 'maxPartners', 'image', 'notes'
];

export const USER_TABLE_COLUMNS:string[] = [ ...USER_TABLE_COLUMNS_EDIT,
    'userID', 'createdDT', 'modifiedDT'
];

export type DATABASE_USER = { //Optional Fields for PATCH/UPDATE
    userID: number, 
    modelSourceEnvironment: DATABASE_MODEL_SOURCE_ENVIRONMENT_ENUM,
    firstName?: string,
    lastName?: string,
    displayName?: string,  //Unique
    email?: string,        //Unique
    isEmailVerified?: boolean,
    emailVerifiedDT?: Date|null,
    passwordHash?: string,
    postalCode?: string, 
    dateOfBirth?: Date, 
    gender?: DATABASE_GENDER_ENUM,
    walkLevel?: number,
    maxPartners: number,
    image?: string,
    notes?: string,
    userRole?: DATABASE_USER_ROLE_ENUM, //Top role from table user_role_defined
};

export enum DATABASE_GENDER_ENUM {
    MALE = 'MALE',
    FEMALE = 'FEMALE'
}

export enum DATABASE_USER_ROLE_ENUM {
    ADMIN = 'ADMIN',                           // All access and privileges.
    DEVELOPER = 'DEVELOPER',                   // Full access to features; but not user data.
    CONTENT_APPROVER = 'CONTENT_APPROVER',     // Access to add content hosted on the application.
    CIRCLE_MANAGER = 'CIRCLE_MANAGER',         // Can create circles and manage profiles of users within their circles.
    CIRCLE_LEADER = 'CIRCLE_LEADER',           // Can create and manage small user groups (circles), including member approvals.
    TEST_USER = 'TEST_USER',                   // Internal role for QA to stay separate from production users.
    USER = 'USER',                             // Standard user role with access to mobile app features only.
    DEMO_USER = 'DEMO_USER',                   // Temporary trial user with limited access.
    INACTIVE = 'INACTIVE',                     // Permanently or indefinitely disabled account with no app access.
    REPORTED = 'REPORTED'                      // Restricted account pending administrative review for flagged behavior.
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

export const CIRCLE_TABLE_COLUMNS_EDIT:string[] = [ ...CIRCLE_TABLE_COLUMNS_REQUIRED,
    'isActive', 'inviteToken', 'description', 'postalCode', 'image', 'notes'
];

export const CIRCLE_TABLE_COLUMNS:string[] = [ ...CIRCLE_TABLE_COLUMNS_EDIT,
    'circleID', 'createdDT', 'modifiedDT'
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

export const CIRCLE_ANNOUNCEMENT_TABLE_COLUMNS_EDIT:string[] = [ ...CIRCLE_ANNOUNCEMENT_TABLE_COLUMNS_REQUIRED,
    'startDate'
];

export const CIRCLE_ANNOUNCEMENT_TABLE_COLUMNS:string[] = [ ...CIRCLE_ANNOUNCEMENT_TABLE_COLUMNS_REQUIRED,
    'announcementID', 'createdDT'
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

export const PRAYER_REQUEST_TABLE_COLUMNS_EDIT:string[] = [ ...PRAYER_REQUEST_TABLE_COLUMNS_REQUIRED,
    'isOnGoing', 'isResolved', 'tagListStringified'
];

export const PRAYER_REQUEST_TABLE_COLUMNS:string[] = [ ...PRAYER_REQUEST_TABLE_COLUMNS_EDIT,
    'prayerRequestID', 'createdDT', 'modifiedDT'
];

export interface DATABASE_PRAYER_REQUEST {
    prayerRequestID: number, 
    requestorID: number, 
    topic: string,
    description: string,
    isOnGoing: boolean,
    isResolved: boolean,
    tagListStringified?: string,
    expirationDate: Date,
    createdDT: Date,
    modifiedDT: Date
};


//prayer_request joint table parsed in PRAYER_REQUEST.constructByDatabase
export const PRAYER_REQUEST_EXTENDED_TABLE_COLUMNS:string[] = [ ...PRAYER_REQUEST_TABLE_COLUMNS,
    //Expects ('requestorDisplayName', 'requestorFirstName', 'requestorImage'), //Assembled into requestorProfile
    'prayerCount', 'prayerCountRecipient',
];

export interface DATABASE_PRAYER_REQUEST_EXTENDED extends DATABASE_PRAYER_REQUEST {
    //requestorProfile:ProfileListItem
    requestorFirstName?:string,
    requestorDisplayName?:string,
    requestorImage?:string,

    //Joint Table Queries
    prayerCount: number,
    prayerCountRecipient?:number,
}


/******************************************************************** 
*      Database `prayer_request_comment` 
*********************************************************************/
export const PRAYER_REQUEST_COMMENT_TABLE_COLUMNS_REQUIRED = [ 'prayerRequestID', 'commenterID', 'message' ];

export const PRAYER_REQUEST_COMMENT_TABLE_COLUMNS = [ ...PRAYER_REQUEST_COMMENT_TABLE_COLUMNS_REQUIRED,
    'commentID', 'likeCount', 'createdDT'   //Read only
];

export interface DATABASE_PRAYER_REQUEST_COMMENT {
  commentID: number;
  prayerRequestID: number;
  commenterID: number;
  message: string;
  createdDT: Date;
}

export interface DATABASE_PRAYER_REQUEST_COMMENT_EXTENDED extends DATABASE_PRAYER_REQUEST_COMMENT {
    //commenterProfile:ProfileListItem
    commenterFirstName?:string;
    commenterDisplayName?:string;
    commenterImage?:string;

    //Joint Table Queries
    likeCount?:number;
    isLikedByRecipient?:boolean;
}


/******************************************************************** 
*      Database `content` Table Created: 12/9/2023 
*********************************************************************/
export const CONTENT_TABLE_COLUMNS_REQUIRED:string[] = [ 'recorderID', 'type', 'source', 'url' ];

export const CONTENT_TABLE_COLUMNS_EDIT:string[] = [ ...CONTENT_TABLE_COLUMNS_REQUIRED,
    'likeCount', 'customType', 'customSource', 'keywordListStringified', 'title', 'description', 'image', 'gender', 'minimumAge', 'maximumAge', 'minimumWalkLevel', 'maximumWalkLevel', 'notes'
];

export const CONTENT_TABLE_COLUMNS:string[] = [ ...CONTENT_TABLE_COLUMNS_EDIT,
    'contentID', 'createdDT', 'modifiedDT'   //Read only
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
    notes?: string,
    createdDT: Date,
    modifiedDT: Date
};


/******************************************************************** 
*      Database `notification_device` Table Created: 12/7/2024      *
*********************************************************************/
export const NOTIFICATION_DEVICE_TABLE_COLUMNS_REQUIRED:string[] = [ 'deviceID', 'userID' ];

export const NOTIFICATION_DEVICE_TABLE_COLUMNS:string[] = [ ...NOTIFICATION_DEVICE_TABLE_COLUMNS_REQUIRED,
    'deviceName', 'endpointARN'
];

export type DATABASE_NOTIFICATION_DEVICE = {
    deviceID:number, //Auto incrementing, our ID in database
    userID:number,
    deviceName:string,
    endpointARN?:string,
}


/******************************************************* 
*      Database `token` Table Created: 12/21/2025      *
********************************************************/
export const TOKEN_TABLE_COLUMNS_REQUIRED:string[] = [ 'userID', 'type', 'token', 'expirationDT' ];

export enum DATABASE_TOKEN_TYPE_ENUM {
    PASSWORD_RESET = 'PASSWORD_RESET',
}

export type DATABASE_TOKEN = {
    userID:number,
    type:DATABASE_TOKEN_TYPE_ENUM,
    token:string,
    expirationDT?:Date|null, //null implies indefinite
    createdDT?:Date, //Assign in database
}
