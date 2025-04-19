import { DeleteObjectCommand, DeleteObjectCommandOutput, PutObjectCommand, PutObjectCommandOutput , S3Client } from '@aws-sdk/client-s3';
import axios from 'axios';
import * as log from './logging/log.mjs';
import { SUPPORTED_IMAGE_EXTENSION_LIST } from '../../0-assets/field-sync/input-config-sync/inputField.mjs';
import { ImageTypeEnum } from '../../1-api/api-types.mjs';
import { getEnvironment, getSHA256Hash, isEnumValue, isURLValid } from './utilities.mjs';
import dotenv from 'dotenv';
dotenv.config(); 



/***************************
 * EXPORTED IMAGE HANDLING *
 ***************************/

  export const isURLImageFormatted = (imageURL:string):boolean => {
    try {
      const parsedUrl = new URL(imageURL);
      const expectedHost = `${process.env.IMAGE_BUCKET_NAME}.s3.amazonaws.com`;
  
      const fileName = parsedUrl.pathname.split('/').pop() ?? '';
      const [imageType, idAndExtension] = fileName.split('_');
      const [id, extension] = idAndExtension ? idAndExtension.split('.') : [undefined, undefined];
  
      return (
        (parsedUrl.hostname === expectedHost)
        && fileName
        && imageType
        && id
        && extension
        && SUPPORTED_IMAGE_EXTENSION_LIST.includes(extension.toLowerCase())
        && isEnumValue(ImageTypeEnum, imageType.toUpperCase())
      );
    } catch(error) {
        log.error('Error validating image URL', imageURL, process.env.IMAGE_BUCKET_NAME, error, error.message);
      return false;
    }
  };

  
export const getImageFileName = ({id, imageType, fileName}:{id:number, imageType:ImageTypeEnum, fileName:string}):string|undefined => {
    const extension = fileName.split('.').pop(); //dot optional
    const currentTime = new Date().getTime().toString();
    const fileNameHash = getSHA256Hash(`${imageType.toLowerCase()}_${id}_${currentTime}`);
    if(SUPPORTED_IMAGE_EXTENSION_LIST.includes(extension)) 
        return `${imageType.toLowerCase()}_${id}_${fileNameHash}.${extension}`;
    else {
        log.error('Image Upload to AWS S3 with unsupported file type.', extension, fileName, imageType, id);
        return undefined;
    }    
}


//Attempts all supported image extensions and return false for any error responses
export const clearImageCombinations = async ({id, imageType}:{id:number, imageType:ImageTypeEnum}):Promise<boolean> =>
    await SUPPORTED_IMAGE_EXTENSION_LIST.reduce(async(previousCall, extension) => {
        const previousResult:boolean = await previousCall;
        return clearImage(getImageFileName({id, imageType, fileName: extension})) && previousResult;
    }, Promise.resolve(true));



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
