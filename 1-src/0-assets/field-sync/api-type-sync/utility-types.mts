/***** ONLY DEPENDENCY:./inputField - Define all other types locally *****/
import { ENVIRONMENT_TYPE } from "../input-config-sync/inputField.mjs";
import { RoleEnum } from "../input-config-sync/profile-field-config.mjs";


/*********************************
*    ADDITIONAL UTILITY TYPES    *
**********************************/
/* Server Error | Toast Display: ServerErrorResponse.notification */
export interface ServerErrorResponse {
    status: number,
    notification: string,
};

export interface ServerDebugErrorResponse extends ServerErrorResponse {
    status:number,
    notification: string,
    jwtUserID: number,
    jwtUserRole: string,
    message: string,
    timestamp: string,
    action: string,
    type: string,
    url: string,
    params: string,
    query: string,
    header: string | object,
    body: string | object
};


/* EMAIL TYPES & HANDLING */
export enum EmailSubscription {
    USER_WEEKLY = 'USER_WEEKLY',
    PARTNER_MONTHLY = 'PARTNER_MONTHLY',

    SYSTEM_DEPLOYMENT = 'SYSTEM_DEPLOYMENT',
    SYSTEM_IMMEDIATE = 'SYSTEM_IMMEDIATE',
    SYSTEM_DAILY = 'SYSTEM_DAILY',
    SYSTEM_WEEKLY = 'SYSTEM_WEEKLY',
}


/* SERVER LOG CATEGORIES & TYPES */
//Server Additional Types: 1-src\2-services\10-utilities\logging\log-types.mts
export enum LogLocation {
    LOCAL = 'LOCAL', 
    S3 = 'S3',
}

export enum LogType {
    ERROR = 'ERROR', 
    WARN = 'WARN', 
    DB = 'DB', 
    AUTH = 'AUTH', 
    EMAIL = 'EMAIL',
    EVENT = 'EVENT',
}

//JSON form of LOG_ENTRY
export type LogListItem = { 
    timestamp:number; 
    type:LogType; 
    messages:string[]; 
    messageSearch:string; //Combine string for AWS Athena query
    stackTrace?:string[]; 
    fileKey?:string; 
    duplicateList?:string[]; 
};


/* ADMIN DASHBOARD STATISTICS */
export type AdminStatsResponse = {
    generatedDT:string,
    environment:ENVIRONMENT_TYPE,
    databaseUsageMap:Record<string, DatabaseTableUsage>,
    logDailyTrendMap:Record<LogType, LogDailyTrend[]>,
    userStats:DatabaseUserStats,
    partnershipStats:DatabasePartnershipStats,
}

export interface DatabaseTableUsage {
    totalRows:number,
    created24Hours:number,
    created7Days:number,
    created30Days:number,
    modified24Hours:number,
    modified7Days:number,
    modified30Days:number,
}

export interface DatabaseUserStats extends DatabaseTableUsage {
    emailVerified:number,
    walkLevelMap:Record<number, number>,
    roleMap:Record<RoleEnum, number>,
    unassignedUsers:number,
}

export type LogDailyTrend = {
    startTimestamp:number,
    total:number,
    unique:number,
    burstEvents:number
}

export interface DatabasePartnershipStats {
    matchGender:boolean,                //Matching Criteria
    ageYearRange:number,
    walkLevelRange:number,

    totalUsers:number,                  // Total users in the selected model source environment.
    usersInPartnerships:number,         // Distinct users currently in active PARTNER relationships.
    unassignedPartners:number,          // Users with partner capacity enabled but no assigned partnerships.

    partnerships:number,                // Total active PARTNER relationships.
    pendingPartnerships:number,         // Total pending relationships awaiting one or both contracts.
    availablePartners:number,           // Users who can still accept at least one more partner.
    
    availablePartnerCapacity:number,    // Sum of all remaining partner slots across users.
    filledPartnerCapacity:number,       // Sum of all occupied partner slots across users.
    
    newUserAverageWaitTimeHours:number, // Average wait time in hours for new unassigned users within 30 days.
    wait24Hours:number,                 // Unassigned users waiting more than 24 hours and up to 7 days.
    wait7Days:number,                   // Unassigned users waiting more than 7 days and up to 30 days.
    acceptedLastWeek:number,          // Partnerships fully accepted in the last 7 days.
    acceptedLastMonth:number,         // Partnerships fully accepted in the last 30 days.
}
