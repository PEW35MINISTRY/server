import { existsSync, readFileSync } from 'fs';
import path, { join } from 'path';
import * as log from '../../10-utilities/logging/log.mjs';
import { LogType, LogDailyTrend, DatabaseTableUsage } from '../../../0-assets/field-sync/api-type-sync/utility-types.mjs';
import { ENVIRONMENT_TYPE, makeDisplayText } from '../../../0-assets/field-sync/input-config-sync/inputField.mjs';
import { fetchS3LogsByDateRange, calculateLogDailyTrends } from '../../10-utilities/logging/log-s3-utilities.mjs';
import { LOG_BURST_EVENT_THRESHOLD } from '../../10-utilities/logging/log-types.mjs';
import LOG_ENTRY from '../../10-utilities/logging/logEntryModel.mjs';
import { checkAWSAuthentication, getAWSMetadata, getEnvironment, getModelSourceEnvironment } from '../../10-utilities/utilities.mjs';
import { DATABASE_MODEL_SOURCE_ENVIRONMENT_ENUM, DATABASE_TABLE } from '../../2-database/database-types.mjs';
import { DB_CALCULATE_TABLE_USAGE } from '../../2-database/queries/queries.mjs';
import { htmlText, htmlVerticalSpace, htmlActionButton, htmlSection, htmlDetailList } from '../components/email-template-components.mjs';
import { renderLogList, renderDatabaseTableUsage, renderLogTrendTable } from '../components/email-template-renders.mjs';
import { AWSMetadata, EmailReportContent } from '../email-types.mjs';
import { formatDate, formatDuration } from '../email-utilities.mjs';
import { SERVER_START_TIMESTAMP, SERVER_START_TIMESTAMP_PATH } from '../../../server.mjs';


/************************************
 *    LOGS REPORT BODY ASSEMBLY     *
 * Text body to include attachments *
 ************************************/
export const assembleLogAlertReport = async(entry:LOG_ENTRY, html:boolean = false):Promise<string[]> => {
    const impactedUserMap:Map<number, number> = getLogImpactedUsers([entry]);

    if(html) 
        return [
            htmlDetailList([
                ['Environment:', makeDisplayText(getEnvironment())],
                ['Type:', `${entry.type}`],
                ['Timestamp:', entry.date.toISOString()],
            ], 'Alert Summary'),
            htmlVerticalSpace(5),
            htmlText(entry.toString()),
            htmlActionButton([
                { label:'More Details', link:entry.fileKey, style:'OUTLINE' },
                { label:'Portal Logs', link:`${process.env.ENVIRONMENT_BASE_URL}/portal/logs`, style:'ACCENT' },
            ]),
            htmlVerticalSpace(5),
            ...(impactedUserMap.size > 0
                ? [
                    htmlDetailList(
                        Array.from(impactedUserMap.keys()).map((userID:number) => [`User #${userID}:`, `${process.env.ENVIRONMENT_BASE_URL}/portal/edit/profile/${userID}`]),
                        'Impacted Users'
                    ),
                    htmlVerticalSpace(5),
                ]
                : []),
            htmlSection('Latest Related Logs'),
            await renderLogList(entry.type, { maxEntries:25, html:true }),
        ];

    else 
        return [
            'Alert Summary',
            `Environment: ${makeDisplayText(getEnvironment())}`,
            `Type: ${entry.type}`,
            `Timestamp: ${entry.date.toISOString()}`,
            '\n\n',
            entry.toString(),
            `More Details: ${entry.fileKey}`,
            `Portal Logs: ${process.env.ENVIRONMENT_BASE_URL}/portal/logs`,
            '\n\n',
            ...(impactedUserMap.size > 0
                ? [
                    'Impacted Users',
                    ...Array.from(impactedUserMap.entries()).map(([userID]) => `User #${userID}: ${process.env.ENVIRONMENT_BASE_URL}/portal/edit/profile/${userID}`),
                    '\n\n',
                ]
                : []),
            'Latest Related Logs',
            await renderLogList(entry.type, { maxEntries:25, html:false }),
        ];
}


