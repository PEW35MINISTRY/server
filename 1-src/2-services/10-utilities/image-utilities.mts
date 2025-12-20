import { DeleteObjectCommand, DeleteObjectCommandOutput, DeleteObjectsCommand, ListObjectsV2Command, PutObjectCommand, PutObjectCommandOutput , S3Client } from '@aws-sdk/client-s3';
import axios from 'axios';
import * as log from './logging/log.mjs';
import { SUPPORTED_IMAGE_EXTENSION_LIST } from '../../0-assets/field-sync/input-config-sync/inputField.mjs';
import { ImageTypeEnum } from '../../1-api/api-types.mjs';
import { getEnvironment } from './env-utilities.mjs';
import { getSHA256Hash } from './utilities.mjs';
import { isURLValid } from '../../0-assets/field-sync/input-config-sync/inputValidation.mjs';



/***************************
 * EXPORTED IMAGE HANDLING *
 ***************************/
//Test URL to fit system hosted and 'ImageType_ID' prefix format
export const isURLImageFormatted = (imageURL:string):boolean => {
    try {
        const parsedUrl:URL = new URL(imageURL);
        const fileName:string = parsedUrl.pathname.split('/').pop() ?? '';

        const match = fileName.match(/_(\d+)/);

        return (
            parsedUrl.hostname === `${process.env.IMAGE_BUCKET_NAME}.s3.amazonaws.com`
            && !!match
            && !Number.isNaN(Number(match[1]))
            && Object.values(ImageTypeEnum).some(imageType => 
                fileName.startsWith(getImageFileNamePrefix({ id: Number(match[1]), imageType })
            ))
        );
    } catch (error) {
        log.error('Error validating image URL', imageURL, process.env.IMAGE_BUCKET_NAME, error, error.message);
        return false;
    }
};


const getImageFileNamePrefix = ({ id, imageType }:{ id:number, imageType:ImageTypeEnum }):string => `${imageType.toLowerCase()}_${id}`;

  
export const getImageFileName = ({id, imageType, fileName}:{id:number, imageType:ImageTypeEnum, fileName:string}):string|undefined => {
    const extension = fileName.split('.').pop(); //dot optional
    const currentTime = new Date().getTime().toString();
    const fileNameHash = getSHA256Hash(`${getImageFileNamePrefix({id, imageType})}_${currentTime}`);
    if(SUPPORTED_IMAGE_EXTENSION_LIST.includes(extension)) 
        return `${getImageFileNamePrefix({id, imageType})}_${fileNameHash}.${extension}`;
    else {
        log.error('Image Upload to AWS S3 with unsupported file type.', extension, fileName, imageType, id);
        return undefined;
    }    
}


 /******************************
 * AWS PRODUCTION IMAGE UPLOAD *
 *******************************/
/* Development Environment AWS S3 Bucket Upload | Uses IAM authentication */
export const uploadImage = async({id, imageType, fileName, imageBlob: imageBlob}:{id:number, imageType:ImageTypeEnum, fileName:string, imageBlob:Blob|Buffer}):Promise<string|undefined> => {
    try {
        const imageFileName = getImageFileName({id, imageType, fileName});
        if(imageFileName === undefined)
            throw new Error('INVALID - fileName attempted to upload image');

        const client = new S3Client({ region: process.env.IMAGE_BUCKET_REGION });
        const command = new PutObjectCommand({
            Bucket: process.env.IMAGE_BUCKET_NAME,
            Key: imageFileName,
            Body: imageBlob
        });

        const response:PutObjectCommandOutput = await client.send(command);

        if (response?.$metadata?.httpStatusCode === 200) {
            log.event(`Successful - ${getEnvironment()} | ${process.env.IMAGE_BUCKET_NAME} S3 Image Upload`, imageFileName);
            return `https://${process.env.IMAGE_BUCKET_NAME}.s3.amazonaws.com/${imageFileName}`;
        }

        log.error(`Failed - ${getEnvironment()} | ${process.env.IMAGE_BUCKET_NAME} S3 Image Upload`, JSON.stringify(response));
        return undefined;

    } catch(error) {
        log.error(`Error - ${getEnvironment()} | ${process.env.IMAGE_BUCKET_NAME} S3 Image Upload`, error, error.message);
        return undefined;
    }
}

//return true for non-error responses
export const clearImage = async(fileName:string):Promise<boolean> => {
    try {
        if(fileName.includes('demo')) {
            log.warn('Blocking delete of demo image: ', fileName);
            return true; //Allow sequential image upload & replacement
        }

        const client = new S3Client({ region: process.env.IMAGE_BUCKET_REGION });
        const command = new DeleteObjectCommand({
            Bucket: process.env.IMAGE_BUCKET_NAME,
            Key: fileName
        });

        const response:DeleteObjectCommandOutput = await client.send(command);

        if (response?.$metadata?.httpStatusCode === 204)
            log.event(`Successful - ${getEnvironment()} | ${process.env.IMAGE_BUCKET_NAME} S3 Image Delete`, fileName);
        else
            log.event(`Failed - ${getEnvironment()} | ${process.env.IMAGE_BUCKET_NAME} S3 Image Delete`, JSON.stringify(response));

        return true;

    } catch(error) {
        log.error(`Error - ${getEnvironment()} | ${process.env.IMAGE_BUCKET_NAME} S3 Image Delete`, error, error.message);
        return false;
    }
}


//Searches & deletes all matching prefix: `ImageType_ID` | Returns true on non error
export const clearImageByID = async ({ id, imageType }:{ id:number, imageType:ImageTypeEnum }):Promise<boolean> => {
    const prefix = getImageFileNamePrefix({ id, imageType });
    try {
        const client = new S3Client({ region: process.env.IMAGE_BUCKET_REGION });
        const listResponse = await client.send(
            new ListObjectsV2Command({
                Bucket: process.env.IMAGE_BUCKET_NAME,
                Prefix: prefix,
            }));
        const objectsToDelete = listResponse.Contents;

        if(!objectsToDelete || objectsToDelete.length === 0)
            return true;

        const deleteResponse = await client.send(
            new DeleteObjectsCommand({
                Bucket: process.env.IMAGE_BUCKET_NAME,
                Delete: { Objects: (listResponse.Contents || []).map(obj => ({ Key: obj.Key! })) },
            }));

        log.event(`Deleted ${deleteResponse?.Deleted?.length || 0} images with prefix`, prefix);
        return true;

    } catch(error) {
        log.error(`Error deleting images with prefix ${prefix}`, error, error?.message);
        return false;
    }
}


 /********************************
 *   IMAGE DOWNLOAD & S3 UPLOAD  *
 *    Copy image to S3 bucket    *
 ********************************/
export const downloadImageAndUpload = async({id, imageType, imageURL}:{id:number, imageType:ImageTypeEnum, imageURL:string}):Promise<string|undefined> => {
    if(isURLImageFormatted(imageURL))
        return imageURL;
    else if(!isURLValid(imageURL)) {
        log.warn(`Invalid URL, unable to download image and re-upload for ${id} ${imageType}`, imageURL);
        return undefined;
    }

    try {
        const response = await axios.get(imageURL, { responseType: 'arraybuffer' });
        const imageBuffer = Buffer.from(response.data);
        const fileName = imageURL.split('/').pop() || 'invalid.txt';
    
        return await uploadImage({ id, imageType, fileName, imageBlob:imageBuffer });

      } catch (error) {
        log.warn(`Error fetching image blob for ${id} ${imageType}`, imageURL, error, error.message);
        return undefined;
      }
}
