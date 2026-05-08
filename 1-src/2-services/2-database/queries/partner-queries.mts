import { RowDataPacket } from 'mysql2/promise';
import * as log from '../../10-utilities/logging/log.mjs';
import { query, execute, command } from '../database.mjs';
import USER from '../../1-models/userModel.mjs';
import { NewPartnerListItem, PartnerCountListItem, PartnerListItem } from '../../../0-assets/field-sync/api-type-sync/profile-types.mjs';
import { CommandResponseType, DATABASE_MODEL_SOURCE_ENVIRONMENT_ENUM, DATABASE_PARTNER_STATUS_ENUM, DATABASE_USER, USER_TABLE_COLUMNS } from '../database-types.mjs';
import { PartnerStatusEnum, RoleEnum } from '../../../0-assets/field-sync/input-config-sync/profile-field-config.mjs';
import { camelCase, getEnv, getEnvironment, getModelSourceEnvironment } from '../../10-utilities/utilities.mjs';
import { LIST_LIMIT } from '../../../0-assets/field-sync/input-config-sync/search-config.mjs';
import { ENVIRONMENT_TYPE } from '../../../0-assets/field-sync/input-config-sync/inputField.mjs';
import { DatabasePartnershipStats } from '../../../0-assets/field-sync/api-type-sync/utility-types.mjs';
import { calculatePartnerMatchingDOB, calculatePartnerMatchingWalkLevel, PartnerMatchingRange } from '../../../0-assets/field-sync/api-type-sync/partner-matching-criteria.mjs';


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

        const rows = await execute('SELECT partner.status '
        + 'FROM partner '
        + 'JOIN user AS partner_user ON partner_user.userID = partner.userID '
        + 'JOIN user AS client_user ON client_user.userID = partner.partnerID '
        + 'WHERE partner.userID = ? '
            + 'AND partner.partnerID = ? '
            + `AND ${preparedColumns};`, 
        [getUserID(userID, clientID), getPartnerID(userID, clientID), ...statusList]);

    if(rows.length > 1) log.db(`DB_IS_ANY_USER_PARTNER MULTIPLE RECORDS for partnership IDENTIFIED`, userID, clientID, ...statusList, JSON.stringify(rows));

    return (rows.length > 0);
}

export const DB_SELECT_PARTNER_STATUS = async(userID:number, clientID:number):Promise<PartnerStatusEnum|undefined> => {
        const rows = await execute('SELECT '
        + 'CASE '
            + `WHEN partner_user.moderationStatus IS NOT NULL OR client_user.moderationStatus IS NOT NULL THEN '${DATABASE_PARTNER_STATUS_ENUM.UNDER_REVIEW}' `
            + 'ELSE partner.status '
            + 'END AS status '
        + 'FROM partner '
        + 'JOIN user AS partner_user ON partner_user.userID = partner.userID '
        + 'JOIN user AS client_user ON client_user.userID = partner.partnerID '
        + 'WHERE partner.userID = ? AND partner.partnerID = ?;', [getUserID(userID, clientID), getPartnerID(userID, clientID)]);

    if(rows.length !== 1) log.db(`DB_SELECT_PARTNER_STATUS ${(rows.length > 1) ? 'MULTIPLE' : 'NONE'} RECORDS for partnership IDENTIFIED`, userID, clientID, JSON.stringify(rows));

    return (rows.length > 0) ? rows[0].status : undefined;
}