export const assembleDailyLogReport = async(type:LogType = LogType.ERROR):Promise<EmailReportContent> => {
    const nowTimestamp:number = Date.now();
    const nowDayOfWeek:string = new Date(nowTimestamp).toLocaleDateString('en-US', { weekday:'long', timeZone:'America/Chicago' });
    const startTimestamp:number = nowTimestamp - (24 * 60 * 60 * 1000);
    const logList:LOG_ENTRY[] = await fetchS3LogsByDateRange(type, startTimestamp, nowTimestamp);

    if(logList.length === 0) return {subject: '', body: '', isHTML:false};

    //Matches URL pattern: 'action: GET -> route'
    const routeActionRegex:RegExp = new RegExp(/^action:\s*(.+\s*->\s*.+)$/, 'ig');
    const normalizeRouteIDRegex:RegExp = new RegExp(/\d+/, 'g');
    const affectedRouteMap:Map<string, number> = new Map();

    logList.forEach((log:LOG_ENTRY) => {
        log.messages.forEach((message:string) => {
            
            for(const match of message.matchAll(routeActionRegex)) {
                const normalizedAction:string = match[1].replace(normalizeRouteIDRegex, '#');
                affectedRouteMap.set(normalizedAction, (affectedRouteMap.get(normalizedAction) ?? 0) + (log.duplicateList.length + 1));
            }
        });
    });

    const burstEvents:{entry:LOG_ENTRY, quantity:number}[] = logList.map(log => ({ entry:log, quantity: (log.duplicateList.length + 1) }))
                    .filter(item => item.quantity >= LOG_BURST_EVENT_THRESHOLD).sort((a,b) => b.quantity - a.quantity);

    const impactedUserMap:Map<number, number> = getLogImpactedUsers(logList);

    const dailyTrends:LogDailyTrend[] = await calculateLogDailyTrends(type, 7, logList);
    const weeklyAverage:number = dailyTrends.slice(1, 8).reduce((sum:number, trend:LogDailyTrend) => sum + trend.total, 0) / Math.max(dailyTrends.slice(1, 8).length, 1);
    const totalToday:number = logList.reduce((sum:number, log:LOG_ENTRY) => sum + 1 + log.duplicateList.length, 0);

    return {subject: `EP ${nowDayOfWeek}'s ${makeDisplayText(type)} Report - ${makeDisplayText(getEnvironment())}`, isHTML:false,
        body: `${nowDayOfWeek} ${makeDisplayText(type)} Report\n`.toUpperCase()
            + '-----------------------------------------------\n\n'
            + `Information Generated (CST): ${formatDate(new Date(), true)}\n`
            + `Environment: ${makeDisplayText(getEnvironment())}\n`
            + `Range: ${new Date(startTimestamp).toLocaleString('en-US', { timeZone:'America/Chicago' })} - ${new Date(nowTimestamp).toLocaleString('en-US', { timeZone:'America/Chicago' })}\n`
            + '\n'
            + `Unique ${makeDisplayText(type)}s: ${logList.length}\n`
            + `Total Occurrences: ${totalToday}\n`
            + `Duplicates: ${totalToday > 0 ? ((((totalToday - logList.length) / totalToday) * 100).toFixed(2)) : '0.00'}% (${totalToday - logList.length})\n`
            + ((dailyTrends.length >= 8)
                    ? `${dailyTrends[0].total >= dailyTrends[1].total ? 'Increase' : 'Decrease'} vs. Yesterday: ${dailyTrends[1].total > 0 ? `${Math.round((Math.abs(dailyTrends[0].total - dailyTrends[1].total) / dailyTrends[1].total) * 100)}%` : `${dailyTrends[0].total - dailyTrends[1].total}`} (${dailyTrends[0].total} vs ${dailyTrends[1].total})\n`
                    + `${dailyTrends[0].total >= weeklyAverage ? 'Increase' : 'Decrease'} vs. Weekly Average: ${weeklyAverage > 0 ? `${Math.round((Math.abs(dailyTrends[0].total - weeklyAverage) / weeklyAverage) * 100)}%` : `${dailyTrends[0].total - weeklyAverage}`} (${dailyTrends[0].total} vs ${Math.round(weeklyAverage)})\n`
                    + `${dailyTrends[0].total >= dailyTrends[7].total ? 'Increase' : 'Decrease'} vs. last ${nowDayOfWeek}: ${dailyTrends[7].total > 0 ? `${Math.round((Math.abs(dailyTrends[0].total - dailyTrends[7].total) / dailyTrends[7].total) * 100)}%` : `${dailyTrends[0].total - dailyTrends[7].total}`} (${dailyTrends[0].total} vs ${dailyTrends[7].total})\n`
                    + '\n'
                : '')
            + ((affectedRouteMap.size > 0)
                    ? `Most Affected Routes\n`
                    + `--------------------\n`
                    + `${Array.from(affectedRouteMap.entries()).sort((a,b) => b[1] - a[1]).slice(0, 5).map(([route, count]) => `(${count}) ${route}`).join('\n')}\n`
                    + '\n'
                : '')
            + ((impactedUserMap.size > 0)
                    ? `Most Impacted Users\n`
                    + `-------------------\n`
                    + `${Array.from(impactedUserMap.entries()).sort((a,b) => b[1] - a[1]).slice(0, 10).map(([userID, count]) => `(${count}) User #${userID}: ${process.env.ENVIRONMENT_BASE_URL}/portal/edit/profile/${userID}`).join('\n')}\n`
                    + '\n'
                : '')
            + ((burstEvents.length > 0)
                    ? `Identified Burst Events\n`
                    + `-----------------------\n`
                    + `${burstEvents.map(item => `(${item.quantity}) ${LOG_ENTRY.summarize(item.entry, undefined, 100)}`).join('\n')}\n`
                    + '\n'
                : '')
            + `== See Latest ${makeDisplayText(type)} Logs ==\n${process.env.ENVIRONMENT_BASE_URL}/portal/logs/${type}`
            + '\n\n'
            + await renderLogList(type, { maxEntries:100, pastDays:2, html:false })
        };
}


