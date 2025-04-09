import { RowDataPacket } from 'mysql2/promise';
import * as log from '../../10-utilities/logging/log.mjs';
import { query, execute, command } from '../database.mjs';
import USER from '../../1-models/userModel.mjs';
import { NewPartnerListItem, PartnerCountListItem, PartnerListItem } from '../../../0-assets/field-sync/api-type-sync/profile-types.mjs';
import { CommandResponseType, DATABASE_MODEL_SOURCE_ENVIRONMENT_ENUM, DATABASE_PARTNER_STATUS_ENUM, DATABASE_USER, DATABASE_USER_ROLE_ENUM, USER_TABLE_COLUMNS } from '../database-types.mjs';
import { PartnerStatusEnum, RoleEnum } from '../../../0-assets/field-sync/input-config-sync/profile-field-config.mjs';
import { camelCase, getModelSourceEnvironment } from '../../10-utilities/utilities.mjs';
import { LIST_LIMIT } from '../../../0-assets/field-sync/input-config-sync/search-config.mjs';


/**********************************************
/*    DEFINING AND HANDLING ALL QUERIES HERE 
/* TABLES: partner
***********************************************/

/* Prevent SQL Injection Protocol:
* 1) Use Prepared Statements, auto escape input strings
* 2) Validate Column Names
* - Use execute() for Prepared Statements (inputs)
* - Use query() for predefined Select Statements (static)
* - Use command() for database operation (inputs)
* - Use batch() for multiple prepared operations (input)
*/

/********************************************
 *              UTILITIES                   *
 * 'userID' is ALWAYS LESS THAN 'partnerID' *
 ********************************************/
export const getUserID = (userID:number, partnerID:number):number => (userID < partnerID) ? userID : partnerID;

export const getPartnerID = (userID:number, partnerID:number):number => (userID > partnerID) ? userID : partnerID;

//From userID's perspective
const convertPartnershipPerspective = (userID:number, itemUserID:number, itemPartnerID:number, item:PartnerListItem):PartnerListItem => 
    ({ ...item,
        status: (userID === itemPartnerID 
                    && (item.status === PartnerStatusEnum.PENDING_CONTRACT_USER 
                        || item.status === PartnerStatusEnum.PENDING_CONTRACT_PARTNER)) ? 
                (item.status === PartnerStatusEnum.PENDING_CONTRACT_USER ? 
                    PartnerStatusEnum.PENDING_CONTRACT_PARTNER 
                    : PartnerStatusEnum.PENDING_CONTRACT_USER) 
                : item.status,
        //partnerID
        userID: (userID === itemPartnerID) ? itemUserID : itemPartnerID,
    });

/*********************
 *  PARTNER QUERIES  *
 *********************/
export const DB_IS_USER_PARTNER_ANY_STATUS = async(userID:number, clientID:number, statusList:DATABASE_PARTNER_STATUS_ENUM[] = [DATABASE_PARTNER_STATUS_ENUM.PARTNER]):Promise<boolean> => {
    
    if(statusList === undefined || statusList.length === 0) return false;

    const preparedColumns:string = '( ' + statusList.map((key)=> `status = ?`).join(' OR ') + ' )';

    const rows = await execute('SELECT partner.status ' + 'FROM partner '
        + `WHERE userID = ? AND partnerID = ? AND ${preparedColumns};`, [getUserID(userID, clientID), getPartnerID(userID, clientID), ...statusList]);

    if(rows.length > 1) log.db(`DB_IS_ANY_USER_PARTNER MULTIPLE RECORDS for partnership IDENTIFIED`, userID, clientID, ...statusList, JSON.stringify(rows));

    return (rows.length > 0);
}