//Perspective of userID and PartnerListItem includes profile of partnerID
export const DB_SELECT_PARTNERSHIP = async(userID:number, partnerID:number):Promise<PartnerListItem|undefined> => {
    const rows = await execute('SELECT partner.userID, partner.partnerID, user.firstName, user.displayName, user.image, partner.userContractDT, partner.partnerContractDT, partner.partnershipDT, '
    + 'CASE '
        + `WHEN partner_user.moderationStatus IS NOT NULL OR client_user.moderationStatus IS NOT NULL THEN '${DATABASE_PARTNER_STATUS_ENUM.UNDER_REVIEW}' `
        + 'ELSE partner.status '
        + 'END AS status '
    + 'FROM partner '
    + 'LEFT JOIN user ON (partner.userID = user.userID OR partner.partnerID = user.userID) '
    + 'JOIN user AS partner_user ON partner_user.userID = partner.userID '
    + 'JOIN user AS client_user ON client_user.userID = partner.partnerID '
    + 'WHERE user.userID = ? AND partner.userID = ? AND partner.partnerID = ?;'
    , [partnerID, getUserID(userID, partnerID), getPartnerID(userID, partnerID)]);

    if(rows.length !== 1) log.db(`DB_SELECT_PARTNERSHIP ${(rows.length > 1) ? 'MULTIPLE' : 'NONE'} RECORDS for partnership IDENTIFIED`, userID, partnerID, JSON.stringify(rows));

    return (rows.length === 0) ? undefined
        : convertPartnershipPerspective(userID, rows[0].userID, rows[0].partnerID,
            {userID: -1, firstName: rows[0].firstName || '', displayName: rows[0].displayName || '', image: rows[0].image || '',
                status: PartnerStatusEnum[rows[0].status], contractDT: (partnerID === getPartnerID(userID, partnerID)) ? rows[0].partnerContractDT : rows[0].userContractDT, partnershipDT: rows[0].partnershipDT});
}

export const DB_SELECT_PARTNER_LIST = async(userID:number, status?:DATABASE_PARTNER_STATUS_ENUM):Promise<PartnerListItem[]> => {

    const rows:RowDataPacket[] = await execute('SELECT partner.userID, partner.partnerID, user.firstName, user.displayName, user.image, partner.userContractDT, partner.partnerContractDT, partner.partnershipDT, '
        + 'CASE '
            + `WHEN partner_user.moderationStatus IS NOT NULL OR client_user.moderationStatus IS NOT NULL THEN '${DATABASE_PARTNER_STATUS_ENUM.UNDER_REVIEW}' `
            + 'ELSE partner.status '
            + 'END AS status '
        + 'FROM partner '
        + 'LEFT JOIN user ON (partner.userID = user.userID OR partner.partnerID = user.userID) '
        + 'JOIN user AS partner_user ON partner_user.userID = partner.userID '
        + 'JOIN user AS client_user ON client_user.userID = partner.partnerID '
        + 'WHERE ( partner.userID = ? OR partner.partnerID = ? ) AND user.userID != ?;',
        [userID, userID, userID]);

    //Filtered to match userID perspective
    return rows.map(row => convertPartnershipPerspective(userID, row.userID, row.partnerID,
        {userID: -1, firstName: row.firstName || '', displayName: row.displayName || '', image: row.image || '', contractDT: row.partnerContractDT, partnershipDT: row.partnershipDT, status: PartnerStatusEnum[row.status]}))
            .filter((partner:PartnerListItem) => {
                const partnerStatus:DATABASE_PARTNER_STATUS_ENUM = DATABASE_PARTNER_STATUS_ENUM[partner.status];

                
                if(status === DATABASE_PARTNER_STATUS_ENUM.PENDING_CONTRACT_BOTH)
                    return [
                            DATABASE_PARTNER_STATUS_ENUM.PENDING_CONTRACT_BOTH,
                            DATABASE_PARTNER_STATUS_ENUM.PENDING_CONTRACT_USER,
                            DATABASE_PARTNER_STATUS_ENUM.PENDING_CONTRACT_PARTNER
                        ].includes(partnerStatus);

                else if(status === DATABASE_PARTNER_STATUS_ENUM.ENDED)
                    return [
                            DATABASE_PARTNER_STATUS_ENUM.ENDED,
                            DATABASE_PARTNER_STATUS_ENUM.UNDER_REVIEW
                        ].includes(partnerStatus);

                else if(status !== undefined) 
                    return partnerStatus === status;

                else
                    return [
                        DATABASE_PARTNER_STATUS_ENUM.PARTNER,
                        DATABASE_PARTNER_STATUS_ENUM.PENDING_CONTRACT_BOTH,
                        DATABASE_PARTNER_STATUS_ENUM.PENDING_CONTRACT_USER,
                        DATABASE_PARTNER_STATUS_ENUM.PENDING_CONTRACT_PARTNER
                    ].includes(partnerStatus);
            });
}


