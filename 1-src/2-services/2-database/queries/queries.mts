import { CommandResponseType, DATABASE_USER_ROLE_ENUM, DatabaseTableUsage, DatabaseUserStats, TABLES_SUPPORTING_DT } from '../database-types.mjs';
import { command, execute, query, validateColumns } from '../database.mjs';
import * as log from '../../10-utilities/logging/log.mjs';



/*****************************
*  GENERAL DATABASE QUERIES
* TABLES: subscription
******************************/
 
export const DB_CALCULATE_TABLE_USAGE = async (tableName: string):Promise<DatabaseTableUsage> => {
    const supportedDTs = TABLES_SUPPORTING_DT.get(tableName);
  
    const [row] = supportedDTs ? [undefined] 
        : await query('SELECT '
            + 'COUNT(*) AS totalRows'
            + (supportedDTs.includes('createdDT') ? 
                + ', SUM(CASE WHEN createdDT >= NOW() - INTERVAL 1 DAY THEN 1 ELSE 0 END) AS created24Hours'
                + ', SUM(CASE WHEN createdDT >= NOW() - INTERVAL 7 DAY THEN 1 ELSE 0 END) AS created7Days'
                + ', SUM(CASE WHEN createdDT >= NOW() - INTERVAL 30 DAY THEN 1 ELSE 0 END) AS created30Days'
                : '')
            + (supportedDTs.includes('modifiedDT') ? 
                + ', SUM(CASE WHEN modifiedDT >= NOW() - INTERVAL 1 DAY THEN 1 ELSE 0 END) AS modified24Hours'
                + ', SUM(CASE WHEN modifiedDT >= NOW() - INTERVAL 7 DAY THEN 1 ELSE 0 END) AS modified7Days'
                + ', SUM(CASE WHEN modifiedDT >= NOW() - INTERVAL 30 DAY THEN 1 ELSE 0 END) AS modified30Days'
                : '')
            + ` FROM ${tableName};`);

    //TODO REmove after testing
    return {
        totalRows: Math.floor(Math.random() * 1000),
        created24Hours: Math.floor(Math.random() * 100),
        created7Days: Math.floor(Math.random() * 200),
        created30Days: Math.floor(Math.random() * 500),
        modified24Hours: Math.floor(Math.random() * 10),
        modified7Days: Math.floor(Math.random() * 50),
        modified30Days: Math.floor(Math.random() * 100),
      };
      
  
    // return {
    //   totalRows: row?.totalRows ?? 0,
    //   created24Hours: row?.created24Hours ?? 0,
    //   created7Days: row?.created7Days ?? 0,
    //   created30Days: row?.created30Days ?? 0,
    //   modified24Hours: row?.modified24Hours ?? 0,
    //   modified7Days: row?.modified7Days ?? 0,
    //   modified30Days: row?.modified30Days ?? 0,
    // };
}

export const DB_CALCULATE_USER_TABLE_STATS = async(): Promise<DatabaseUserStats> => {
    const [row] = await query('SELECT '
        + 'COUNT(*) AS totalRows, '
        + 'SUM(CASE WHEN createdDT >= NOW() - INTERVAL 1 DAY THEN 1 ELSE 0 END) AS created24Hours, '
        + 'SUM(CASE WHEN createdDT >= NOW() - INTERVAL 7 DAY THEN 1 ELSE 0 END) AS created7Days, '
        + 'SUM(CASE WHEN createdDT >= NOW() - INTERVAL 30 DAY THEN 1 ELSE 0 END) AS created30Days, '
        + 'SUM(CASE WHEN modifiedDT >= NOW() - INTERVAL 1 DAY THEN 1 ELSE 0 END) AS modified24Hours, '
        + 'SUM(CASE WHEN modifiedDT >= NOW() - INTERVAL 7 DAY THEN 1 ELSE 0 END) AS modified7Days, '
        + 'SUM(CASE WHEN modifiedDT >= NOW() - INTERVAL 30 DAY THEN 1 ELSE 0 END) AS modified30Days, '
        
        + 'SUM(isActive = 1) AS active, '
        // + 'SUM(verifiedDT IS NOT NULL) AS verified, '
        + [1,2,3,4,5,6,7,8,9,10].map((level) => `SUM(walkLevel = ${level}) AS 'walkLevel_${level}'`).join(', \n') 
        + ', '

        + Object.values(DATABASE_USER_ROLE_ENUM).map((role) => `
            (SELECT COUNT(*) 
                FROM user_role ur 
                JOIN user_role_defined urd ON ur.userRoleID = urd.userRoleID 
                WHERE urd.userRole = '${role}') AS ${role}
            `).join(', \n')

        + `FROM user;`); 
    
    return {
        totalRows: row?.totalRows ?? 0,
        created24Hours: row?.created24Hours ?? 0,
        created7Days: row?.created7Days ?? 0,
        created30Days: row?.created30Days ?? 0,
        modified24Hours: row?.modified24Hours ?? 0,
        modified7Days: row?.modified7Days ?? 0,
        modified30Days: row?.modified30Days ?? 0,
        active: row?.active ?? 0,
        // verified: row.verified,
        walkLevelMap: new Map(
            [1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map(level => [
                level, row ? (row[`walkLevel_${level}`] ?? 0) : 0
            ])
        ),
        reported: row?.reported ?? 0,
        inactive: row?.inactive ?? 0,
        roleMap: new Map(Object.values(DATABASE_USER_ROLE_ENUM).map(role => [
            role, row ? (row[role] ?? 0) : 0
        ])),
    };
};



export const DB_INSERT_EMAIL_SUBSCRIPTION = async(email:string, role?:string, note?:string):Promise<boolean> => {
    const response:CommandResponseType = await command('INSERT INTO subscription (email, role, note) '
    + 'VALUES (?, ?, ?) '
    + 'ON DUPLICATE KEY UPDATE role = VALUES(role), note = VALUES(note);'
    , [email, role || null, note || null]);

    return ((response !== undefined) && (response.affectedRows > 0));
}
