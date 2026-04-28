import { NewPartnerListItem } from '../../../0-assets/field-sync/api-type-sync/profile-types.mjs';
import { DatabasePartnershipStats } from '../../../0-assets/field-sync/api-type-sync/utility-types.mjs';
import { makeDisplayText } from '../../../0-assets/field-sync/input-config-sync/inputField.mjs';
import { WebsiteSubscription } from '../../../1-api/2-auth/auth-types.mjs';
import { getEnv, getEnvironment, getModelSourceEnvironment } from '../../10-utilities/utilities.mjs';
import { DATABASE_TABLE } from '../../2-database/database-types.mjs';
import { DB_CALCULATE_PARTNERSHIP_STATS, DB_SELECT_UNASSIGNED_PARTNER_USER_LIST, DB_SELECT_PENDING_PARTNER_PAIR_LIST } from '../../2-database/queries/partner-queries.mjs';
import { DB_SELECT_EMAIL_SUBSCRIPTION_RECENT } from '../../2-database/queries/queries.mjs';
import { htmlHeader, htmlSection, htmlVerticalSpace, htmlActionButton, htmlSummaryList, htmlDetailList, htmlFooter } from '../components/email-template-components.mjs';
import { htmlNewPartnerProfileTable, htmlPartnershipBlock } from '../components/email-template-items.mjs';
import { renderDatabaseTableUsage, htmlUserStats, htmlUserRoleDistribution, htmlUserWalkLevelDistribution } from '../components/email-template-renders.mjs';
import { htmlSummaryPairList } from '../components/email-template-table.mjs';
import { applyTemplate, EMAIL_TEMPLATE_TYPE, EMAIL_REPLACEMENT } from '../email-template-manager.mjs';
import { EmailReportContent, EMAIL_COLOR } from '../email-types.mjs';
import { formatDate } from '../email-utilities.mjs';
import { htmlActiveModerationList } from './email-moderation.mjs';




/********************************
 * USER PLATFORM STATUS REPORTS *
 ********************************/
export const assembleUserReportHTML = async():Promise<EmailReportContent> => {
    const subscriptionList:WebsiteSubscription[] = await DB_SELECT_EMAIL_SUBSCRIPTION_RECENT(90);
    const partnershipStats:DatabasePartnershipStats = await DB_CALCULATE_PARTNERSHIP_STATS();

    const activeModeration:{total:number, htmlList:string[], text:string} = await htmlActiveModerationList('TITLE');

    const formatPercent = (value:number, total:number):string => `${Math.round(total > 0 ? (value / total) * 100 : 0)}%`;

    return {subject: 'EP User Status Report', isHTML:true,
        body: await applyTemplate({type: EMAIL_TEMPLATE_TYPE.TABLE_ROWS,
            replacementMap: new Map([[EMAIL_REPLACEMENT.EMAIL_SUBJECT, 'EP User Status Report']]),
            bodyList: [
                htmlHeader(),
                htmlSection('User Status Report', 'left', EMAIL_COLOR.ACCENT),
                htmlVerticalSpace(30),
                await renderDatabaseTableUsage([DATABASE_TABLE.USER], true),
                await htmlUserStats(),
                await htmlUserWalkLevelDistribution(),

                htmlSection('Prayer Request Trends:', 'left', EMAIL_COLOR.ACCENT),
                await renderDatabaseTableUsage([DATABASE_TABLE.PRAYER_REQUEST, DATABASE_TABLE.PRAYER_REQUEST_COMMENT], true, 'Prayer Request Trends'),

                htmlSection('Partnerships', 'left', EMAIL_COLOR.ACCENT),
                await renderDatabaseTableUsage([DATABASE_TABLE.PARTNER], true),
                htmlSummaryPairList('Insights',
                    new Map<string, string | number>([
                        ['Users in Partnerships:', `${formatPercent(partnershipStats.usersInPartnerships, partnershipStats.totalUsers)} (${partnershipStats.usersInPartnerships})`],
                        ['Unmatched Users:', `${formatPercent(partnershipStats.unassignedPartners, partnershipStats.totalUsers)} (${partnershipStats.unassignedPartners})`],
                        ['Pending Partnerships:', `${formatPercent(partnershipStats.pendingPartnerships, partnershipStats.partnerships + partnershipStats.pendingPartnerships)} (${partnershipStats.pendingPartnerships})`],
                        ['Partnerships Accepted last week:', partnershipStats.acceptedLastWeek],
                        ['New User Average Time Waiting to be Matched:', `${Number(partnershipStats.newUserAverageWaitTimeHours).toFixed(1)} Hours`],
                    ])
                ),

                htmlActionButton([{label:'Portal Management', link:`${getEnv('ENVIRONMENT_BASE_URL')}/portal/dashboard`, style:'PRIMARY'}]),

                ...(activeModeration.total ? [
                    htmlSection(`Under Active Moderation: (${activeModeration.total})`, 'left', EMAIL_COLOR.ACCENT),
                    ...activeModeration.htmlList] 
                    : []),

                ...(subscriptionList.length ? [
                    htmlSection('Website Subscriptions:', 'left', EMAIL_COLOR.ACCENT),
                    await renderDatabaseTableUsage([DATABASE_TABLE.SUBSCRIPTION], true),
                    htmlSummaryList(subscriptionList.map(sub => [
                        formatDate(sub.createdDT),
                        [sub.email, sub.role, sub.note].filter(Boolean).join(' | ')
                    ]))] 
                    : []),

                htmlDetailList([
                    ['Information Generated (CST):', formatDate(new Date(), true)],
                    ['Environment:', makeDisplayText(getEnvironment())],
                    ['User Source Environment:', makeDisplayText(getModelSourceEnvironment())],
                ], 'Environment Details:'),
                htmlFooter(),
            ],
            verticalSpacing: 5
        })};
}


