import { Request, Response, NextFunction } from "express";
import {S3Client, PutObjectCommand, DeleteObjectCommand } from "@aws-sdk/client-s3";
import axios from 'axios';
import * as log from '../services/log.mjs';
import dotenv from 'dotenv';
import { ImageTypeEnum } from "./api-types.mjs";
import { SUPPORTED_IMAGE_EXTENSION_LIST } from "../services/models/Fields-Sync/inputField.mjs";
dotenv.config(); 

  
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


export const clearImage = async(fileName:string):Promise<boolean> => 
    (process.env.ENVIRONMENT === 'PRODUCTION') ? clearImageProduction(fileName) : clearImageDevelopment(fileName);


export const clearImageCombinations = async ({id, imageType}:{id:number, imageType:ImageTypeEnum}):Promise<boolean> =>
    await SUPPORTED_IMAGE_EXTENSION_LIST.reduce(async(previousCall, extension) => {
        const previousResult:boolean = await previousCall;
        return clearImage(getImageFileName({id, imageType, fileName: extension})) || previousResult;
    }, Promise.resolve(false));


/* Development Environment AWS S3 Bucket Upload */
const uploadImageDevelopment = async(fileName:string, imageBlob:Blob):Promise<string|undefined> => 
    await axios.put(`https://3uczw0bwaj.execute-api.${process.env.IMAGE_BUCKET_REGION}.amazonaws.com/prod/${process.env.IMAGE_BUCKET_NAME}/${fileName}`,
            imageBlob,
            { headers: { 'x-api-key': process.env.IMAGE_BUCKET_KEY }})
        .then((response) => {
            log.event('Successful - Development Image Upload', fileName, response.status, response.data);
            return `http://${process.env.IMAGE_BUCKET_NAME}.s3.amazonaws.com/${fileName}`;
        })
        .catch(function (error) {
            log.event('Failed - Development Image Upload', fileName, error);
            return undefined;
        });


const clearImageDevelopment = async(fileName:string):Promise<boolean> => 
    await axios.delete(`https://3uczw0bwaj.execute-api.${process.env.IMAGE_BUCKET_REGION}.amazonaws.com/prod/${process.env.IMAGE_BUCKET_NAME}/${fileName}`,
            { headers: { 'x-api-key': process.env.IMAGE_BUCKET_KEY }})
        .then((response) => {
            log.event('Successful - Development Image Delete', fileName, response.status, response.data);
            return `http://${process.env.IMAGE_BUCKET_NAME}.s3.amazonaws.com/${fileName}`;
        })
        .catch(function (error) {
            log.event('Failed - Development Image Delete', fileName, error);
            return undefined;
        });


/* Development Environment AWS S3 Bucket Upload | Uses IAM authentication */
const uploadImageProduction = async(fileName:string, imageBlog:Blob):Promise<string|undefined> => {
    const client = new S3Client({ region: process.env.IMAGE_BUCKET_REGION });

    const command = new PutObjectCommand({
        Bucket: process.env.IMAGE_BUCKET_NAME,
        Key: fileName,
        Body: imageBlog
    });

    const response = await client.send(command);

    log.event(response.$metadata);

    return (response.$metadata.httpStatusCode > 200 && response.$metadata.httpStatusCode < 300) ? fileName : undefined;
}

const clearImageProduction = async(fileName:string):Promise<boolean> => {
    const client = new S3Client({ region: process.env.IMAGE_BUCKET_REGION });

    const command = new DeleteObjectCommand({
        Bucket: process.env.IMAGE_BUCKET_NAME,
        Key: fileName
    });

    const response = await client.send(command);

    log.event(response.$metadata);

    return (response.$metadata.httpStatusCode > 200 && response.$metadata.httpStatusCode < 300);
}
