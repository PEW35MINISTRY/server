import { CommandResponseType, DATABASE_TABLE, DATABASE_USER_ROLE_ENUM, TABLES_SUPPORTING_DT } from '../database-types.mjs';
import { DatabaseTableUsage, DatabaseUserStats } from '../../../0-assets/field-sync/api-type-sync/utility-types.mjs';
import { command, execute, query, validateColumns } from '../database.mjs';
import * as log from '../../10-utilities/logging/log.mjs';
import { WebsiteSubscription } from '../../../1-api/2-auth/auth-types.mjs';
import { RoleEnum } from '../../../0-assets/field-sync/input-config-sync/profile-field-config.mjs';



/*****************************
*  GENERAL DATABASE QUERIES
* TABLES: subscription
******************************/
 
export const DB_CALCULATE_TABLE_USAGE = async(tableName:DATABASE_TABLE):Promise<DatabaseTableUsage> => {
    const supportedDTs = TABLES_SUPPORTING_DT.get(tableName);

    if(!supportedDTs)
        log.warn('DB_CALCULATE_TABLE_USAGE', 'Table does not support DT fields:', tableName);
  
    const [row] = !supportedDTs ? [undefined] 
        : await query('SELECT '
            + 'COUNT(*) AS totalRows'
            + (supportedDTs.includes('createdDT') ? 
                  ', SUM(CASE WHEN createdDT >= NOW() - INTERVAL 1 DAY THEN 1 ELSE 0 END) AS created24Hours'
                + ', SUM(CASE WHEN createdDT >= NOW() - INTERVAL 7 DAY THEN 1 ELSE 0 END) AS created7Days'
                + ', SUM(CASE WHEN createdDT >= NOW() - INTERVAL 30 DAY THEN 1 ELSE 0 END) AS created30Days'
                : '')
            + (supportedDTs.includes('modifiedDT') ? 
                  ', SUM(CASE WHEN modifiedDT >= NOW() - INTERVAL 1 DAY THEN 1 ELSE 0 END) AS modified24Hours'
                + ', SUM(CASE WHEN modifiedDT >= NOW() - INTERVAL 7 DAY THEN 1 ELSE 0 END) AS modified7Days'
                + ', SUM(CASE WHEN modifiedDT >= NOW() - INTERVAL 30 DAY THEN 1 ELSE 0 END) AS modified30Days'
                : '')
            + ` FROM ${tableName};`);   

    if(row && (row.created30Days === 0) && (row.modified30Days === 0))
        log.warn('DB_CALCULATE_TABLE_USAGE', 'Table supports DT fields but returned all zeros', tableName, row);
  
    return {
      totalRows: row?.totalRows ?? 0,
      created24Hours: row?.created24Hours ?? 0,
      created7Days: row?.created7Days ?? 0,
      created30Days: row?.created30Days ?? 0,
      modified24Hours: row?.modified24Hours ?? 0,
      modified7Days: row?.modified7Days ?? 0,
      modified30Days: row?.modified30Days ?? 0,
    };
}

export const DB_CALCULATE_USER_TABLE_STATS = async():Promise<DatabaseUserStats> => {
    const [row] = await query('SELECT '
        + 'COUNT(*) AS totalRows, '
        + 'SUM(CASE WHEN createdDT >= NOW() - INTERVAL 1 DAY THEN 1 ELSE 0 END) AS created24Hours, '
        + 'SUM(CASE WHEN createdDT >= NOW() - INTERVAL 7 DAY THEN 1 ELSE 0 END) AS created7Days, '
        + 'SUM(CASE WHEN createdDT >= NOW() - INTERVAL 30 DAY THEN 1 ELSE 0 END) AS created30Days, '
        + 'SUM(CASE WHEN modifiedDT >= NOW() - INTERVAL 1 DAY THEN 1 ELSE 0 END) AS modified24Hours, '
        + 'SUM(CASE WHEN modifiedDT >= NOW() - INTERVAL 7 DAY THEN 1 ELSE 0 END) AS modified7Days, '
        + 'SUM(CASE WHEN modifiedDT >= NOW() - INTERVAL 30 DAY THEN 1 ELSE 0 END) AS modified30Days, '
        
        + 'SUM(emailVerified = 1) AS emailVerified, '
        + [1,2,3,4,5,6,7,8,9,10].map((level) => `SUM(walkLevel = ${level}) AS 'walkLevel_${level}'`).join(', \n') 
        + ', '

        + Object.values(DATABASE_USER_ROLE_ENUM).map((role) =>
            `(SELECT COUNT(*) 
                FROM user_role 
                JOIN user_role_defined ON user_role.userRoleID = user_role_defined.userRoleID 
                WHERE user_role_defined.userRole = '${role}') AS ${role}`
            ).join(', \n')

        + `, (SELECT COUNT(*) 
                FROM user 
                LEFT JOIN user_role ON user.userID = user_role.userID 
                WHERE user_role.userID IS NULL) AS NO_ROLE `

        + `FROM user;`); 
    
    return {
        totalRows: row?.totalRows ?? 0,
        created24Hours: row?.created24Hours ?? 0,
        created7Days: row?.created7Days ?? 0,
        created30Days: row?.created30Days ?? 0,
        modified24Hours: row?.modified24Hours ?? 0,
        modified7Days: row?.modified7Days ?? 0,
        modified30Days: row?.modified30Days ?? 0,
        emailVerified: row?.emailVerified ?? 0,
        walkLevelMap: Object.fromEntries(
            [1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map(level => [
                level, row ? (row[`walkLevel_${level}`] ?? 0) : 0
            ])
        ),
        roleMap: Object.fromEntries(Object.values(RoleEnum).map(role => [
            role, row ? (row[role] ?? 0) : 0
        ])) as Record<RoleEnum, number>,
        unassignedUsers: row?.NO_ROLE ?? 0,
    };
};


/*******************************
 * WEBSITE EMAIL SUBSCRIPTIONS *
 *******************************/
export const DB_INSERT_EMAIL_SUBSCRIPTION = async(email:string, role?:string, note?:string):Promise<boolean> => {
    const response:CommandResponseType = await command('INSERT INTO subscription (email, role, note) '
    + 'VALUES (?, ?, ?) '
    + 'ON DUPLICATE KEY UPDATE role = VALUES(role), note = VALUES(note);'
    , [email, role || null, note || null]);

    return ((response !== undefined) && (response.affectedRows > 0));
}

export const DB_SELECT_EMAIL_SUBSCRIPTION_RECENT = async(days:number = 30):Promise<WebsiteSubscription[]> => {
    const rows = await execute(
        'SELECT email, role, note, createdDT '
        + 'FROM subscription ' 
        + 'WHERE createdDT >= DATE_SUB(NOW(), INTERVAL ? DAY) '
        + 'ORDER BY createdDT DESC;',
        [days]);

    return [...rows.map((row: any) => ({email: row.email, role: row.role, note: row.note, createdDT: row.createdDT}))];
}
