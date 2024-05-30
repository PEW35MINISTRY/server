import { ContentListItem } from '../../../0-assets/field-sync/api-type-sync/content-types.mjs';
import { MOBILE_SUPPORTED_CONTENT_SOURCES } from '../../../0-assets/field-sync/input-config-sync/content-field-config.mjs';
import CONTENT_ARCHIVE from '../../1-models/contentArchiveModel.mjs';
import * as log from '../../log.mjs';
import { CONTENT_TABLE_COLUMNS, CONTENT_TABLE_COLUMNS_REQUIRED, CommandResponseType, DATABASE_CONTENT } from '../database-types.mjs';
import { command, execute, query, validateColumns } from '../database.mjs';


/***********************************************
/*    DEFINING AND HANDLING ALL QUERIES HERE 
/* TABLES: content
************************************************/

/* Prevent SQL Injection Protocol:
* 1) Use Prepared Statements, auto escape input strings
* 2) Validate Column Names
* - Use execute() for Prepared Statements (inputs)
* - Use query() for predefined Select Statements (static)
* - Use command() for database operation (inputs)
*/

/* REQUIRED VALIDATION ONLY WHEN COLUMNS ARE INPUTS */
const validateContentColumns = (inputMap:Map<string, any>, includesRequired:boolean = false):boolean => 
    validateColumns(inputMap, includesRequired, CONTENT_TABLE_COLUMNS, CONTENT_TABLE_COLUMNS_REQUIRED);

/********************
 *  CONTENT QUERIES
 ********************/
export const DB_SELECT_CONTENT = async(contentID:number):Promise<CONTENT_ARCHIVE> => {
    const rows = await execute('SELECT content.*, '
    + 'user.firstName as recorderFirstName, user.displayName as recorderDisplayName, user.image as recorderImage '
    + 'FROM content '
    + 'LEFT JOIN user ON user.userID = content.recorderID '
    + 'WHERE contentID = ?', [contentID]); 

    if(rows.length !== 1) {
        log.warn(`DB ${rows.length ? 'MULTIPLE' : 'NONE'} CONTENT MATCHING IDS IDENTIFIED`, contentID, JSON.stringify(rows));
        return new CONTENT_ARCHIVE(undefined);
    }
    
    const content = CONTENT_ARCHIVE.constructByDatabase(rows[0] as DATABASE_CONTENT); 
    content.recorderProfile = {userID: rows[0].recorderID, firstName: rows[0].recorderFirstName, displayName: rows[0].recorderDisplayName, image: rows[0].recorderImage};
    return content;
}

//Priority sort by recorderID (created) then latest modified
export const DB_SELECT_OWNED_LATEST_CONTENT_ARCHIVES = async(recorderID:number = -1, onlyOwned:boolean = false):Promise<ContentListItem[]> => {
    const rows = onlyOwned ?
        await execute('SELECT contentID, type, customType, source, customSource, url, title, description, likeCount, keywordListStringified ' + 'FROM content '
            + 'WHERE recorderID = ? '
            + 'ORDER BY ( recorderID = ? ), content.modifiedDT DESC LIMIT 50;', [recorderID, recorderID])
    
        : await execute('SELECT contentID, type, source, url, description, keywordListStringified ' + 'FROM content '
            + 'ORDER BY ( recorderID = ? ), content.modifiedDT DESC LIMIT 50;', [recorderID]);
 
    return [...rows.map(row => ({contentID: row.contentID || -1, 
        type: (row.type === 'CUSTOM' ? row.customType : row.type) || '', 
        source: (row.source === 'CUSTOM' ? row.customSource : row.source) || '', 
        url: row.url || '',
        title: row.title || '', description: row.description || '', likeCount: row.likeCount,
        keywordList: CONTENT_ARCHIVE.contentArchiveParseKeywordList(row.keywordListStringified)}))];
}


/********************
 *  CONTENT QUERIES
 ********************/