/* ADMIN Utility */
export const DB_SELECT_PENDING_PARTNER_PAIR_LIST = async(limit:number = 100):Promise<[NewPartnerListItem, NewPartnerListItem][]> => {
    const rows:RowDataPacket[] = await query('SELECT status, userContractDT, partnerContractDT, user.*, '
            + `${USER_TABLE_COLUMNS.map((column:string) => `client.${column} as ${camelCase('client', column)}`).join(', ')} `
            + 'FROM partner '
            + 'LEFT JOIN user ON (partner.userID = user.userID) '
            + 'LEFT JOIN user client ON (partner.partnerID = client.userID) '
            + `WHERE (partner.status = 'PENDING_CONTRACT_BOTH' OR partner.status = 'PENDING_CONTRACT_USER' OR partner.status = 'PENDING_CONTRACT_PARTNER') `
                + 'AND user.moderationStatus IS NULL '
                + 'AND client.moderationStatus IS NULL '
            + 'ORDER BY CASE '
                + `WHEN user.modelSourceEnvironment = '${DATABASE_MODEL_SOURCE_ENVIRONMENT_ENUM.PRODUCTION}' OR user.modelSourceEnvironment = '${DATABASE_MODEL_SOURCE_ENVIRONMENT_ENUM.INTERNAL}' `
                    + `OR client.modelSourceEnvironment = '${DATABASE_MODEL_SOURCE_ENVIRONMENT_ENUM.PRODUCTION}' OR client.modelSourceEnvironment = '${DATABASE_MODEL_SOURCE_ENVIRONMENT_ENUM.INTERNAL}' `
                    +'THEN 1 '
                + `WHEN user.modelSourceEnvironment = '${DATABASE_MODEL_SOURCE_ENVIRONMENT_ENUM.DEVELOPMENT}' OR client.modelSourceEnvironment = '${DATABASE_MODEL_SOURCE_ENVIRONMENT_ENUM.DEVELOPMENT}' `
                    + 'THEN 2 '
                + 'ELSE 3 '
            + 'END, '
            + 'partner.modifiedDT DESC '
            + `LIMIT ${limit};`);

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
        ? await command('DELETE FROM partner WHERE (userID = ? OR partnerID = ?) AND status = ?;', [userID, userID, status])

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

    /* Validations */
    if(user.userID <= 0 || !user.dateOfBirth || !user.gender || user.walkLevel === undefined) {
        log.error('Partner Search: Invalid USER', user.userID, user.dateOfBirth, user.gender, user.walkLevel, user.toString());
        return [];
    } else if(!user.isRole(RoleEnum.USER)) {
        log.error('Partner Search: User Role Required to match partners', user.userID, JSON.stringify(user.userRoleList), user.toString());
        return [];
    }

    const matchGender:boolean = getEnv('PARTNER_GENDER_MATCH', 'boolean', true);
    const dateOfBirthRange:PartnerMatchingRange<Date> = calculatePartnerMatchingDOB(user.dateOfBirth);
    const walkLevelRange:PartnerMatchingRange<number> = calculatePartnerMatchingWalkLevel(user.walkLevel);

    
    /* Execute Search */
    const rows:RowDataPacket[] = await execute(
        'SELECT DISTINCT user.* '
        + 'FROM user '
        + 'LEFT JOIN user_role ON user.userID = user_role.userID '
        + 'LEFT JOIN user_role_defined ON user_role.userRoleID = user_role_defined.userRoleID '
        + 'LEFT JOIN partner ON (( user.userID = partner.userID OR user.userID = partner.partnerID) '
        + '    AND ( partner.userID = ? OR partner.partnerID = ? )) '
        + 'LEFT JOIN ( '
        + '    SELECT userID, COUNT(*) AS partnerCount ' //TODO: Not counting where userID = partner.partnerID
        + '    FROM partner '
        + `    WHERE status NOT IN ('FAILED', 'ENDED') `
        + '    GROUP BY userID '
        + ') AS partnerCounts ON user.userID = partnerCounts.userID '
        + 'WHERE user.userID != ? '

            + 'AND user.moderationStatus IS NULL '

            + ((getEnvironment() == ENVIRONMENT_TYPE.PRODUCTION) ? 'AND user.isEmailVerified = 1 ' : '')
            
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
            + 'AND user.postalCode != ? ' //TODO Enhance with Proximity Feature
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
        dateOfBirthRange.min.toISOString(),
        dateOfBirthRange.max.toISOString(),
        walkLevelRange.min,
        walkLevelRange.max,
        user.postalCode,
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
        + '    AND user.moderationStatus IS NULL '
        + '    AND user.modelSourceEnvironment = ? '
        + '    AND user.maxPartners > 0 '
        + '    AND ((partner.userID IS NULL AND partner.partnerID IS NULL) '
        + `        OR (partner.status IN ('FAILED', 'ENDED') `
        + `            AND NOT EXISTS ( `
        + `                SELECT 1 FROM partner active_partner `
        + `                WHERE (active_partner.userID = user.userID OR active_partner.partnerID = user.userID) `
        + `                AND active_partner.status NOT IN ('FAILED', 'ENDED') `
        + `            ))) `
        + 'ORDER BY user.createdDT ASC ' //Oldest Users
        + `LIMIT ${limit};`,
    
    [getModelSourceEnvironment()]);

    return [...rows.map(row => USER.constructByDatabase(row as DATABASE_USER).toNewPartnerListItem())];
}

