import express, { NextFunction, Request, Response, Router } from 'express';
import { JwtClientRequest, JwtContentRequest, JwtRequest } from '../2-auth/auth-types.mjs';
import { Exception } from '../api-types.mjs';
import * as log from '../../2-services/log.mjs';
import { DB_DELETE_CONTENT, DB_INSERT_CONTENT, DB_SELECT_CONTENT, DB_SELECT_OWNED_LATEST_CONTENT_ARCHIVES, DB_SELECT_USER_CONTENT_LIST, DB_UPDATE_CONTENT, DB_UPDATE_INCREMENT_CONTENT_LIKE_COUNT } from '../../2-services/2-database/queries/content-queries.mjs';
import { RoleEnum } from '../../0-assets/field-sync/input-config-sync/profile-field-config.mjs';
import InputField from '../../0-assets/field-sync/input-config-sync/inputField.mjs';
import CONTENT_ARCHIVE from '../../2-services/1-models/contentArchiveModel.mjs';
import { CONTENT_TABLE_COLUMNS_REQUIRED } from '../../2-services/2-database/database-types.mjs';
import { EDIT_CONTENT_FIELDS, EDIT_CONTENT_FIELDS_ADMIN } from '../../0-assets/field-sync/input-config-sync/content-field-config.mjs';



/*******************************
 *  USER CURATED CONTENT LIST  *
 *******************************/
export const GET_UserContentList = async(request:JwtClientRequest, response:Response, next:NextFunction) => {
    response.status(200).send(await DB_SELECT_USER_CONTENT_LIST(request.clientID));
};


/***************************************
 *  INDIVIDUAL Content Archive Detail
 ***************************************/
export const GET_ContentRequest = async (request: JwtContentRequest, response: Response, next: NextFunction) => {
    const contentArchive = await DB_SELECT_CONTENT(request.contentID);
    
    if(contentArchive.isValid) {
        response.status(200).send(contentArchive.toJSON());
        log.event('Returning specific Content Archive:', request.contentID);

    } else //Necessary; otherwise no response waits for timeout | Ignored if next() already replied
        next(new Exception(404, `GET_ContentRequest - Content Archive ${request.contentID} Failed to parse from database and is invalid`, 'Missing Content'));
};


export const POST_contentIncrementLikeCount = async (request: JwtContentRequest, response: Response, next: NextFunction) => {
    
    if(await DB_UPDATE_INCREMENT_CONTENT_LIKE_COUNT(request.contentID) === false)
        next(new Exception(500, `Failed to Incremented Content Like Count ${request.contentID}`, 'Failed to Save'));

    else {
        response.status(200).send(`Content Like Count Incremented for content ${request.contentID}`);
        log.event(`Incremented like count for content: ${request.contentID}`);
    }
};


/*************************
 *  EDIT Content Archive
 *************************/
export const POST_newContentArchive =  async(request: JwtRequest, response: Response, next: NextFunction) => {
    const FIELD_LIST:InputField[] = (request.jwtUserRole === RoleEnum.ADMIN) ? EDIT_CONTENT_FIELDS_ADMIN : EDIT_CONTENT_FIELDS;

    const newContentArchive:CONTENT_ARCHIVE|Exception = CONTENT_ARCHIVE.constructByJson({jsonObj:request.body, fieldList: FIELD_LIST});

    if(!(newContentArchive instanceof Exception)) {
        const recorderID:number = ((request.jwtUserRole === RoleEnum.ADMIN) && request.body['recorderID'] !== undefined) ? request.body['recorderID'] : request.jwtUserID;
        newContentArchive.recorderID = recorderID;

        if(CONTENT_TABLE_COLUMNS_REQUIRED.every((column) => newContentArchive[column] !== undefined) === false) 
            next(new Exception(400, `Create Content Archive Failed :: Missing Required Fields: ${JSON.stringify(CONTENT_TABLE_COLUMNS_REQUIRED)}.`, 'Missing Details'));

        else if(await DB_INSERT_CONTENT(newContentArchive.getDatabaseProperties()) === false) 
                next(new Exception(500, 'Create Content Archive  Failed :: Failed to save new Content Archive to database.', 'Save Failed'));

        else               
            response.status(201).send(newContentArchive.toJSON());

    } else
        next(newContentArchive);
};


export const PATCH_contentArchive =  async(request: JwtContentRequest, response: Response, next: NextFunction) => {
    const FIELD_LIST:InputField[] = (request.jwtUserRole === RoleEnum.ADMIN) ? EDIT_CONTENT_FIELDS_ADMIN : EDIT_CONTENT_FIELDS;

    const currentContentArchive:CONTENT_ARCHIVE = await DB_SELECT_CONTENT(request.contentID);

    const editContentArchive:CONTENT_ARCHIVE|Exception = CONTENT_ARCHIVE.constructAndEvaluateByJson({currentModel: currentContentArchive, jsonObj:request.body, fieldList: FIELD_LIST});

    if(currentContentArchive.isValid && !(editContentArchive instanceof Exception) && editContentArchive.isValid) {  //undefined handles next(Exception)
        
        if((editContentArchive.getUniqueDatabaseProperties(currentContentArchive).size > 0 )
                && await DB_UPDATE_CONTENT(request.contentID, editContentArchive.getUniqueDatabaseProperties(currentContentArchive)) === false) 
            next(new Exception(500, `Edit Content Archive Failed :: Failed to update Content Archive ${request.contentID}.`, 'Save Failed'));

        else {
            response.status(202).send(editContentArchive.toJSON());
        }
    } else //Necessary; otherwise no response waits for timeout | Ignored if next() already replied
        next((editContentArchive instanceof Exception) ? editContentArchive
            : new Exception(500, `PATCH_editContentArchive - Content Archive ${request.contentID} Failed to parse from database and is invalid`, 'Invalid Content')); 
};


export const DELETE_contentArchive =  async(request: JwtContentRequest, response: Response, next: NextFunction) => {

    if(await DB_DELETE_CONTENT(request.contentID))
        response.status(204).send(`Content Archive ${request.contentID} deleted successfully`);

    else
        next(new Exception(404, `Failed to delete Content Archive ${request.contentID}`, 'Deleting Content Failed'));
};



