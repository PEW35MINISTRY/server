import { RowDataPacket } from 'mysql2/promise';
import { PartnerListItem, ProfileListItem, ProfilePartnerCountListItem } from '../../../0-assets/field-sync/api-type-sync/profile-types.mjs';
import USER from '../../1-models/userModel.mjs';
import * as log from '../../log.mjs';
import { CommandResponseType, DATABASE_PARTNER_STATUS_ENUM } from '../database-types.mjs';
import { query, execute, command, validateColumns, batch } from '../database.mjs';
import { PartnerStatusEnum } from '../../../0-assets/field-sync/input-config-sync/profile-field-config.mjs';


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
const convertDatabaseStatus = (userID:number, partnerID:number, status:DATABASE_PARTNER_STATUS_ENUM):DATABASE_PARTNER_STATUS_ENUM => 
    ((userID === getPartnerID(userID, partnerID)) && (status === DATABASE_PARTNER_STATUS_ENUM.PENDING_CONTRACT_USER)) ? DATABASE_PARTNER_STATUS_ENUM.PENDING_CONTRACT_PARTNER
    : ((userID === getPartnerID(userID, partnerID)) && (status === DATABASE_PARTNER_STATUS_ENUM.PENDING_CONTRACT_PARTNER)) ? DATABASE_PARTNER_STATUS_ENUM.PENDING_CONTRACT_USER
    : status;


/*********************
 *  PARTNER QUERIES  *
 *********************/
export const DB_IS_USER_PARTNER_ANY_STATUS = async(userID:number, clientID:number, statusList:DATABASE_PARTNER_STATUS_ENUM[] = [DATABASE_PARTNER_STATUS_ENUM.PARTNER]):Promise<boolean> => {
    
    if(statusList === undefined || statusList.length === 0) return false;

    const preparedColumns:string = '( ' + statusList.map((key)=> `status = ?`).join(' OR ') + ' )';

    const rows = await execute('SELECT * ' + 'FROM partner '
        + `WHERE userID = ? AND partnerID = ? AND ${preparedColumns};`, [getUserID(userID, clientID), getPartnerID(userID, clientID), ...statusList]);

    if(rows.length > 1) log.db(`DB_IS_ANY_USER_PARTNER MULTIPLE RECORDS for partnership IDENTIFIED`, userID, clientID, status, JSON.stringify(rows));

    return (rows.length > 0);
}

export const DB_SELECT_PARTNER_STATUS = async(userID:number, clientID:number):Promise<PartnerStatusEnum|undefined> => {
    const rows = await execute('SELECT status ' + 'FROM partner '
        + 'WHERE userID = ? AND partnerID = ?;', [getUserID(userID, clientID), getPartnerID(userID, clientID)]);

    if(rows.length !== 1) log.db(`DB_SELECT_PARTNER_STATUS ${(rows.length > 1) ? 'MULTIPLE' : 'NONE'} RECORDS for partnership IDENTIFIED`, userID, clientID, JSON.stringify(rows));

    return (rows.length > 0) ? rows[0].status : undefined;
}



export const DB_SELECT_PARTNER_LIST = async(userID:number, status:DATABASE_PARTNER_STATUS_ENUM = DATABASE_PARTNER_STATUS_ENUM.PARTNER):Promise<PartnerListItem[]> => {
    //Post Filter to match userID perspective
    if(status === DATABASE_PARTNER_STATUS_ENUM.PENDING_CONTRACT_USER 
               || status === DATABASE_PARTNER_STATUS_ENUM.PENDING_CONTRACT_PARTNER) {
       
        return (await DB_SELECT_PENDING_PARTNER_LIST(userID))
                .filter((partner:PartnerListItem) => (DATABASE_PARTNER_STATUS_ENUM[partner.status] === status));
    
    } else {
        const rows:RowDataPacket[] = await execute('SELECT user.*, status, partnerID ' + 'FROM partner '
            + 'LEFT JOIN user ON (partner.userID = user.userID OR partner.partnerID = user.userID) '
            + 'WHERE user.userID = ? AND status = ?;', [userID, status]);

        return [...rows.map(row => ({userID: row.userID || -1, firstName: row.firstName || '', displayName: row.displayName || '', image: row.image || '',
            status: PartnerStatusEnum[convertDatabaseStatus(userID, row.partnerID, row.status)]}))];
    }   
}