//Latest Users with USER Role
export const DB_SELECT_PARTNER_STATUS_MAP = async(filterFewerPartners:boolean = false, limit:number = LIST_LIMIT):Promise<PartnerCountListItem[]> => {
    const totalByStatus:string = Object.values(PartnerStatusEnum)
        .map((status) => 'COALESCE(SUM(CASE WHEN '
                + 'CASE '
                    + `WHEN partner_user.moderationStatus IS NOT NULL OR client_user.moderationStatus IS NOT NULL THEN '${DATABASE_PARTNER_STATUS_ENUM.UNDER_REVIEW}' `
                    + 'ELSE partner.status '
                + `END = '${status}' `
                + 'THEN 1 ELSE 0 END), 0) '
                + `${status}`
        ).join(', ');

    const rows:RowDataPacket[] = await query(
            `SELECT user.*, ${totalByStatus} ` 
            + 'FROM user '
            + 'LEFT JOIN user_role ON user.userID = user_role.userID '
            + 'LEFT JOIN user_role_defined ON user_role.userRoleID = user_role_defined.userRoleID '
            + 'LEFT JOIN partner ON (partner.userID = user.userID OR partner.partnerID = user.userID) '
            + 'LEFT JOIN user AS partner_user ON partner_user.userID = partner.userID '
            + 'LEFT JOIN user AS client_user ON client_user.userID = partner.partnerID '
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
            + `LIMIT ${limit};`);

    //Note: Express can't serialize Maps, so returning a [key, value] pair array
    return rows.map(row => ({...USER.constructByDatabase(row as DATABASE_USER).toNewPartnerListItem(),
                                partnerCountMap: Object.values(PartnerStatusEnum).map(status => [status, parseInt(row[status] || '0')])}));
}


/*******************************************
 * PARTNERSHIP REPORT & STATISTICS QUERIES *
 *******************************************/