export const DB_SELECT_PARTNER_STATUS = async(userID:number, clientID:number):Promise<PartnerStatusEnum|undefined> => {
    const rows = await execute('SELECT status ' + 'FROM partner '
        + 'WHERE userID = ? AND partnerID = ?;', [getUserID(userID, clientID), getPartnerID(userID, clientID)]);

    if(rows.length !== 1) log.db(`DB_SELECT_PARTNER_STATUS ${(rows.length > 1) ? 'MULTIPLE' : 'NONE'} RECORDS for partnership IDENTIFIED`, userID, clientID, JSON.stringify(rows));

    return (rows.length > 0) ? rows[0].status : undefined;
}

//Perspective of userID and PartnerListItem includes profile of partnerID
export const DB_SELECT_PARTNERSHIP = async(userID:number, partnerID:number):Promise<PartnerListItem|undefined> => {
    const rows = await execute('SELECT partner.userID, partner.partnerID, user.firstName, user.displayName, user.image, partner.status, partner.userContractDT, partner.partnerContractDT, partner.partnershipDT ' 
    + 'FROM partner '
    + 'LEFT JOIN user ON (partner.userID = user.userID OR partner.partnerID = user.userID) '
    + 'WHERE user.userID = ? AND partner.userID = ? AND partner.partnerID = ?;'
    , [partnerID, getUserID(userID, partnerID), getPartnerID(userID, partnerID)]);

    if(rows.length !== 1) log.db(`DB_SELECT_PARTNERSHIP ${(rows.length > 1) ? 'MULTIPLE' : 'NONE'} RECORDS for partnership IDENTIFIED`, userID, partnerID, JSON.stringify(rows));

    return (rows.length === 0) ? undefined
        : convertPartnershipPerspective(userID, rows[0].userID, rows[0].partnerID,
            {userID: -1, firstName: rows[0].firstName || '', displayName: rows[0].displayName || '', image: rows[0].image || '',
                status: PartnerStatusEnum[rows[0].status], contractDT: (partnerID === getPartnerID(userID, partnerID)) ? rows[0].partnerContractDT : rows[0].userContractDT, partnershipDT: rows[0].partnershipDT});
}

export const DB_SELECT_PARTNER_LIST = async(userID:number, status?:DATABASE_PARTNER_STATUS_ENUM):Promise<PartnerListItem[]> => {

    const rows:RowDataPacket[] = (status === undefined) ?
            await execute('SELECT partner.userID, partner.partnerID, user.firstName, user.displayName, user.image, partner.status ' 
                + 'FROM partner '
                + 'LEFT JOIN user ON (partner.userID = user.userID OR partner.partnerID = user.userID) '
                + 'WHERE ( partner.userID = ? OR partner.partnerID = ? ) AND user.userID != ? '
                + `AND status NOT IN ('FAILED', 'ENDED');`, [userID, userID, userID])

        : ([DATABASE_PARTNER_STATUS_ENUM.PENDING_CONTRACT_USER, DATABASE_PARTNER_STATUS_ENUM.PENDING_CONTRACT_PARTNER].includes(status)) ?
            await execute('SELECT partner.userID, partner.partnerID, user.firstName, user.displayName, user.image, partner.status ' 
                + 'FROM partner '
                + 'LEFT JOIN user ON (partner.userID = user.userID OR partner.partnerID = user.userID) '
                + 'WHERE ( partner.userID = ? OR partner.partnerID = ? ) AND user.userID != ? '
                + `AND (status = 'PENDING_CONTRACT_BOTH' OR status = 'PENDING_CONTRACT_USER' OR status = 'PENDING_CONTRACT_PARTNER');`
                , [userID, userID, userID])
    
            : await execute('SELECT partner.userID, partner.partnerID, user.firstName, user.displayName, user.image, partner.status ' 
                + 'FROM partner '
                + 'LEFT JOIN user ON (partner.userID = user.userID OR partner.partnerID = user.userID) '
                + 'WHERE ( partner.userID = ? OR partner.partnerID = ? ) AND user.userID != ? '
                + 'AND status = ?;', [userID, userID, userID, status]);

    //Filtered to match userID perspective
    return rows.map(row => convertPartnershipPerspective(userID, row.userID, row.partnerID,
        {userID: -1, firstName: row.firstName || '', displayName: row.displayName || '', image: row.image || '',
                status: PartnerStatusEnum[row.status]}))
            .filter((partner:PartnerListItem) => (!status || DATABASE_PARTNER_STATUS_ENUM[partner.status] === status));
}


