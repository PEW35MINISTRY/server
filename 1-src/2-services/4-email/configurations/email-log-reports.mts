import { EmailSubscription, LogType, LogDailyTrend, DatabaseTableUsage } from '../../../0-assets/field-sync/api-type-sync/utility-types.mjs';
import { makeDisplayText } from '../../../0-assets/field-sync/input-config-sync/inputField.mjs';
import { fetchS3LogsByDateRange, calculateLogDailyTrends } from '../../10-utilities/logging/log-s3-utilities.mjs';
import { LOG_BURST_EVENT_THRESHOLD } from '../../10-utilities/logging/log-types.mjs';
import LOG_ENTRY from '../../10-utilities/logging/logEntryModel.mjs';
import { getEnvironment } from '../../10-utilities/utilities.mjs';
import { DATABASE_TABLE } from '../../2-database/database-types.mjs';
import { DB_CALCULATE_TABLE_USAGE } from '../../2-database/queries/queries.mjs';
import { htmlText, htmlVerticalSpace, htmlActionButton, htmlSection, htmlDetailList } from '../components/email-template-components.mjs';
import { renderLogList, renderDatabaseTableUsage, renderLogTrendTable } from '../components/email-template-renders.mjs';
import { EmailReportContent } from '../email-types.mjs';



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
    const routeActionRegex:RegExp = new RegExp(/^action:\s*(.+\s*->\s*.+)$/, 'i');
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
        body: `${nowDayOfWeek}'s ${makeDisplayText(type)} Report\n`
            + `Environment: ${makeDisplayText(getEnvironment())}\n`
            + `Range: ${new Date(startTimestamp).toLocaleString('en-US', { timeZone:'America/Chicago' })} - ${new Date(nowTimestamp).toLocaleString('en-US', { timeZone:'America/Chicago' })}\n`
            + '\n\n'
            + `Unique ${makeDisplayText(type)}s: ${logList.length}\n`
            + `Total Occurrences: ${totalToday}\n`
            + `Duplicates: ${totalToday > 0 ? ((((totalToday - logList.length) / totalToday) * 100).toFixed(2)) : '0.00'}% (${totalToday - logList.length})\n`
            + '\n\n'
            + ((dailyTrends.length >= 8)
                    ? `${dailyTrends[0].total >= dailyTrends[1].total ? 'Increase' : 'Decrease'} compared to Yesterday: ${dailyTrends[1].total > 0 ? `${Math.round((Math.abs(dailyTrends[0].total - dailyTrends[1].total) / dailyTrends[1].total) * 100)}%` : `${dailyTrends[0].total - dailyTrends[1].total}`} (${dailyTrends[0].total} vs ${dailyTrends[1].total})\n`
                    + `${dailyTrends[0].total >= weeklyAverage ? 'Increase' : 'Decrease'} compared to Weekly Average: ${weeklyAverage > 0 ? `${Math.round((Math.abs(dailyTrends[0].total - weeklyAverage) / weeklyAverage) * 100)}%` : `${dailyTrends[0].total - weeklyAverage}`} (${dailyTrends[0].total} vs ${Math.round(weeklyAverage)})\n`
                    + `${dailyTrends[0].total >= dailyTrends[7].total ? 'Increase' : 'Decrease'} compared to last ${nowDayOfWeek}: ${dailyTrends[7].total > 0 ? `${Math.round((Math.abs(dailyTrends[0].total - dailyTrends[7].total) / dailyTrends[7].total) * 100)}%` : `${dailyTrends[0].total - dailyTrends[7].total}`} (${dailyTrends[0].total} vs ${dailyTrends[7].total})\n`
                    + '\n\n'
                : '')
            + ((affectedRouteMap.size > 0)
                    ? `Most Affected Routes\n`
                    + `--------------------\n`
                    + `${Array.from(affectedRouteMap.entries()).sort((a,b) => b[1] - a[1]).slice(0, 5).map(([route, count]) => `(${count}) ${route}`).join('\n')}\n`
                    + '\n\n'
                : '')
            + ((impactedUserMap.size > 0)
                    ? `Most Impacted Users\n`
                    + `-------------------\n`
                    + `${Array.from(impactedUserMap.entries()).sort((a,b) => b[1] - a[1]).slice(0, 10).map(([userID, count]) => `(${count}) User #${userID}: ${process.env.ENVIRONMENT_BASE_URL}/portal/edit/profile/${userID}`).join('\n')}\n`
                    + '\n\n'
                : '')
            + ((burstEvents.length > 0)
                    ? `Identified Burst Events\n`
                    + `-----------------------\n`
                    + `${burstEvents.map(item => `(${item.quantity}) ${LOG_ENTRY.summarize(item.entry, undefined, 100)}`).join('\n')}\n`
                    + '\n\n'
                : '')
            + '\n\n'
            + `== See Latest ${makeDisplayText(type)} Logs ==\n${process.env.ENVIRONMENT_BASE_URL}/portal/logs/${type}`
            + '\n\n'
            + await renderLogList(type, { maxEntries:100, pastDays:2, html:false })
        };
}


