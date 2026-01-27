import { LogType } from "../../../0-assets/field-sync/api-type-sync/utility-types.mjs";
import { makeDisplayText } from "../../../0-assets/field-sync/input-config-sync/inputField.mjs";
import { RoleEnum } from "../../../0-assets/field-sync/input-config-sync/profile-field-config.mjs";
import { fetchS3LogsByDateRange } from "../../10-utilities/logging/log-s3-utilities.mjs";
import LOG_ENTRY from "../../10-utilities/logging/logEntryModel.mjs";
import { DATABASE_TABLE, DATABASE_USER_ROLE_ENUM } from "../../2-database/database-types.mjs";
import { DB_CALCULATE_TABLE_USAGE, DB_CALCULATE_USER_TABLE_STATS } from "../../2-database/queries/queries.mjs";
import { EMAIL_FONT_FAMILY, EMAIL_FONT_SIZE, EMAIL_COLOR } from "../email-types.mjs";
import { htmlTitle } from "./email-template-components.mjs";
import { htmlSummaryPairList, htmlSummaryTable, renderLabeledRowTable } from "./email-template-table.mjs";



/***********************************
* CUSTOM IMPLEMENTATION COMPONENTS *
************************************/
export const renderDatabaseTableUsage = async(tableNames:DATABASE_TABLE[], html:boolean = true, title:string = 'Database Table Usage'):Promise<string> =>{
    const rowList:(number|string)[][] = [];
    
    for(const tableName of tableNames) {
        const stats = await DB_CALCULATE_TABLE_USAGE(tableName);
        const existing24 = Math.max(0, stats.totalRows - stats.created24Hours);
        const existing7  = Math.max(0, stats.totalRows - stats.created7Days);
        const existing30 = Math.max(0, stats.totalRows - stats.created30Days);
        
        rowList.push([makeDisplayText(tableName),
            stats.totalRows,
            stats.created24Hours,
            (existing24 > 0) ? ((stats.modified24Hours / existing24) * 100).toFixed(2) + '%' : '0%',
            stats.created7Days,
            (existing7 > 0) ? ((stats.modified7Days / existing7) * 100).toFixed(2) + '%' : '0%',
            stats.created30Days, 
            (existing30 > 0) ? ((stats.modified30Days / existing30) * 100).toFixed(2) + '%' : '0%'
        ]);
    }
    
    return html ? htmlSummaryTable(title, ['Table', 'Total', '24H', '24H(m)', 'W', 'W(m)', 'M', 'M(m)'], 
                                    rowList, [['* New Growth:', 'These are new row entries in the last 24 hours, past week, and month.'],
                                              ['* Continual Usage:', '(m) notation is the percentage of existing rows modified']])

        : renderLabeledRowTable(title, ['Table', 'Total', '24H', '24H(m)', 'W', 'W(m)', 'M', 'M(m)'], 
                            rowList, ['* New Growth: These are new row entries in the last 24 hours, week, and month.',
                                      '* Continual Usage: (m) notation is the percentage of existing rows modified']);
}
      

export const htmlUserStats = async():Promise<string> => {
    const stats = await DB_CALCULATE_USER_TABLE_STATS();

    return htmlSummaryPairList('User Statistics', new Map<string, string | number>([
        ['Total Users', stats.totalRows],
        ['Active', stats.emailVerified],
        ['Active as %', (stats.totalRows > 0) ? ((stats.emailVerified / stats.totalRows) * 100).toFixed(2) + '%' : '0%'],
        ['Users', stats.roleMap[RoleEnum.USER]],
        ['Users (Unassigned)', stats.unassignedUsers],
        ['Demo Users', stats.roleMap[RoleEnum.DEMO_USER]],
        ['Test Users', stats.roleMap[RoleEnum.TEST_USER]],
        ['Circle Leaders', stats.roleMap[RoleEnum.CIRCLE_LEADER]],
        ['Circle Managers', stats.roleMap[RoleEnum.CIRCLE_MANAGER]],
        ['Inactive', stats.roleMap[RoleEnum.INACTIVE]],
        ['*Reported*', stats.roleMap[RoleEnum.REPORTED]],
    ]));
}


export const htmlUserWalkLevelDistribution = async():Promise<string> => {
    const stats = await DB_CALCULATE_USER_TABLE_STATS();

    const valueMap = new Map<string, string|number>();
    Object.entries(stats.walkLevelMap).forEach(([level, count]) => {
        valueMap.set(`Walk Level ${level}`, count);
    });

    return htmlSummaryPairList('Walk Level Distribution:', valueMap);
};


export const htmlUserRoleDistribution = async():Promise<string> => {
    const stats = await DB_CALCULATE_USER_TABLE_STATS();

    const valueMap = new Map<string, string|number>();
    Object.entries(stats.roleMap).forEach(([role, count]) =>{
        valueMap.set(role.toString(), count); // Convert enum value to string label
    });

    return htmlSummaryPairList('User Role Distribution:', valueMap);
};


export const renderLogList = async (type:LogType, maxEntries:number, html:boolean = true):Promise<string> => {
    const timestamp:number = new Date().getTime();
    const logList:LOG_ENTRY[] = await fetchS3LogsByDateRange(type, (timestamp - (24 * 60 * 60 * 1000)), timestamp); 

    const count:number = logList.length > 0 ? logList.reduce((sum, entry) => sum + (entry.duplicateList.length + 1), 0) : 0;
    const hoursAgo: number = logList.length > 0 ? (timestamp - logList[logList.length - 1].date.getTime()) / (1000 * 60 * 60) : 24;

    return html
        ? `<div style="width:100%; text-align:left;">
               ${htmlTitle(`${makeDisplayText(type)} Log Latest:`)}
               <span style="font-family:${EMAIL_FONT_FAMILY.TEXT}; font-size:${EMAIL_FONT_SIZE.TEXT}; color:${EMAIL_COLOR.GRAY_DARK}; font-weight:normal;">[${count} in last ${Math.ceil(hoursAgo)}H]</span>
               ${logList.slice(0, maxEntries).map(entry => `
                   <div style="margin-top:6px; font-family:${EMAIL_FONT_FAMILY.DETAIL}; font-size:${EMAIL_FONT_SIZE.DETAIL}; color:${EMAIL_COLOR.GRAY_DARK}; line-height:${EMAIL_FONT_SIZE.DETAIL};">
                       ${entry.toString()}
                       ${entry.fileKey ? ` <a href="${entry.fileKey}" style="color:${EMAIL_COLOR.BLUE}; text-decoration:none;">See Full Entry</a>` : ''}
                    </div>`
               ).join('\n')}
            </div>`

        :   '='.repeat(5) + ` ${makeDisplayText(type)} Log Latest: [${count} in last ${Math.ceil(hoursAgo)}H] ` + '='.repeat(5) + '\n\n'
            + logList.slice(0, maxEntries).map(entry =>
                `${entry.toString()}${entry.fileKey ? `\nLink: ${entry.fileKey}` : ''}`
            ).join('\n\n');
}