export const DB_SELECT_PENDING_PARTNER_LIST = async(userID?:number):Promise<PartnerListItem[]> => {
    const rows:RowDataPacket[] = (userID !== undefined) ?    
        await execute('SELECT partner.userID, partner.partnerID, user.firstName, user.displayName, user.image, partner.status ' 
            + 'FROM partner '
            + 'LEFT JOIN user ON (partner.userID = user.userID OR partner.partnerID = user.userID) '
            + 'WHERE ( partner.userID = ? OR partner.partnerID = ? ) AND user.userID != ? '
            + `AND (status = 'PENDING_CONTRACT_BOTH' OR status = 'PENDING_CONTRACT_USER' OR status = 'PENDING_CONTRACT_PARTNER');`
            , [userID, userID, userID])

        : await query('SELECT partner.userID, partner.partnerID, user.firstName, user.displayName, user.image, partner.status ' 
            + 'FROM partner '
            + 'LEFT JOIN user ON (partner.userID = user.userID OR partner.partnerID = user.userID) '
            + `WHERE (status = 'PENDING_CONTRACT_BOTH' OR status = 'PENDING_CONTRACT_USER' OR status = 'PENDING_CONTRACT_PARTNER');`
            );

    return [...rows.map(row => convertPartnershipPerspective(userID || -1, row.userID, row.partnerID,
        {userID: -1, firstName: row.firstName || '', displayName: row.displayName || '', image: row.image || '', status: PartnerStatusEnum[row.status]}))];
}

/* ADMIN Utility */
export const DB_SELECT_PENDING_PARTNER_PAIR_LIST = async():Promise<[NewPartnerListItem, NewPartnerListItem][]> => {
    const rows:RowDataPacket[] = await query('SELECT status, userContractDT, partnerContractDT, user.*, '
            + `${USER_TABLE_COLUMNS.map((column:string) => `client.${column} as ${camelCase('client', column)}`).join(', ')} `
            + 'FROM partner '
            + 'LEFT JOIN user ON (partner.userID = user.userID) '
            + 'LEFT JOIN user client ON (partner.partnerID = client.userID) '
            + `WHERE (status = 'PENDING_CONTRACT_BOTH' OR status = 'PENDING_CONTRACT_USER' OR status = 'PENDING_CONTRACT_PARTNER') `
            + 'ORDER BY CASE '
                + `WHEN user.modelSourceEnvironment = '${DATABASE_MODEL_SOURCE_ENVIRONMENT_ENUM.PRODUCTION}' OR user.modelSourceEnvironment = '${DATABASE_MODEL_SOURCE_ENVIRONMENT_ENUM.INTERNAL}' `
                    + `OR client.modelSourceEnvironment = '${DATABASE_MODEL_SOURCE_ENVIRONMENT_ENUM.PRODUCTION}' OR client.modelSourceEnvironment = '${DATABASE_MODEL_SOURCE_ENVIRONMENT_ENUM.INTERNAL}' `
                    +'THEN 1 '
                + `WHEN user.modelSourceEnvironment = '${DATABASE_MODEL_SOURCE_ENVIRONMENT_ENUM.DEVELOPMENT}' OR client.modelSourceEnvironment = '${DATABASE_MODEL_SOURCE_ENVIRONMENT_ENUM.DEVELOPMENT}' `
                    + 'THEN 2 '
                + 'ELSE 3 '
            + 'END, '
            + 'partner.modifiedDT DESC;'
        );

    //Only here does userID match status
    return rows.map(row => ([
            {...USER.constructByDatabase(row as DATABASE_USER).toNewPartnerListItem(),
                 contractDT: row.userContractDT, status: PartnerStatusEnum[row.status]},
            {...USER.constructByDatabase(row as DATABASE_USER, 'client').toNewPartnerListItem(),
                contractDT: row.partnerContractDT, 
                status: (PartnerStatusEnum[row.status] === PartnerStatusEnum.PENDING_CONTRACT_USER) ? PartnerStatusEnum.PENDING_CONTRACT_PARTNER
                        : (PartnerStatusEnum[row.status] === PartnerStatusEnum.PENDING_CONTRACT_PARTNER) ? PartnerStatusEnum.PENDING_CONTRACT_USER
                        : PartnerStatusEnum[row.status]}
    ]));
}