export const assembleWeeklySystemReport = async():Promise<EmailReportContent> => {
    const errorDailyTrends:LogDailyTrend[] = await calculateLogDailyTrends(LogType.ERROR, 17);
    const warnDailyTrends:LogDailyTrend[] = await calculateLogDailyTrends(LogType.WARN, 17);
    const userStats:DatabaseTableUsage = await DB_CALCULATE_TABLE_USAGE(DATABASE_TABLE.USER);

    const emailLogs:LOG_ENTRY[] = await fetchS3LogsByDateRange(LogType.EMAIL, Date.now() - (7 * 24 * 60 * 60 * 1000), Date.now(), 1000, false);
    const emailFailCount:number = emailLogs.reduce((sum:number, log:LOG_ENTRY) => sum + (log.messages[0]?.includes('FAIL') ? 1 : 0), 0);
    const emailSuccessRate:number = emailLogs.length > 0 ? Math.round(((emailLogs.length - emailFailCount) / emailLogs.length) * 100) : 0;

    const currentWeekErrorTotal:number = errorDailyTrends.slice(0, 7).reduce((sum:number, trend:LogDailyTrend) => sum + trend.total, 0);
    const previousWeekErrorTotal:number = errorDailyTrends.slice(7, 14).reduce((sum:number, trend:LogDailyTrend) => sum + trend.total, 0);

    const currentWeekWarnTotal:number = warnDailyTrends.slice(0, 7).reduce((sum:number, trend:LogDailyTrend) => sum + trend.total, 0);
    const previousWeekWarnTotal:number = warnDailyTrends.slice(7, 14).reduce((sum:number, trend:LogDailyTrend) => sum + trend.total, 0);

    const previousUserTotal:number = Math.max(userStats.totalRows - userStats.created7Days, 0);
    const expectedWeeklyUsers:number = Math.round((userStats.created30Days / 30) * 7);

    return {subject: `EP Server Status System Report - ${makeDisplayText(getEnvironment())}`, isHTML:false,
        body: `SERVER STATUS SYSTEM REPORT\n`
            + `Date: ${new Date().toISOString()}\n`
            + `Environment: ${getEnvironment()}`
            + '\n\n'
            + `Weekly Summary\n`
            + `--------------\n`
            + `${currentWeekErrorTotal >= previousWeekErrorTotal ? 'Increase' : 'Decrease'} Errors: ${previousWeekErrorTotal > 0 ? Math.round((Math.abs(currentWeekErrorTotal - previousWeekErrorTotal) / previousWeekErrorTotal) * 100) : (currentWeekErrorTotal > 0 ? 100 : 0)}% (${currentWeekErrorTotal} vs ${previousWeekErrorTotal})\n`
            + `${currentWeekWarnTotal >= previousWeekWarnTotal ? 'Increase' : 'Decrease'} Warnings: ${previousWeekWarnTotal > 0 ? Math.round((Math.abs(currentWeekWarnTotal - previousWeekWarnTotal) / previousWeekWarnTotal) * 100) : (currentWeekWarnTotal > 0 ? 100 : 0)}% (${currentWeekWarnTotal} vs ${previousWeekWarnTotal})\n`
            + `Email Success Rate: ${emailSuccessRate}% (${emailLogs.length - emailFailCount} success, ${emailFailCount} fail)\n`
            + '\n'
            + `New User Growth: ${previousUserTotal > 0 ? Math.round((userStats.created7Days / previousUserTotal) * 100) : 0}% (${userStats.created7Days} new)\n`
            + `New Users vs 30-day Average: ${userStats.created7Days >= expectedWeeklyUsers ? 'increase' : 'decrease'} ${expectedWeeklyUsers > 0 ? Math.round((Math.abs(userStats.created7Days - expectedWeeklyUsers) / expectedWeeklyUsers) * 100) : (userStats.created7Days > 0 ? 100 : 0)}% (${userStats.created7Days} vs ${expectedWeeklyUsers} expected)\n`
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


/* Local Utilities */
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