export const assembleWeeklySystemReport = async():Promise<EmailReportContent> => {
    const errorDailyTrends:LogDailyTrend[] = await calculateLogDailyTrends(LogType.ERROR, 17);
    const warnDailyTrends:LogDailyTrend[] = await calculateLogDailyTrends(LogType.WARN, 17);
    const userStats:DatabaseTableUsage = await DB_CALCULATE_TABLE_USAGE(DATABASE_TABLE.USER);

    const FAIL_REGEX:RegExp = new RegExp(/(fail|err|exception|denied|invalid|rejected|incorrect|unavailable|warn)/, 'i');

    const emailLogs:LOG_ENTRY[] = await fetchS3LogsByDateRange(LogType.EMAIL, Date.now() - (7 * 24 * 60 * 60 * 1000), Date.now(), 1000, false);
    const emailFailCount:number = emailLogs.reduce((sum:number, log:LOG_ENTRY) => sum + (log.messages.some(message => FAIL_REGEX.test(message)) ? 1 : 0), 0);
    const emailSuccessRate:number = (emailLogs.length > 0) ? Math.round(((emailLogs.length - emailFailCount) / emailLogs.length) * 100) : 0;

    const currentWeekErrorTotal:number = errorDailyTrends.slice(0, 7).reduce((sum:number, trend:LogDailyTrend) => sum + trend.total, 0);
    const previousWeekErrorTotal:number = errorDailyTrends.slice(7, 14).reduce((sum:number, trend:LogDailyTrend) => sum + trend.total, 0);

    const currentWeekWarnTotal:number = warnDailyTrends.slice(0, 7).reduce((sum:number, trend:LogDailyTrend) => sum + trend.total, 0);
    const previousWeekWarnTotal:number = warnDailyTrends.slice(7, 14).reduce((sum:number, trend:LogDailyTrend) => sum + trend.total, 0);

    const previousUserTotal:number = Math.max(userStats.totalRows - userStats.created7Days, 0);
    const expectedWeeklyUsers:number = Math.round((userStats.created30Days / 30) * 7);

    return {subject: `EP Server Status System Report - ${makeDisplayText(getEnvironment())}`, isHTML:false,
        body: `SERVER STATUS SYSTEM REPORT\n`
            + '---------------------------\n\n'
            + `Information Generated (CST): ${formatDate(new Date(), true)}\n`
            + `Environment: ${getEnvironment()}`
            + `User Source: ${getModelSourceEnvironment()}`
            + '\n\n'
            + `Weekly Summary\n`
            + `--------------\n`
            + `${currentWeekErrorTotal >= previousWeekErrorTotal ? 'Increase' : 'Decrease'} in Errors: ${previousWeekErrorTotal > 0 ? Math.round((Math.abs(currentWeekErrorTotal - previousWeekErrorTotal) / previousWeekErrorTotal) * 100) : (currentWeekErrorTotal > 0 ? 100 : 0)}% (${currentWeekErrorTotal} vs ${previousWeekErrorTotal})\n`
            + `${currentWeekWarnTotal >= previousWeekWarnTotal ? 'Increase' : 'Decrease'} in Warnings: ${previousWeekWarnTotal > 0 ? Math.round((Math.abs(currentWeekWarnTotal - previousWeekWarnTotal) / previousWeekWarnTotal) * 100) : (currentWeekWarnTotal > 0 ? 100 : 0)}% (${currentWeekWarnTotal} vs ${previousWeekWarnTotal})\n`
            + `Email Success Rate: ${emailSuccessRate}% (${emailLogs.length - emailFailCount} success, ${emailFailCount} failures)\n`
            + '\n'
            + `New User Growth: ${previousUserTotal > 0 ? Math.round((userStats.created7Days / previousUserTotal) * 100) : 0}% (${userStats.created7Days} new)\n`
            + `New Users vs. 30-Day Average: ${expectedWeeklyUsers > 0 ? Math.round((Math.abs(userStats.created7Days - expectedWeeklyUsers) / expectedWeeklyUsers) * 100) : (userStats.created7Days > 0 ? 100 : 0)}% ${userStats.created7Days >= expectedWeeklyUsers ? 'increase' : 'decrease'} (${userStats.created7Days} vs ${expectedWeeklyUsers} expected)\n`
            + '\n\n'
            + await renderDatabaseTableUsage([DATABASE_TABLE.USER, DATABASE_TABLE.PARTNER, DATABASE_TABLE.SUBSCRIPTION], false, 'User Database Usage')
            + '\n\n'
            + await renderDatabaseTableUsage([DATABASE_TABLE.CIRCLE, DATABASE_TABLE.CIRCLE_USER, DATABASE_TABLE.CIRCLE_ANNOUNCEMENT], false, 'Circle Database Usage')
            + '\n\n'
            + await renderDatabaseTableUsage([DATABASE_TABLE.PRAYER_REQUEST, DATABASE_TABLE.CONTENT], false, 'Content Database Usage')
            + '\n\n'
            + await renderDatabaseTableUsage([DATABASE_TABLE.USER_CACHE, DATABASE_TABLE.CONTACT_CACHE, DATABASE_TABLE.CIRCLE_CACHE], false, 'Database Search Cache')
            + '\n\n'
            + await renderLogTrendTable([LogType.ERROR, LogType.WARN, LogType.DB, LogType.EMAIL, LogType.AUTH, LogType.EVENT], false)
            + '\n\n'
            + `== See Latest Logs ==\n${process.env.ENVIRONMENT_BASE_URL}/portal/logs`
            + '\n\n'
            + await renderLogList(LogType.ERROR, { maxEntries:50, pastDays:7, html:false })
            + '\n\n'
            + await renderLogList(LogType.WARN, { maxEntries:25, pastDays:7, html:false })
            + '\n\n'
            + await renderLogList(LogType.DB, { maxEntries:25, pastDays:7, html:false })
        };
}


