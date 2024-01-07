import { ContentListItem } from '../../0-assets/field-sync/api-type-sync/content-types.mjs';
import { ContentSearchFilterEnum } from '../../0-assets/field-sync/input-config-sync/content-field-config.mjs';
import CONTENT_ARCHIVE from '../../2-services/1-models/contentArchiveModel.mjs';
import { DB_SELECT_CONTENT, DB_SELECT_CONTENT_SEARCH, DB_SELECT_OWNED_LATEST_CONTENT_ARCHIVES } from '../../2-services/2-database/queries/content-queries.mjs';
import * as log from '../../2-services/log.mjs';



/********************
 *  CONTENT SEARCH 
 ********************/
export const searchContentArchiveList = async(searchTerm:string, searchFilter:ContentSearchFilterEnum = ContentSearchFilterEnum.ALL, userID:number = -1):Promise<ContentListItem[]> => {
    const contentArchiveList:ContentListItem[] = [];
    
    if(searchFilter === ContentSearchFilterEnum.ID) {
        const contentArchive:CONTENT_ARCHIVE = await DB_SELECT_CONTENT(parseInt(searchTerm.trim()));

        if(contentArchive.isValid) contentArchiveList.push(contentArchive.toListItem());

    }  else if(searchFilter === ContentSearchFilterEnum.RECORDER_ID) {
        contentArchiveList.push(...(await DB_SELECT_OWNED_LATEST_CONTENT_ARCHIVES(parseInt(searchTerm.trim()), true)));
    
    } else {
        const columnList:string[] = (searchFilter === ContentSearchFilterEnum.TYPE) ? ['type', 'customType']
            : (searchFilter === ContentSearchFilterEnum.SOURCE) ? ['source', 'customSource']
            : (searchFilter === ContentSearchFilterEnum.KEYWORD) ? ['keywordListStringified']
            : (searchFilter === ContentSearchFilterEnum.DESCRIPTION) ? ['name', 'description']
            : (searchFilter === ContentSearchFilterEnum.NOTES) ? ['notes']
            : ['url', 'keywordListStringified', 'description']; //ALL

        //No minimum searchTerm length
        contentArchiveList.push(...(await DB_SELECT_CONTENT_SEARCH(searchTerm, columnList)));
    }

    if(contentArchiveList.length === 0) log.event('Content search resulted in zero matches', searchTerm, searchFilter);

    return contentArchiveList;
}

