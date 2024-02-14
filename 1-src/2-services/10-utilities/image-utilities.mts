import { DeleteObjectCommand, DeleteObjectCommandOutput, PutObjectCommand, PutObjectCommandOutput , S3Client } from '@aws-sdk/client-s3';
import axios from 'axios';
import dotenv from 'dotenv';
import * as log from '../log.mjs';
import { SUPPORTED_IMAGE_EXTENSION_LIST } from '../../0-assets/field-sync/input-config-sync/inputField.mjs';
import { ImageTypeEnum } from '../../1-api/api-types.mjs';
dotenv.config(); 



/***************************
 * EXPORTED IMAGE HANDLING *
 ***************************/
  
export const getImageFileName = ({id, imageType, fileName}:{id:number, imageType:ImageTypeEnum, fileName:string}):string|undefined => {
    const extension = fileName.split('.').pop(); //dot optional
    if(SUPPORTED_IMAGE_EXTENSION_LIST.includes(extension)) 
        return `${imageType.toLowerCase()}_${id}.${extension}`;
    else {
        log.error('Image Upload to AWS S3 with unsupported file type.', extension, fileName, imageType, id);
        return undefined;
    }    
}

export const uploadImage = async({id, imageType, fileName, imageBlob: imageBlob}:{id:number, imageType:ImageTypeEnum, fileName:string, imageBlob:Blob}):Promise<string|undefined> => {
    const imageFileName = getImageFileName({id, imageType, fileName});

    return (imageFileName === undefined) ? undefined
        : (process.env.ENVIRONMENT === 'PRODUCTION') ? uploadImageProduction(imageFileName, imageBlob) : uploadImageDevelopment(imageFileName, imageBlob);
}

//return true for non-error responses
export const clearImage = async(fileName:string):Promise<boolean> => 
    (process.env.ENVIRONMENT === 'PRODUCTION') ? clearImageProduction(fileName) : clearImageDevelopment(fileName);


//Attempts all supported image extensions and return false for any error responses
export const clearImageCombinations = async ({id, imageType}:{id:number, imageType:ImageTypeEnum}):Promise<boolean> =>
    await SUPPORTED_IMAGE_EXTENSION_LIST.reduce(async(previousCall, extension) => {
        const previousResult:boolean = await previousCall;
        return clearImage(getImageFileName({id, imageType, fileName: extension})) && previousResult;
    }, Promise.resolve(true));



 /***************************
 * DEVELOPMENT IMAGE UPLOAD *
 ****************************/
 const DEVELOPMENT_BUCKET_URL:string = `https://3uczw0bwaj.execute-api.${process.env.IMAGE_BUCKET_REGION}.amazonaws.com/prod/${process.env.IMAGE_BUCKET_NAME}`;

/* Development Environment AWS S3 Bucket Upload */
const uploadImageDevelopment = async(fileName:string, imageBlob:Blob):Promise<string|undefined> => 
    await axios.put(`${DEVELOPMENT_BUCKET_URL}/${fileName}`,
            imageBlob,
            { headers: { 'x-api-key': process.env.IMAGE_BUCKET_KEY }})
        .then((response) => {
            log.event('Successful - Development S3 Image Upload', fileName, response.status, response.data);
            return `http://${process.env.IMAGE_BUCKET_NAME}.s3.amazonaws.com/${fileName}`;
        })
        .catch(function (error) {
            log.error('Failed - Development S3 Image Upload', fileName, error);
            return undefined;
        });


const clearImageDevelopment = async(fileName:string):Promise<boolean> => 
    await axios.delete(`${DEVELOPMENT_BUCKET_URL}/${fileName}`,
            { headers: { 'x-api-key': process.env.IMAGE_BUCKET_KEY }})
        .then((response) => {
            log.event('Successful - Development S3 Image Delete', fileName, response.status, response.data);
            return true;
        })
        .catch(function (error) {
            log.error('Failed - Development S3 Image Delete', fileName, error);
            return false;
        });



 /******************************
 * AWS PRODUCTION IMAGE UPLOAD *
 *******************************/

/* Development Environment AWS S3 Bucket Upload | Uses IAM authentication */
const uploadImageProduction = async(fileName:string, imageBlog:Blob):Promise<string|undefined> => {
    try {
        const client = new S3Client({ region: process.env.IMAGE_BUCKET_REGION });

        const command = new PutObjectCommand({
            Bucket: process.env.IMAGE_BUCKET_NAME,
            Key: fileName,
            Body: imageBlog
        });

        const response:PutObjectCommandOutput = await client.send(command);

        if (response?.$metadata?.httpStatusCode === 200) {
            log.event('Successful - Production S3 Image Upload', fileName);
            return `http://${process.env.IMAGE_BUCKET_NAME}.s3.amazonaws.com/${fileName}`;;
        }

        log.error('Failed - Production S3 Image Upload', JSON.stringify(response));
        return undefined;

    } catch(error) {
        log.error('Error - Production S3 Image Upload', error);
        return undefined;
    }
}

const clearImageProduction = async(fileName:string):Promise<boolean> => {
    try {
        const client = new S3Client({ region: process.env.IMAGE_BUCKET_REGION });

        const command = new DeleteObjectCommand({
            Bucket: process.env.IMAGE_BUCKET_NAME,
            Key: fileName
        });

        const response:DeleteObjectCommandOutput = await client.send(command);

        if (response?.$metadata?.httpStatusCode === 204)
            log.event('Successful - Production S3 Image Delete', fileName);
        else
            log.event('Unsuccessful - Production S3 Image Delete', JSON.stringify(response));

        return true;

    } catch(error) {
        log.error('Error - Production S3 Image Delete', error);
        return false;
    }
}