export const DB_SELECT_PENDING_PARTNER_LIST = async(userID?:number):Promise<PartnerListItem[]> => {
    //Post Filter to match userID perspective
    const rows:RowDataPacket[] = (userID !== undefined) ?    
        await execute('SELECT user.*, status, partnerID ' + 'FROM partner '
            + 'LEFT JOIN user ON (partner.userID = user.userID OR partner.partnerID = user.userID) '
            + `WHERE user.userID = ? AND (status = 'PENDING_CONTRACT_BOTH' OR status = 'PENDING_CONTRACT_USER' OR status = 'PENDING_CONTRACT_PARTNER');`
            , [userID])

        : await query('SELECT user.*, status, partnerID ' + 'FROM partner '
            + 'LEFT JOIN user ON (partner.userID = user.userID OR partner.partnerID = user.userID) '
            + `WHERE (status = 'PENDING_CONTRACT_BOTH' OR status = 'PENDING_CONTRACT_USER' OR status = 'PENDING_CONTRACT_PARTNER');`
            );

    return [...rows.map(row => ({userID: row.userID || -1, firstName: row.firstName || '', displayName: row.displayName || '', image: row.image || '',
                                status: PartnerStatusEnum[convertDatabaseStatus(userID || -1, row.partnerID, row.status)]}))];
}


/*******************
 *  PARTNER STATUS *
 *******************/
export const DB_ASSIGN_PARTNER_STATUS = async(userID:number, clientID:number, status:DATABASE_PARTNER_STATUS_ENUM = DATABASE_PARTNER_STATUS_ENUM.PENDING_CONTRACT_BOTH):Promise<boolean> => {
    const response:CommandResponseType = await command('INSERT INTO partner ( userID, partnerID, status ) VALUES (?, ?, ?) '
    + 'ON DUPLICATE KEY UPDATE status = ?;',
     [getUserID(userID, clientID), getPartnerID(userID, clientID), status, status]);

    return ((response !== undefined) && (response.affectedRows > 0));
}


export const DB_DELETE_PARTNERSHIP = async(userID:number, clientID?:number):Promise<boolean> => {    
    log.db(`DELETE PARTNERSHIP attempted: userID:${userID} and clientID:${clientID} with status:${(clientID === undefined) ? 'ALL PARTNER CONNECTIONS' : 'Single Partnership'}`);

    const response:CommandResponseType = (clientID === undefined) //Delete all partnership connections
        ? await command('DELETE FROM partner WHERE userID = ? OR partnerID = ?;', [userID, userID])

        : await command('DELETE FROM partner WHERE userID = ? AND partnerID = ?;', [getUserID(userID, clientID), getPartnerID(userID, clientID)]);

    return (response !== undefined);  //Success on non-error
}



/***************************
 *  NEW PARTNER SEARCH     *
 * (Requires STUDENT role) *
 ***************************/
export const DB_SELECT_AVAILABLE_PARTNER_LIST = async(user:USER): Promise<ProfileListItem[]> => {
    const matchGender:boolean = (process.env.PARTNER_GENDER_MATCH !== undefined) ? (process.env.PARTNER_GENDER_MATCH === 'true') : true;
    const ageYearRange: number = (process.env.PARTNER_AGE_RANGE !== undefined) ? parseInt(process.env.PARTNER_AGE_RANGE) : 2;
    const minDateOfBirth:Date = new Date(user.dateOfBirth);
    minDateOfBirth.setFullYear(user.dateOfBirth.getFullYear() - ageYearRange);
    const maxDateOfBirth:Date = new Date(user.dateOfBirth);
    maxDateOfBirth.setFullYear(user.dateOfBirth.getFullYear() + ageYearRange);
    const walkLevelRange: number = (process.env.PARTNER_WALK_RANGE !== undefined) ? parseInt(process.env.PARTNER_WALK_RANGE) : 2;

    const rows:RowDataPacket[] = await execute(
        'SELECT DISTINCT user.userID, user.firstName, user.displayName, user.image '
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
        + 'AND partner.userID IS NULL AND partner.partnerID IS NULL '
        + 'AND ( ? = true OR user.gender = ? ) '
        + `AND user.dateOfBirth BETWEEN ? AND ? `
        + 'AND user.walkLevel BETWEEN ? AND ? '
        + 'AND ( user.maxPartners > ( '
        + `    SELECT COUNT(*) FROM partner WHERE (userID = user.userID OR partnerID = user.userID) AND status NOT IN ('FAILED', 'ENDED') `
        + ')) '
        + `AND ( user_role_defined.userRole = 'STUDENT' OR user_role.userID IS NULL ) ` //Student user role
        + 'AND NOT EXISTS ( '
        + '    SELECT 1 '
        + '    FROM user_role '
        + '    JOIN user_role_defined ON user_role.userRoleID = user_role_defined.userRoleID '
        + `    WHERE user.userID = user_role.userID AND user_role_defined.userRole IN ('REPORTED', 'INACTIVE')`
        + ') '
        + 'ORDER BY COALESCE( partnerCounts.partnerCount, 0 ) ASC ' //Prioritize without any partners
        + 'LIMIT 10;'

    , [ user.userID,
        user.userID,
        user.userID,
        matchGender,
        user.gender,
        minDateOfBirth.toISOString(),
        maxDateOfBirth.toISOString(),
        user.walkLevel - walkLevelRange,
        user.walkLevel + walkLevelRange,
    ]);

    return [...rows.map(row => ({userID: row.userID || -1, firstName: row.firstName || '', displayName: row.displayName || '', image: row.image || ''}))];
}


