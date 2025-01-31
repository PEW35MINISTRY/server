import { ContentListItem } from '../../../0-assets/field-sync/api-type-sync/content-types.mjs';
import { MOBILE_CONTENT_SUPPORTED_SOURCES } from '../../../0-assets/field-sync/input-config-sync/content-field-config.mjs';
import { LIST_LIMIT } from '../../../0-assets/field-sync/input-config-sync/search-config.mjs';
import CONTENT_ARCHIVE from '../../1-models/contentArchiveModel.mjs';
import * as log from '../../10-utilities/logging/log.mjs';
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

export const DB_SELECT_CONTENT_BY_URL = async(url:string):Promise<CONTENT_ARCHIVE> => {
    const rows = await execute('SELECT content.* ' + 'FROM content ' + 'WHERE url = ?', [url]); 

    if(rows.length !== 1) {
        log.warn(`DB ${rows.length ? 'MULTIPLE' : 'NONE'} CONTENT MATCHING IDS IDENTIFIED`, url, JSON.stringify(rows));
        return new CONTENT_ARCHIVE(undefined);
    }    
    return CONTENT_ARCHIVE.constructByDatabase(rows[0] as DATABASE_CONTENT); 
}

//Priority sort by recorderID (created) then latest modified
export const DB_SELECT_OWNED_LATEST_CONTENT_ARCHIVES = async(recorderID:number = -1, onlyOwned:boolean = false, limit:number = LIST_LIMIT):Promise<ContentListItem[]> => {
    const rows = onlyOwned ?
        await execute('SELECT contentID, type, customType, source, customSource, url, image, title, description, likeCount, keywordListStringified ' + 'FROM content '
            + 'WHERE recorderID = ? '
            + `ORDER BY ( recorderID = ? ), content.modifiedDT DESC LIMIT ${limit};`, [recorderID, recorderID])
    
        : await execute('SELECT contentID, type, customType, source, customSource, url, image, title, description, likeCount, keywordListStringified ' + 'FROM content '
            + `ORDER BY ( recorderID = ? ), content.modifiedDT DESC LIMIT ${limit};`, [recorderID]);
 
    return [...rows.map(row => ({contentID: row.contentID || -1, 
        type: row.type, 
        source: row.source, 
        url: row.url || '', image: row.image,
        title: row.title, description: row.description, likeCount: row.likeCount || 0,
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
export const DB_SELECT_CONTENT_SEARCH = async(searchTerm:string, columnList:string[], limit:number = LIST_LIMIT):Promise<ContentListItem[]> => {
    const rows = await execute('SELECT contentID, type, customType, source, customSource, url, image, title, description, likeCount, keywordListStringified ' + 'FROM content '
    + `WHERE ${(columnList.length == 1) ? columnList[0] : `CONCAT_WS( ${columnList.join(`, ' ', `)} )`} LIKE ? `
    + `LIMIT ${limit};`, [`%${searchTerm}%`]);
 
    return [...rows.map(row => ({contentID: row.contentID || -1, 
        type: row.type, 
        source: row.source, 
        url: row.url || '', image: row.image || '',
        title: row.title || '', description: row.description || '', likeCount: row.likeCount || 0,
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
export const DB_SELECT_USER_CONTENT_LIST = async(userID:number, limit:number = LIST_LIMIT):Promise<ContentListItem[]> => {

    const preparedSourceFilter:string = MOBILE_CONTENT_SUPPORTED_SOURCES.map(source => `source = ?`).join(' OR ');

    const rows = await execute('SELECT contentID, type, customType, source, customSource, url, image, title, description, likeCount, keywordListStringified ' 
    + 'FROM content '
    + `WHERE ( ${preparedSourceFilter} ) `
    + 'ORDER BY RAND() '
    + `LIMIT ${limit};`, [...MOBILE_CONTENT_SUPPORTED_SOURCES]);
 
    return [...rows.map(row => ({contentID: row.contentID || -1, 
        type: row.type, 
        source: row.source,  
        url: row.url || '', image: row.image,
        title: row.title, description: row.description, likeCount: row.likeCount || 0,
        keywordList: CONTENT_ARCHIVE.contentArchiveParseKeywordList(row.keywordListStringified)}))];
}