/* DEPLOY STATUS & CONFIGURATIONS */
export const assembleDeploymentSystemReport = async():Promise<EmailReportContent> => {
    try {
        const now:Date = new Date();
        let lastRestart:Date = existsSync(SERVER_START_TIMESTAMP_PATH) ? new Date(readFileSync(SERVER_START_TIMESTAMP_PATH, 'utf8').trim()) : SERVER_START_TIMESTAMP;
        if(isNaN(lastRestart.getTime())) lastRestart = SERVER_START_TIMESTAMP;
        const lastRestartDurationMS:number = SERVER_START_TIMESTAMP.getTime() - lastRestart.getTime();
        const lastRestartCheck:boolean = ((lastRestartDurationMS / (1000 * 60)) > 5.0);

        const packageJsonPath:string = path.join(process.cwd(), 'package.json');
        const packageJson:{version:string} = JSON.parse(readFileSync(packageJsonPath, 'utf8'));
        const version:string = packageJson.version ?? '0.0.0';

        const gitBranch:string = process.env.GIT_BUILD_BRANCH ?? 'BRANCH';
        const gitCommit:string = process.env.GIT_BUILD_COMMIT ?? 'COMMIT';
        const branchCheck:boolean = !!gitBranch && (gitBranch.includes('release') || gitBranch === 'master');

        const environmentCheck:boolean = (process.env.ENVIRONMENT === undefined) || (getEnvironment() !== ENVIRONMENT_TYPE.PRODUCTION);
        const modelSourceCheck:boolean = (process.env.DEFAULT_MODEL_SOURCE_ENVIRONMENT === undefined) || (getModelSourceEnvironment() !== DATABASE_MODEL_SOURCE_ENVIRONMENT_ENUM.PRODUCTION);

        const awsAuthenticated:boolean = await checkAWSAuthentication();
        const awsMetadata:AWSMetadata|undefined = await getAWSMetadata();
        const ec2Check:boolean|undefined = awsMetadata ? true : (getEnvironment() === ENVIRONMENT_TYPE.LOCAL ? undefined : false); //Not expected locally

        const overallCheck:boolean = lastRestartCheck && environmentCheck && modelSourceCheck && branchCheck && (ec2Check !== false);

        return {subject:`EP Deployment Report - ${makeDisplayText(getEnvironment())}`, isHTML:false,
            body:`SYSTEM DEPLOYMENT REPORT\n`
                + '-----------------------\n'
                + `Information Generated (CST): ${formatDate(now, true)}\n\n`

                + `Environment Verification Checks\n`
                + `-------------------------------\n`
                + `${overallCheck ? '✅' : '⚠️'} Overall Check: ${overallCheck ? 'OK' : 'WARNING'}\n`
                + `${environmentCheck ? '✅' : '⚠️'} Environment Check: ${environmentCheck ? 'OK' : 'WARNING'}\n`
                + `${modelSourceCheck ? '✅' : '⚠️'} Model Source Environment Check: ${modelSourceCheck ? 'OK' : 'WARNING'}\n`
                + `${branchCheck ? '✅' : '⚠️'} Branch Check: ${branchCheck ? 'OK' : 'WARNING'}\n`
                + `${lastRestartCheck ? '✅' : '⚠️'} Last Restart Check: ${lastRestartCheck ? 'OK' : 'WARNING'}\n`
                + `${(ec2Check === undefined) ? '➖' : ec2Check ? '✅' : '⚠️'} EC2 Check: ${(ec2Check === undefined) ? 'OK-Local' : ec2Check ? 'OK' : 'WARNING'}\n`

                + '\nConfiguration Settings\n'
                + '----------------------\n'
                + `${(environmentCheck) ? '✅' : '⚠️'} Environment: ${getEnvironment()}\n`
                + `${modelSourceCheck ? '✅' : '⚠️'} Model Source Environment: ${getModelSourceEnvironment()}\n\n`
                + `SERVER_PORT: ${process.env.SERVER_PORT ?? ''}\n`
                + `SERVER_PATH: ${process.env.SERVER_PATH ?? ''}\n`
                + `EMAIL_DOMAIN: ${process.env.EMAIL_DOMAIN ?? ''}\n`
                + `ENVIRONMENT_BASE_URL: ${process.env.ENVIRONMENT_BASE_URL ?? ''}\n`
                + `ASSET_URL: ${process.env.ASSET_URL ?? ''}\n\n`

                //Expected Enabled
                + `${process.env.ENABLE_CRON === 'true' ? '✅' : '⚠️'} ENABLE_CRON: ${process.env.ENABLE_CRON ?? ''}\n`
                + `${process.env.SEND_EMAILS === 'true' ? '✅' : '⚠️'} SEND_EMAILS: ${process.env.SEND_EMAILS ?? ''}\n`
                + `${process.env.SAVE_LOGS_LOCALLY === 'true' ? '✅' : '⚠️'} SAVE_LOGS_LOCALLY: ${process.env.SAVE_LOGS_LOCALLY ?? ''}\n`
                + `${process.env.UPLOAD_LOGS_S3 === 'true' ? '✅' : '⚠️'} UPLOAD_LOGS_S3: ${process.env.UPLOAD_LOGS_S3 ?? ''}\n`
                + `${process.env.SAVE_AUTH_LOGS === 'true' ? '✅' : '⚠️'} SAVE_AUTH_LOGS: ${process.env.SAVE_AUTH_LOGS ?? ''}\n`
                + `${process.env.SAVE_EVENT_LOGS === 'true' ? '✅' : '⚠️'} SAVE_EVENT_LOGS: ${process.env.SAVE_EVENT_LOGS ?? ''}\n`

                //Expected Local Features Disabled in Production
                + `${process.env.PRINT_LOGS_TO_CONSOLE === 'true' ? '⚠️' : '✅'} PRINT_LOGS_TO_CONSOLE: ${process.env.PRINT_LOGS_TO_CONSOLE ?? ''}\n`
                + `${process.env.DEBUG_SEARCH === 'true' ? '⚠️' : '✅'} DEBUG_SEARCH: ${process.env.DEBUG_SEARCH ?? ''}\n\n`

                + '\nDeployment\n'
                + '----------\n'
                + `Version: ${version}\n`
                + `Git Branch: ${gitBranch}\n`
                + `Git Commit: ${gitCommit}\n`
                + `Server Restart Timestamp: ${SERVER_START_TIMESTAMP.toISOString()}\n`
                + `Current Runtime Duration: ${formatDuration(SERVER_START_TIMESTAMP)}\n`

                + `\nLast Restart Timestamp: ${lastRestart.toISOString()}\n`
                + `Last Runtime Duration: ${formatDuration(lastRestart, SERVER_START_TIMESTAMP)}\n`

                + '\nAWS\n'
                + '---\n'
                + `${awsAuthenticated ? '✅' : '⚠️'} Authentication: ${awsAuthenticated ? 'YES' : 'NO'}\n`
                + `${(ec2Check === undefined) ? '➖' : ec2Check ? '✅' : '⚠️'} EC2 Check: ${(ec2Check === undefined) ? 'OK-Local' : ec2Check ? 'OK' : 'WARNING'}\n`
                + (awsMetadata
                    ? `Instance ID: ${awsMetadata.instanceID}\n`
                        + `Instance Type: ${awsMetadata.instanceType}\n`
                        + `Region: ${awsMetadata.awsRegion}\n`
                        + `Availability Zone: ${awsMetadata.availabilityZone}\n`
                        + `Private IP: ${awsMetadata.privateIP}\n`
                        + `Public IP: ${awsMetadata.publicIP}\n`
                        + `Public Hostname: https://${awsMetadata.publicHostname}\n`                       
                    : '')
                + `\n\n== Login to Portal ==\n${process.env.ENVIRONMENT_BASE_URL}/portal/dashboard\n`
        };
    } catch(error) {
        log.error('ERROR Generating Deployment Report:', error);
        return {subject: '', isHTML:false, body:''};
    }
}



/* Local Utilities */
//Attempts to identify userID mention in logs <userID, occurrences>
const getLogImpactedUsers = (logList:LOG_ENTRY[]):Map<number, number> => {
    //Matches userID identifiers: 'user: #', 'userID:#', 'userID, #', 'User = #'
    const userIDRegex:RegExp = new RegExp(/\buser(?:id)?\s*[:=,]?\s*(\d+)\b/, 'gi');
    const impactedUserMap:Map<number, number> = new Map();

    logList.forEach(log => {
        const userIDSet:Set<number> = new Set();
        log.getRegexMatches(userIDRegex).forEach(([userID]) => userIDSet.add(Number(userID)));
        userIDSet.forEach(userID => impactedUserMap.set(userID, (impactedUserMap.get(userID) ?? 0) + (log.duplicateList.length + 1)));
    });

    return new Map(Array.from(impactedUserMap.entries()).sort((a,b) => b[1] - a[1]));
}