export const assemblePartnerReportHTML = async():Promise<EmailReportContent> => {
    const unassignedProfileList:NewPartnerListItem[] = await DB_SELECT_UNASSIGNED_PARTNER_USER_LIST(30);
    const pendingPartnershipList:[NewPartnerListItem, NewPartnerListItem][] = await DB_SELECT_PENDING_PARTNER_PAIR_LIST(15);

    const partnershipStats:DatabasePartnershipStats = await DB_CALCULATE_PARTNERSHIP_STATS();

    const formatPercent = (value:number, total:number):string => `${Math.round(total > 0 ? (value / total) * 100 : 0)}%`;

    return {
        subject: 'EP Partnership Status Report',
        isHTML: true,
        body: await applyTemplate({
            type: EMAIL_TEMPLATE_TYPE.TABLE_ROWS,
            replacementMap: new Map([
                [EMAIL_REPLACEMENT.EMAIL_SUBJECT, 'EP Partnership Status Report'],
            ]),
            bodyList: [
                htmlHeader(),
                htmlSection('Partnership Status Report', 'left', EMAIL_COLOR.ACCENT),
                htmlVerticalSpace(30),

                htmlSummaryPairList(
                    'Summary',
                    new Map<string, string | number>([
                        ['Total Active Partnerships:', partnershipStats.partnerships],
                        ['Users in Partnerships:', `${formatPercent(partnershipStats.usersInPartnerships, partnershipStats.totalUsers)} (${partnershipStats.usersInPartnerships})`],
                        ['Pending Partnerships:', `${formatPercent(partnershipStats.pendingPartnerships, partnershipStats.partnerships + partnershipStats.pendingPartnerships)} (${partnershipStats.pendingPartnerships})`],
                        ['Partnerships Accepted last week:', partnershipStats.acceptedLastWeek],
                        ['Partnerships Accepted last month:', partnershipStats.acceptedLastMonth],
                        ['', ''],
                        ['Unmatched Users:', `${formatPercent(partnershipStats.unassignedPartners, partnershipStats.totalUsers)} (${partnershipStats.unassignedPartners})`],
                        ['New User Average Time Waiting to be Matched:', `${Number(partnershipStats.newUserAverageWaitTimeHours).toFixed(1)} Hours`],
                        ['Waited More than 24 Hours:', partnershipStats.wait24Hours],
                        ['Waited More than 7 Days:', partnershipStats.wait7Days],
                    ])
                ),

                htmlSummaryList([
                    ['Gender Match Required:', partnershipStats.matchGender ? 'Yes' : 'No'],
                    ['Allowed Age Range:', `±${partnershipStats.ageYearRange} years`],
                    ['Allowed Walk Level Range:', `±${partnershipStats.walkLevelRange}`],
                ], 'Matching Criteria:'),

                await renderDatabaseTableUsage([DATABASE_TABLE.PARTNER], true),

                htmlSection('Unmatched Users'),
                htmlNewPartnerProfileTable(unassignedProfileList, true),

                htmlSection('Pending Partnerships'),
                htmlPartnershipBlock(
                    pendingPartnershipList.map((partnerPair) => ({ profile: partnerPair[0], partner: partnerPair[1] })), undefined, true ),

                htmlActionButton([{label:'Partnership Management', link:`${getEnv('ENVIRONMENT_BASE_URL')}/portal/partnership/pending`, style:'PRIMARY'}]),

                htmlDetailList([
                    ['Information Generated (CST):', formatDate(new Date(), true)],
                    ['Environment:', makeDisplayText(getEnvironment())],
                    ['User Source Environment:', makeDisplayText(getModelSourceEnvironment())],
                ], 'Environment Details:'),

                htmlFooter(),
            ],
            verticalSpacing: 5,
        }),
    };
}