/*******************
 *  PARTNER STATUS *
 *******************/
export const DB_ASSIGN_PARTNER_STATUS = async(userID:number, clientID:number, status:DATABASE_PARTNER_STATUS_ENUM = DATABASE_PARTNER_STATUS_ENUM.PENDING_CONTRACT_BOTH):Promise<boolean> => {
    const response:CommandResponseType = await command('INSERT INTO partner ( userID, partnerID, status, userContractDT, partnerContractDT ) VALUES (?, ?, ?, ?, ?) '
    + 'ON DUPLICATE KEY UPDATE status = ?;',
     [getUserID(userID, clientID), getPartnerID(userID, clientID), status, 
        (userID === getUserID(userID, clientID)) ? new Date() : null, 
        (userID === getPartnerID(userID, clientID)) ? new Date() : null, 
        status]);

    return ((response !== undefined) && (response.affectedRows > 0));
}

//Include either (userID & clientID) or (userID & status)
export const DB_DELETE_PARTNERSHIP = async(userID:number, clientID?:number, status?:PartnerStatusEnum):Promise<boolean> => {    
    log.db(`DELETE PARTNERSHIP attempted: userID:${userID} and clientID:${clientID} with status:${(clientID === undefined) ? 'ALL PARTNER CONNECTIONS' : 'Single Partnership'}`);

    const response:CommandResponseType = (status !== undefined)
        ? await command('DELETE FROM partner WHERE userID = ? OR partnerID = ? AND status = ?;', [userID, userID, status])

        : (clientID === undefined) //Delete all partnership connections
            ? await command('DELETE FROM partner WHERE userID = ? OR partnerID = ?;', [userID, userID])

        : await command('DELETE FROM partner WHERE userID = ? AND partnerID = ?;', [getUserID(userID, clientID), getPartnerID(userID, clientID)]);

    return (response !== undefined);  //Success on non-error
}


/***************************
 *  NEW PARTNER SEARCH     *
 * (Requires USER role) *
 ***************************/
