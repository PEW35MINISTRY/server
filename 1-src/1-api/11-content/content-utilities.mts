import axios from 'axios';
import Metascraper from 'metascraper';
import MetascraperImage from 'metascraper-image';
import MetascraperTitle from 'metascraper-title';
import MetascraperDescription from 'metascraper-description';
import { ContentListItem, ContentMetaDataRequestBody } from '../../0-assets/field-sync/api-type-sync/content-types.mjs';
import { ContentSearchFilterEnum, ContentSourceEnum, EDIT_CONTENT_FIELDS, extractYouTubeVideoId, MOBILE_CONTENT_REQUIRE_THUMBNAIL, MOBILE_CONTENT_SUPPORTED_SOURCES } from '../../0-assets/field-sync/input-config-sync/content-field-config.mjs';
import CONTENT_ARCHIVE from '../../2-services/1-models/contentArchiveModel.mjs';
import { downloadImageAndUpload, clearImage } from '../../2-services/10-utilities/image-utilities.mjs';
import { DB_SELECT_CONTENT_BY_URL, DB_UPDATE_CONTENT } from '../../2-services/2-database/queries/content-queries.mjs';
import { ContentMetaDataResponseBody } from '../../0-assets/field-sync/api-type-sync/content-types.mjs';
import * as log from '../../2-services/10-utilities/logging/log.mjs';
import { ImageTypeEnum, JwtSearchRequest } from '../api-types.mjs';


/***************************************
 *  CONTENT SEARCH FILTERING BY SOURCE *
 ***************************************/
export const filterContentList = async (request:JwtSearchRequest, contentList:ContentListItem[], contentSource: keyof typeof ContentSearchFilterEnum):Promise<ContentListItem[]> => {

    if(contentSource === ContentSearchFilterEnum.MOBILE)
        return contentList
            .filter((content:ContentListItem) => MOBILE_CONTENT_SUPPORTED_SOURCES.includes(content.source as ContentSourceEnum)) //Custom strings won't match
            .filter((content:ContentListItem) => !MOBILE_CONTENT_REQUIRE_THUMBNAIL || (content.image !== undefined && content.image.length > 0)); //Thumbnail required for display

    else if(contentSource && contentSource.length > 3 )// Could be Custom Source
        return contentList.filter((content:ContentListItem) => (content.source === contentSource));

    else
        return contentList;
}


/*******************************************
 *  Copy Thumbnail to S3 & Update Database *
 *******************************************/
export const contentCopyImageThumbnail = async(contentModel:CONTENT_ARCHIVE):Promise<CONTENT_ARCHIVE|undefined> => {
    if(contentModel.contentID <= 0) //Assume contentID has not been defined yet but has been saved to database
        contentModel = await DB_SELECT_CONTENT_BY_URL(contentModel.url);

    if(!contentModel.isValid) return undefined;

    const newImageURL:string|undefined = await downloadImageAndUpload({id: contentModel.contentID, imageType: ImageTypeEnum.CONTENT_THUMBNAIL, imageURL: contentModel.image});
    contentModel.image = newImageURL;

    if(newImageURL === undefined)
        return undefined;
        
    else if(await DB_UPDATE_CONTENT(contentModel.contentID, new Map([['image', newImageURL]])) === false) {
        log.error(`Failed to save copied image URL, deleting image and reverting for contentID: ${contentModel.contentID}.`, contentModel.image, newImageURL);
        await clearImage(newImageURL);
        contentModel.image = undefined;
        return undefined;
    }

    return contentModel;
}


/*******************************
 * FETCH METADATA for ARTICLES *
 * https://metascraper.js.org  *
 * Available properties: author, date (published), description, video, audio, image, logo, publisher (company), title, url
 *******************************/
const MetaScraper = Metascraper([
    MetascraperImage(),
    MetascraperTitle(),
    MetascraperDescription(),
  ]);  
  
export const fetchContentMetadata = async({type, source, url}:ContentMetaDataRequestBody): Promise<ContentMetaDataResponseBody|undefined> => {
    try {
      if(type === undefined || source === undefined || url === undefined) {
        
      }
      log.event('Fetching content metadata', url);
      const response = await axios.get(url);
      const html = response.data;
      const metadata = await MetaScraper({ html, url:url });

      if(source === ContentSourceEnum.YOUTUBE) { //Uses smaller image size
        metadata.image = extractYouTubeVideoId(url) ? `https://img.youtube.com/vi/${extractYouTubeVideoId(url)}/hqdefault.jpg` : undefined;
      }
      
      return {
        title: cleanContentTitle(metadata.title),
        description: cleanDescription(metadata.description, metadata.title),
        imageURL: (metadata.image === '') ? undefined : metadata.image,
      };
    } catch (error) {
      log.error(`Error fetching content metadata for ${url}`, error, error.message);
      return undefined;
    }
  };


/* Clean Title from Metadata Fetch */
  const MIN_TITLE_LENGTH:number = 5;
  const cleanContentTitle = (title:string|undefined):string|undefined => {
    if (title === undefined) return undefined;

    const cleanedTitle = title.replace(/\s*\|\s*.*$/, '').trim();
    const minConfigLength:number = EDIT_CONTENT_FIELDS.find(field => field.field === 'title')?.length?.min ?? 0;
    const maxConfigLength:number = EDIT_CONTENT_FIELDS.find(field => field.field === 'title')?.length?.max ?? Number.MAX_SAFE_INTEGER;

    return (cleanedTitle.length < Math.max(minConfigLength, MIN_TITLE_LENGTH)) 
        ? undefined
        : cleanedTitle.length > maxConfigLength
            ? cleanedTitle.slice(0, cleanedTitle.slice(0, maxConfigLength).lastIndexOf(' ')) || cleanedTitle.slice(0, maxConfigLength)
            : cleanedTitle;
  };
  

  /* Clean Description from Metadata Fetch */
  const MIN_DESCRIPTION_LENGTH:number = 10;
  const cleanDescription = (description:string|undefined, title:string|undefined):string|undefined => {
    if(description === undefined) return undefined;

    let cleanedDescription = description.replace(/http[s]?:\/\/\S+|www\.\S+/g, '').trim();
    cleanedDescription = cleanedDescription.replace(title, '').trim();
    cleanedDescription = cleanedDescription.replace(cleanContentTitle(title) || '', '').trim();

    if (cleanedDescription.endsWith('…')) {
        cleanedDescription = cleanedDescription.replace(/[^.!?]*$/, '').trim();
    }

    const minConfigLength:number = EDIT_CONTENT_FIELDS.find(field => field.field === 'description')?.length?.min ?? 0;
    const maxConfigLength:number = EDIT_CONTENT_FIELDS.find(field => field.field === 'description')?.length?.max ?? Number.MAX_SAFE_INTEGER;

    return (cleanedDescription.length < Math.max(minConfigLength, MIN_DESCRIPTION_LENGTH))
        ? undefined
        : cleanedDescription.length > maxConfigLength
            ? cleanedDescription.slice(0, cleanedDescription.slice(0, maxConfigLength).lastIndexOf(' ')) || cleanedDescription.slice(0, maxConfigLength)
            : cleanedDescription;
};
  