export const DB_CALCULATE_PARTNERSHIP_STATS = async(modelSourceEnvironment:DATABASE_MODEL_SOURCE_ENVIRONMENT_ENUM = getModelSourceEnvironment()):Promise<DatabasePartnershipStats> => {
    const [row] = await query(
        //Filter users to modelSourceEnvironment
        'WITH '
        + 'source_user AS ( '
            + 'SELECT '
                + 'user.userID, '
                + 'user.maxPartners, '
                + 'user.createdDT AS userCreatedDT, '
                + 'user.modifiedDT AS userModifiedDT '
            + 'FROM user '
            + `WHERE user.modelSourceEnvironment = '${modelSourceEnvironment}' `
                + 'AND user.moderationStatus IS NULL '
        + '), '

        //Filter ENDED or FAILED Partner relationships
        + 'source_partner AS ( '
            + 'SELECT '
                + 'partner.userID, '
                + 'partner.partnerID, '
                + 'partner.status, '
                + 'partner.userContractDT, '
                + 'partner.partnerContractDT, '
                + 'partner.createdDT AS partnerCreatedDT, '
                + 'partner.modifiedDT AS partnerModifiedDT '
            + 'FROM partner '
            + 'JOIN source_user AS source_user_left ON partner.userID = source_user_left.userID '
            + 'JOIN source_user AS source_user_right ON partner.partnerID = source_user_right.userID '
            + `WHERE partner.status NOT IN ('${DATABASE_PARTNER_STATUS_ENUM.ENDED}', '${DATABASE_PARTNER_STATUS_ENUM.FAILED}') `
        + '), '

        //Split partnerships into per user (partnerID becomes userID)
        + 'partner_member AS ( '
            + 'SELECT '
                + 'source_user.userID, '
                + 'source_user.maxPartners, '
                + 'source_user.userCreatedDT, '
                + 'source_user.userModifiedDT, '
                + 'source_partner.status, '
                + 'source_partner.userContractDT AS contractDT, '
                + 'source_partner.partnerCreatedDT, '
                + 'source_partner.partnerModifiedDT '
            + 'FROM source_partner '
            + 'JOIN source_user ON source_partner.userID = source_user.userID '

            + 'UNION ALL '

            + 'SELECT '
                + 'source_user.userID, '
                + 'source_user.maxPartners, '
                + 'source_user.userCreatedDT, '
                + 'source_user.userModifiedDT, '
                + 'CASE '
                    + `WHEN source_partner.status = '${DATABASE_PARTNER_STATUS_ENUM.PENDING_CONTRACT_PARTNER}' THEN '${DATABASE_PARTNER_STATUS_ENUM.PENDING_CONTRACT_USER}' `
                    + `WHEN source_partner.status = '${DATABASE_PARTNER_STATUS_ENUM.PENDING_CONTRACT_USER}' THEN '${DATABASE_PARTNER_STATUS_ENUM.PENDING_CONTRACT_PARTNER}' `
                    + 'ELSE source_partner.status '
                + 'END AS status, '
                + 'source_partner.partnerContractDT AS contractDT, '
                + 'source_partner.partnerCreatedDT, '
                + 'source_partner.partnerModifiedDT '
            + 'FROM source_partner '
            + 'JOIN source_user ON source_partner.partnerID = source_user.userID '
        + '), '

        // Aggregate subtotals per user
        + 'user_partnership_subtotal AS ( '
            + 'SELECT '
                + 'partner_member.userID, '
                + `COUNT(CASE WHEN partner_member.status = '${DATABASE_PARTNER_STATUS_ENUM.PARTNER}' THEN 1 END) AS partnerships, `
                + 'COUNT(*) AS assignedPartnerships '
            + 'FROM partner_member '
            + 'WHERE partner_member.maxPartners > 0 '
            + 'GROUP BY partner_member.userID '
        + ') '

        /* FINAL SELECT & RETURN QUERY */
        + 'SELECT '

            + 'COUNT(*) AS totalUsers, '

            + '( '
                + 'SELECT COUNT(DISTINCT partner_member.userID) '
                + 'FROM partner_member '
                + `WHERE partner_member.status = '${DATABASE_PARTNER_STATUS_ENUM.PARTNER}' `
            + ') AS usersInPartnerships, '

            // Users with partner capacity but no assignments
            + 'COUNT(CASE WHEN source_user.maxPartners > 0 AND COALESCE(user_partnership_subtotal.assignedPartnerships, 0) = 0 THEN 1 END) AS unassignedPartners, '

            // Total active partnerships.
            + '( '
                + 'SELECT COUNT(*) '
                + 'FROM source_partner '
                + `WHERE source_partner.status = '${DATABASE_PARTNER_STATUS_ENUM.PARTNER}' `
            + ') AS partnerships, '

            // Total pending partnerships.
            + '( '
                + 'SELECT COUNT(*) '
                + 'FROM source_partner '
                + `WHERE source_partner.status IN ('${DATABASE_PARTNER_STATUS_ENUM.PENDING_CONTRACT_BOTH}', '${DATABASE_PARTNER_STATUS_ENUM.PENDING_CONTRACT_USER}', '${DATABASE_PARTNER_STATUS_ENUM.PENDING_CONTRACT_PARTNER}') `
            + ') AS pendingPartnerships, '

            // Users with at least one remaining open partner slot.
            + 'COUNT(CASE WHEN source_user.maxPartners > 0 AND COALESCE(user_partnership_subtotal.assignedPartnerships, 0) < source_user.maxPartners THEN 1 END) AS availablePartners, '

            // Total remaining partner capacity slots
            + 'SUM(CASE WHEN source_user.maxPartners > 0 THEN GREATEST(source_user.maxPartners - COALESCE(user_partnership_subtotal.assignedPartnerships, 0), 0) ELSE 0 END) AS availablePartnerCapacity, '

            // Total filled partner slots
            + 'SUM(CASE WHEN source_user.maxPartners > 0 THEN LEAST(COALESCE(user_partnership_subtotal.assignedPartnerships, 0), source_user.maxPartners) ELSE 0 END) AS filledPartnerCapacity, '

            // Average wait time for new unassigned users created within the last 30 days.
            + 'COALESCE(ROUND(AVG( '
                + 'CASE '
                    + 'WHEN source_user.maxPartners > 0 '
                    + 'AND COALESCE(user_partnership_subtotal.assignedPartnerships, 0) = 0 '
                    + 'AND TIMESTAMPDIFF(HOUR, source_user.userCreatedDT, NOW()) <= 24 * 30 '
                    + 'THEN TIMESTAMPDIFF(HOUR, source_user.userCreatedDT, NOW()) '
                + 'END '
            + '), 1), 0) AS newUserAverageWaitTimeHours, '

            // Unassigned users waiting more than 24 hours and up to 7 days.
            + 'COUNT(CASE '
                + 'WHEN source_user.maxPartners > 0 '
                + 'AND COALESCE(user_partnership_subtotal.assignedPartnerships, 0) = 0 '
                + 'AND TIMESTAMPDIFF(HOUR, source_user.userCreatedDT, NOW()) > 24 '
                + 'AND TIMESTAMPDIFF(HOUR, source_user.userCreatedDT, NOW()) <= 24 * 7 '
                + 'THEN 1 '
            + 'END) AS wait24Hours, '

            // Unassigned users waiting more than 7 days and up to 30 days.
            + 'COUNT(CASE '
                + 'WHEN source_user.maxPartners > 0 '
                + 'AND COALESCE(user_partnership_subtotal.assignedPartnerships, 0) = 0 '
                + 'AND TIMESTAMPDIFF(HOUR, source_user.userCreatedDT, NOW()) > 24 * 7 '
                + 'AND TIMESTAMPDIFF(HOUR, source_user.userCreatedDT, NOW()) <= 24 * 30 '
                + 'THEN 1 '
            + 'END) AS wait7Days, '

            // Fully accepted partnerships in the last 7 days.
            + '( '
                + 'SELECT COUNT(*) '
                + 'FROM source_partner '
                + 'WHERE source_partner.userContractDT IS NOT NULL '
                + 'AND source_partner.partnerContractDT IS NOT NULL '
                + 'AND source_partner.partnerModifiedDT >= NOW() - INTERVAL 7 DAY '
            + ') AS acceptedLastWeek, '

            // Fully accepted partnerships in the last 30 days.
            + '( '
                + 'SELECT COUNT(*) '
                + 'FROM source_partner '
                + 'WHERE source_partner.userContractDT IS NOT NULL '
                + 'AND source_partner.partnerContractDT IS NOT NULL '
                + 'AND source_partner.partnerModifiedDT >= NOW() - INTERVAL 30 DAY '
            + ') AS acceptedLastMonth '

        + 'FROM source_user '
        + 'LEFT JOIN user_partnership_subtotal ON source_user.userID = user_partnership_subtotal.userID;'
    );

    return {
        totalUsers: Number(row?.totalUsers ?? 0),
        usersInPartnerships: Number(row?.usersInPartnerships ?? 0),
        unassignedPartners: Number(row?.unassignedPartners ?? 0),

        partnerships: Number(row?.partnerships ?? 0),
        pendingPartnerships: Number(row?.pendingPartnerships ?? 0),
        availablePartners: Number(row?.availablePartners ?? 0),

        availablePartnerCapacity: Number(row?.availablePartnerCapacity ?? 0),
        filledPartnerCapacity: Number(row?.filledPartnerCapacity ?? 0),

        newUserAverageWaitTimeHours: Number(row?.newUserAverageWaitTimeHours ?? 0),
        wait24Hours: Number(row?.wait24Hours ?? 0),
        wait7Days: Number(row?.wait7Days ?? 0),
        acceptedLastWeek: Number(row?.acceptedLastWeek ?? 0),
        acceptedLastMonth: Number(row?.acceptedLastMonth ?? 0),
    } satisfies DatabasePartnershipStats;
}