/*********************************
 *  ADMIN PARTNER STATUS QUERIES *
 *********************************/
//Only Student Role and top 100 oldest users w/o active partners
export const DB_SELECT_UNASSIGNED_PARTNER_USER_LIST = async():Promise<ProfileListItem[]> => {
    const rows:RowDataPacket[] = await query(
        'SELECT DISTINCT user.userID, user.firstName, user.displayName, user.image ' 
        + 'FROM user '
        + 'LEFT JOIN user_role ON user.userID = user_role.userID '
        + 'LEFT JOIN user_role_defined ON user_role.userRoleID = user_role_defined.userRoleID '
        + 'LEFT JOIN partner ON (partner.userID = user.userID OR partner.partnerID = user.userID) '
        + `WHERE (user_role_defined.userRole = 'STUDENT' OR user_role.userID IS NULL) `
        + '    AND ((partner.userID IS NULL AND partner.partnerID IS NULL) '
        + `        OR (partner.status IN ('FAILED', 'ENDED') `
        + `            AND user.userID NOT IN (SELECT userID FROM partner WHERE status NOT IN ('FAILED', 'ENDED')))) `
        + 'ORDER BY user.createdDT ASC ' //Oldest Users
        + 'LIMIT 100;');

    return [...rows.map(row => ({userID: row.userID || -1, firstName: row.firstName || '', displayName: row.displayName || '', image: row.image || ''}))];
}

//Latest 100 Users with Student Role
export const DB_SELECT_PARTNER_STATUS_MAP = async(filterFewerPartners:boolean = false):Promise<ProfilePartnerCountListItem[]> => {

    const totalByStatus:string = Object.values(PartnerStatusEnum)
        .map((status) => `COALESCE(SUM(CASE WHEN partner.status = '${status}' THEN 1 ELSE 0 END), 0) ${status}`).join(', ');

    const rows:RowDataPacket[] = await query(
            `SELECT user.userID, user.firstName, user.displayName, user.image, user.maxPartners, ${totalByStatus} ` 
            + 'FROM user '
            + 'LEFT JOIN user_role ON user.userID = user_role.userID '
            + 'LEFT JOIN user_role_defined ON user_role.userRoleID = user_role_defined.userRoleID '
            + 'LEFT JOIN partner ON (partner.userID = user.userID OR partner.partnerID = user.userID) '
            + `WHERE (user_role_defined.userRole = 'STUDENT' OR user_role.userID IS NULL) `
            + 'GROUP BY user.userID '
            + `${filterFewerPartners ?
                `HAVING SUM(CASE WHEN partner.status NOT IN ('FAILED', 'ENDED') THEN 1 ELSE 0 END) < user.maxPartners ` : ''}`
            + 'ORDER BY user.createdDT DESC ' //Newest Users
            + 'LIMIT 100;');

    //Note: Express can't serialize Maps, so returning a [key, value] pair array
    return rows.map(row => ({userID: row.userID || -1, firstName: row.firstName || '', displayName: row.displayName || '', image: row.image || '',
                                maxPartners: row.maxPartners, 
                                partnerCountMap: Object.values(PartnerStatusEnum).map(status => [status, parseInt(row[status] || '0')])}));
}