export const DB_SELECT_AVAILABLE_PARTNER_LIST = async(user:USER, limit = 1): Promise<NewPartnerListItem[]> => {
    const matchGender:boolean = (process.env.PARTNER_GENDER_MATCH !== undefined) ? (process.env.PARTNER_GENDER_MATCH === 'true') : true;
    const ageYearRange:number = (process.env.PARTNER_AGE_RANGE !== undefined) ? parseInt(process.env.PARTNER_AGE_RANGE) : 2;
    const walkLevelRange:number = (process.env.PARTNER_WALK_RANGE !== undefined) ? parseInt(process.env.PARTNER_WALK_RANGE) : 2;

    /* Validations */
    if (isNaN(ageYearRange) || isNaN(walkLevelRange) || process.env.PARTNER_GENDER_MATCH === undefined) {
        log.error('Partner Search: Invalid environment variables', process.env.PARTNER_GENDER_MATCH, process.env.PARTNER_AGE_RANGE, process.env.PARTNER_WALK_RANGE);
        return [];
    } else if (user.userID <= 0 || !user.dateOfBirth || !user.gender || user.walkLevel === undefined) {
        log.error('Partner Search: Invalid USER', user.userID, user.dateOfBirth, user.gender, user.walkLevel, user.toString());
        return [];
    } else if(!user.isRole(RoleEnum.USER)) {
        log.error('Partner Search: User Role Required to match partners', user.userID, JSON.stringify(user.userRoleList), user.toString());
        return [];
    }

    const minDateOfBirth:Date = new Date(user.dateOfBirth);
        minDateOfBirth.setFullYear(user.dateOfBirth.getFullYear() - ageYearRange);
    const maxDateOfBirth:Date = new Date(user.dateOfBirth);
        maxDateOfBirth.setFullYear(user.dateOfBirth.getFullYear() + ageYearRange);

    /* Execute Search */
    const rows:RowDataPacket[] = await execute(
        'SELECT DISTINCT user.* '
        + 'FROM user '
        + 'LEFT JOIN user_role ON user.userID = user_role.userID '
        + 'LEFT JOIN user_role_defined ON user_role.userRoleID = user_role_defined.userRoleID '
        + 'LEFT JOIN partner ON (( user.userID = partner.userID OR user.userID = partner.partnerID) '
        + '    AND ( partner.userID = ? OR partner.partnerID = ? )) '
        + 'LEFT JOIN ( '
        + '    SELECT userID, COUNT(*) AS partnerCount '
        + '    FROM partner '
        + `    WHERE status NOT IN ('FAILED', 'ENDED') `
        + '    GROUP BY userID '
        + ') AS partnerCounts ON user.userID = partnerCounts.userID '
        + 'WHERE user.userID != ? '
            + 'AND user.isActive = true '
            + `AND (( user.modelSourceEnvironment = ? ) `
                + 'OR ( '
                + '  CASE '
                + `    WHEN ? = '${DATABASE_MODEL_SOURCE_ENVIRONMENT_ENUM.DEVELOPMENT}' THEN user.modelSourceEnvironment IN ('${DATABASE_MODEL_SOURCE_ENVIRONMENT_ENUM.MOCK}') `
                + `    WHEN ? = '${DATABASE_MODEL_SOURCE_ENVIRONMENT_ENUM.INTERNAL}' THEN user.modelSourceEnvironment IN ('${DATABASE_MODEL_SOURCE_ENVIRONMENT_ENUM.MOCK}') `
                + '    ELSE false '
                + '  END '
                + ')) '
            + 'AND ( ? = false OR user.gender = ? ) '
            + `AND user.dateOfBirth BETWEEN ? AND ? `
            + 'AND user.walkLevel BETWEEN ? AND ? '
            + 'AND ( user.maxPartners > ( '
            + `    SELECT COUNT(*) FROM partner WHERE (userID = user.userID OR partnerID = user.userID) AND status NOT IN ('FAILED', 'ENDED') `
            + ')) '
            + `AND ( user_role_defined.userRole = 'USER' OR user_role.userID IS NULL ) ` //USER role only
            + 'AND NOT EXISTS ( '
            + '    SELECT 1 '
            + '    FROM user_role '
            + '    JOIN user_role_defined ON user_role.userRoleID = user_role_defined.userRoleID '
            + `    WHERE user.userID = user_role.userID AND user_role_defined.userRole IN ('REPORTED', 'INACTIVE') `
            + ') '
        + `ORDER BY (user.modelSourceEnvironment != '${DATABASE_MODEL_SOURCE_ENVIRONMENT_ENUM.MOCK}'), `
            + 'COALESCE( partnerCounts.partnerCount, 0 ) ASC, ' //Prioritize without any partners
            + 'RAND() '
        + `LIMIT ${limit};`

    , [ user.userID,
        user.userID,
        user.userID,
        user.modelSourceEnvironment,
        user.modelSourceEnvironment,
        user.modelSourceEnvironment,
        matchGender,
        user.gender,
        minDateOfBirth.toISOString(),
        maxDateOfBirth.toISOString(),
        user.walkLevel - walkLevelRange,
        user.walkLevel + walkLevelRange,
    ]);

    return [...rows.map(row => (USER.constructByDatabase(row as DATABASE_USER).toNewPartnerListItem()))];
}


/*********************************
 *  ADMIN PARTNER STATUS QUERIES *
 *********************************/