export const DB_INSERT_CONTENT = async(fieldMap:Map<string, any>):Promise<boolean> => {
    //Validate Columns prior to Query
    if(!validateContentColumns(fieldMap)) {
        log.db('Query Rejected: DB_INSERT_CONTENT; invalid column names', JSON.stringify(Array.from(fieldMap.keys())));
        return false;
    }

    const preparedColumns:string = Array.from(fieldMap.keys()).map((key, field)=> `${key}`).join(', ');
    const preparedValues:string = Array.from(fieldMap.keys()).map((key, field)=> `?`).join(', ');

    const response:CommandResponseType = await command(`INSERT INTO content ( ${preparedColumns} ) VALUES ( ${preparedValues} );`, Array.from(fieldMap.values())); 
    
    return ((response !== undefined) && (response.affectedRows === 1));
}

export const DB_UPDATE_CONTENT = async(contentID:number, fieldMap:Map<string, any>):Promise<boolean> => {
    //Validate Columns prior to Query
    if(!validateContentColumns(fieldMap)) {
        log.db('Query Rejected: DB_UPDATE_CONTENT; invalid column names', JSON.stringify(Array.from(fieldMap.keys())));
        return false;
    }

    const preparedColumns:string = Array.from(fieldMap.keys()).map((key, field)=> `${key} = ?`).join(', ');

    const response:CommandResponseType = await command(`UPDATE content SET ${preparedColumns} WHERE contentID = ?;`, [...Array.from(fieldMap.values()), contentID]); 

    return ((response !== undefined) && (response.affectedRows === 1));
}

export const DB_DELETE_CONTENT = async(contentID:number):Promise<boolean> => { //Note: Database Reinforces Key constrains
    log.db(`DELETE CONTENT ARCHIVE attempted: contentID:${contentID}`);

    const response:CommandResponseType = await command('DELETE FROM content WHERE contentID = ?;', [contentID]);

    return ((response !== undefined) && (response.affectedRows === 1));
}


/***************************
 *  CONTENT SEARCH QUERIES
 ***************************/
//https://code-boxx.com/mysql-search-exact-like-fuzzy/
export const DB_SELECT_CONTENT_SEARCH = async(searchTerm:string, columnList:string[]):Promise<ContentListItem[]> => {
    const rows = await execute('SELECT contentID, type, customType, source, customSource, url, title, description, likeCount, keywordListStringified ' + 'FROM content '
    + `WHERE ${(columnList.length == 1) ? columnList[0] : `CONCAT_WS( ${columnList.join(`, ' ', `)} )`} LIKE ? `
    + 'LIMIT 30;', [`%${searchTerm}%`]);
 
    return [...rows.map(row => ({contentID: row.contentID || -1, 
        type: (row.type === 'CUSTOM' ? row.customType : row.type) || '', 
        source: (row.source === 'CUSTOM' ? row.customSource : row.source) || '', 
        url: row.url || '', 
        title: row.title || '', description: row.description || '', likeCount: row.likeCount,
        keywordList: CONTENT_ARCHIVE.contentArchiveParseKeywordList(row.keywordListStringified)}))];
}

export const DB_UPDATE_INCREMENT_CONTENT_LIKE_COUNT = async(contentID:number):Promise<boolean> => {

    const response:CommandResponseType = await command(`UPDATE content SET likeCount = (likeCount + 1) WHERE contentID = ?;`, [contentID]); 

    return ((response !== undefined) && (response.affectedRows === 1));
}

/*************************
 *  TARGETED USER CONTENT
 *************************/
//TODO Develop Algorithm to refine content to each User
export const DB_SELECT_USER_CONTENT_LIST = async(userID:number):Promise<ContentListItem[]> => {

    const preparedSourceFilter:string = MOBILE_SUPPORTED_CONTENT_SOURCES.map(source => `source = ?`).join(' OR ');

    const rows = await execute('SELECT contentID, type, customType, source, customSource, url, title, description, likeCount, keywordListStringified ' 
    + 'FROM content '
    + `WHERE ( ${preparedSourceFilter} ) `
    + 'LIMIT 50;', [...MOBILE_SUPPORTED_CONTENT_SOURCES]);
 
    return [...rows.map(row => ({contentID: row.contentID || -1, 
        type: (row.type === 'CUSTOM' ? row.customType : row.type) || '', 
        source: (row.source === 'CUSTOM' ? row.customSource : row.source) || '', 
        url: row.url || '', 
        title: row.title || '', description: row.description || '', likeCount: row.likeCount,
        keywordList: CONTENT_ARCHIVE.contentArchiveParseKeywordList(row.keywordListStringified)}))];
}
