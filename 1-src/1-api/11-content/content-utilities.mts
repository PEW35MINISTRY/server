import { ContentListItem } from '../../0-assets/field-sync/api-type-sync/content-types.mjs';
import { ContentSearchFilterEnum, ContentSourceEnum, MOBILE_SUPPORTED_CONTENT_SOURCES } from '../../0-assets/field-sync/input-config-sync/content-field-config.mjs';
import * as log from '../../2-services/log.mjs';
import { JwtSearchRequest } from '../api-types.mjs';


/***************************************
 *  CONTENT SEARCH FILTERING BY SOURCE *
 ***************************************/
export const filterContentList = async (request:JwtSearchRequest, contentList:ContentListItem[], contentSource: keyof typeof ContentSearchFilterEnum):Promise<ContentListItem[]> => {

    if(contentSource === ContentSearchFilterEnum.MOBILE)
        return contentList.filter((content:ContentListItem) => MOBILE_SUPPORTED_CONTENT_SOURCES.includes(content.source as ContentSourceEnum)); //Custom strings won't match

    else if(contentSource && contentSource.length > 3 )// Could be Custom Source
        return contentList.filter((content:ContentListItem) => (content.source === contentSource));

    else
        return contentList;
}