//Only USER Role and top 100 oldest users w/o active partners
export const DB_SELECT_UNASSIGNED_PARTNER_USER_LIST = async(limit:number = LIST_LIMIT):Promise<NewPartnerListItem[]> => {
    const rows:RowDataPacket[] = await execute(
        'SELECT DISTINCT user.* ' 
        + 'FROM user '
        + 'LEFT JOIN user_role ON user.userID = user_role.userID '
        + 'LEFT JOIN user_role_defined ON user_role.userRoleID = user_role_defined.userRoleID '
        + 'LEFT JOIN partner ON (partner.userID = user.userID OR partner.partnerID = user.userID) '
        + `WHERE (user_role_defined.userRole = 'USER' OR user_role.userID IS NULL) `
        + '    AND user.modelSourceEnvironment = ? '
        + '    AND user.maxPartners > 0 '
        + '    AND ((partner.userID IS NULL AND partner.partnerID IS NULL) '
        + `        OR (partner.status IN ('FAILED', 'ENDED') `
        + `            AND user.userID NOT IN (SELECT userID FROM partner WHERE status NOT IN ('FAILED', 'ENDED')))) `
        + 'ORDER BY user.createdDT ASC ' //Oldest Users
        + `LIMIT ${limit};`,
    
    [getModelSourceEnvironment()]);

    return [...rows.map(row => USER.constructByDatabase(row as DATABASE_USER).toNewPartnerListItem())];
}

//Latest Users with USER Role
export const DB_SELECT_PARTNER_STATUS_MAP = async(filterFewerPartners:boolean = false, limit:number = LIST_LIMIT):Promise<PartnerCountListItem[]> => {

    const totalByStatus:string = Object.values(PartnerStatusEnum)
        .map((status) => `COALESCE(SUM(CASE WHEN partner.status = '${status}' THEN 1 ELSE 0 END), 0) ${status}`).join(', ');

    const rows:RowDataPacket[] = await query(
            `SELECT user.*, ${totalByStatus} ` 
            + 'FROM user '
            + 'LEFT JOIN user_role ON user.userID = user_role.userID '
            + 'LEFT JOIN user_role_defined ON user_role.userRoleID = user_role_defined.userRoleID '
            + 'LEFT JOIN partner ON (partner.userID = user.userID OR partner.partnerID = user.userID) '
            + `WHERE (user_role_defined.userRole = 'USER' OR user_role.userID IS NULL) `
            + 'GROUP BY user.userID '
            + `${filterFewerPartners ?
                `HAVING SUM(CASE WHEN partner.status NOT IN ('FAILED', 'ENDED') THEN 1 ELSE 0 END) < user.maxPartners ` : ''}`
            + 'ORDER BY '
                + `${filterFewerPartners ?
                    `${'CASE '
                        + `WHEN user.modelSourceEnvironment = '${DATABASE_MODEL_SOURCE_ENVIRONMENT_ENUM.PRODUCTION}' THEN 1 `
                        + `WHEN user.modelSourceEnvironment = '${DATABASE_MODEL_SOURCE_ENVIRONMENT_ENUM.INTERNAL}' THEN 2 `
                        + `WHEN user.modelSourceEnvironment = '${DATABASE_MODEL_SOURCE_ENVIRONMENT_ENUM.DEVELOPMENT}' THEN 3 `
                        + 'ELSE 4 '
                    + 'END, '}`
                : `user.modelSourceEnvironment != '${DATABASE_MODEL_SOURCE_ENVIRONMENT_ENUM.MOCK}', `
                }`
            + 'user.createdDT DESC ' //Newest Users
            + `LIMIT ${LIST_LIMIT};`);

    //Note: Express can't serialize Maps, so returning a [key, value] pair array
    return rows.map(row => ({...USER.constructByDatabase(row as DATABASE_USER).toNewPartnerListItem(),
                                partnerCountMap: Object.values(PartnerStatusEnum).map(status => [status, parseInt(row[status] || '0')])}));
}
