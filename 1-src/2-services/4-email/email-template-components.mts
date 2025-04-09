import LOG_ENTRY from "../10-utilities/logging/logEntryModel.mjs";
import { LogType } from "../../0-assets/field-sync/api-type-sync/utility-types.mjs";
import { makeDisplayText } from "../../0-assets/field-sync/input-config-sync/inputField.mjs";
import { fetchS3LogsByDateRange } from "../10-utilities/logging/log-s3-utilities.mjs";
import { DB_CALCULATE_TABLE_USAGE, DB_CALCULATE_USER_TABLE_STATS } from "../2-database/queries/queries.mjs";



/**************************
* GENERAL BODY COMPONENTS *
***************************/
  
export const htmlActionButton = (label:string, link:string):string =>
    `<p style="text-align: center;">
        <a href="${link}" class="button">${label}</a>
    </p>`;

export const htmlFooter = ():string =>
    `<div class="footer">
        <img class="logo" src="cid:logo.png" alt="Encouraging Prayer Logo" />
        <a href="https://encouragingprayer.org/">Website</a> |
        <a href="mailto:support@encouragingprayer.org">Contact Support</a>
    </div>`;

export const htmlSummaryPairList = (title:string, valueMap:Map<string, string|number>):string => 
    `<div>
        <h3>${title}</h3>
        <table class="summary-table">
        ${Array.from(valueMap.entries()).map(([key, value]) =>
           `<tr>
                <td><strong>${key}</strong></td>
                <td>${value}</td>
            </tr>`).join('\n')}
        </table>
      </div>`;

export const htmlSummaryTable = (title:string, columnLabelList:string[], rowList:(string | number)[][], footerHtml:string[] = []):string => 
    `<div>
        <h3>${title}</h3>
        <table class="summary-table">
        <thead>
            <tr>
            ${columnLabelList.map(label => `<th><strong>${label}</strong></th>`).join('')}
            </tr>
        </thead>
        <tbody>
            ${rowList.map(row => `
                <tr>
                    ${columnLabelList.map((_, colIndex) => {
                        const value = row[colIndex] ?? '&nbsp;'; // Fill empty columns with &nbsp;
                        return `<td>${value}</td>`;
                    }).join('')}
                </tr>
            `).join('')}
        </tbody>
        </table>
        ${footerHtml.join('\n')}
    </div>`;


/***********************************
* CUSTOM IMPLEMENTATION COMPONENTS *
************************************/
export async function htmlDatabaseTableUsage(tableNames:string[]): Promise<string> {
    const rowList:(number|string)[][] = [];
    
    for(const tableName of tableNames) {
        const stats = await DB_CALCULATE_TABLE_USAGE(tableName);
        
        rowList.push([makeDisplayText(tableName),
            stats.totalRows,
            stats.created24Hours,
            stats.totalRows ? (((stats.modified24Hours - stats.created24Hours)/ stats.totalRows) * 100).toFixed(2) + '%' : '0%',
            stats.created7Days,
            stats.totalRows ? (((stats.modified7Days - stats.created7Days) / stats.totalRows) * 100).toFixed(2) + '%' : '0%',
            stats.created30Days, 
            stats.totalRows ? (((stats.modified30Days - stats.created30Days) / stats.totalRows) * 100).toFixed(2) + '%' : '0%'
        ]);
    }
    
    return htmlSummaryTable('Database Table Usage', ['Table', 'Total', '24H', '24H(m)', 'W', 'W(m)', 'M', 'M(m)'], 
        rowList, ['<em>* Note: (m) is the percentage of existing rows modified</em>']);
}
      

export const htmlUserStats = async():Promise<string> => {
    const stats = await DB_CALCULATE_USER_TABLE_STATS();

    return htmlSummaryPairList('User Statistics', new Map<string, string | number>([
        ['Total Users', stats.totalRows],
        ['Active', stats.active],
        ['Active as %', stats.totalRows ? ((stats.active / stats.totalRows) * 100).toFixed(2) + '%' : '0%'],
        ['Reported', stats.reported],
        ['Inactive', stats.inactive],
    ]));
}


export const htmlUserWalkLevelDistribution = async():Promise<string> => {
    const stats = await DB_CALCULATE_USER_TABLE_STATS();

    const valueMap = new Map<string, string|number>();
    stats.walkLevelMap.forEach((count, level) => {
        valueMap.set(`Walk Level ${level}`, count);
    });

    return htmlSummaryPairList('Walk Level Distribution:', valueMap);
};


export const htmlUserRoleDistribution = async():Promise<string> => {
    const stats = await DB_CALCULATE_USER_TABLE_STATS();

    const valueMap = new Map<string, string|number>();
    stats.roleMap.forEach((count, role) => {
        valueMap.set(role.toString(), count); // Convert enum value to string label
    });

    return htmlSummaryPairList('User Role Distribution:', valueMap);
};


//TODO remove #70 days from testing

export const htmlLogList = async (type:LogType, maxEntries:number):Promise<string> => {
    const logList:LOG_ENTRY[] = await fetchS3LogsByDateRange(type, (new Date().getTime() - (70 * 24 * 60 * 60 * 1000)), new Date().getTime()); 

    const count:number = logList.length > 0 ? logList.reduce((sum, entry) => sum + (entry.duplicateList.length + 1), 0) : 0;
    const hoursAgo: number = logList.length > 0 ? (new Date().getTime() - logList[logList.length - 1].date.getTime()) / (1000 * 60 * 60) : 24;

    return `<h4>${makeDisplayText(type)} Log Latest:<span style="font-weight: normal; font-style: normal;">[${count} in last ${Math.ceil(hoursAgo)}H]</span></h4>
        ${logList.slice(0, maxEntries).map((entry: LOG_ENTRY) =>
            `<div class="log-entry">
                ${entry.toString()}
                ${entry.fileKey ? `<a href="${entry.fileKey}">See Full Entry</a>` : ''}
            </div>`
        ).join('\n')}
    `;
}
    
