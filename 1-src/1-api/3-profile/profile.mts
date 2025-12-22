import express, { NextFunction, Request, Response, Router } from 'express';
import URL, { URLSearchParams } from 'url';
import * as log from '../../2-services/10-utilities/logging/log.mjs';
import USER from '../../2-services/1-models/userModel.mjs';
import { EDIT_PROFILE_FIELDS, EDIT_PROFILE_FIELDS_ADMIN, RoleEnum, SIGNUP_PROFILE_FIELDS, SIGNUP_PROFILE_FIELDS_USER } from '../../0-assets/field-sync/input-config-sync/profile-field-config.mjs';
import { DATABASE_CIRCLE_STATUS_ENUM, DATABASE_USER_ROLE_ENUM, USER_TABLE_COLUMNS_REQUIRED } from '../../2-services/2-database/database-types.mjs';
import { DB_DELETE_CIRCLE_USER_STATUS, DB_SELECT_MEMBERS_OF_ALL_LEADER_MANAGED_CIRCLES, DB_SELECT_USER_CIRCLES } from '../../2-services/2-database/queries/circle-queries.mjs';
import { DB_DELETE_ALL_USER_PRAYER_REQUEST } from '../../2-services/2-database/queries/prayer-request-queries.mjs';
import { DB_DELETE_CONTACT_CACHE, DB_DELETE_USER, DB_FLUSH_USER_SEARCH_CACHE_ADMIN, DB_INSERT_USER, DB_SELECT_USER, DB_SELECT_USER_PROFILE, DB_UNIQUE_USER_EXISTS, DB_UPDATE_USER } from '../../2-services/2-database/queries/user-queries.mjs';
import { DB_INSERT_USER_ROLE, DB_SELECT_USER_ROLES, DB_DELETE_USER_ROLE } from '../../2-services/2-database/queries/user-security-queries.mjs';
import { JwtClientRequest, JwtRequest } from '../2-auth/auth-types.mjs';
import { getEmailLogin, isMaxRoleGreaterThan, validateNewRoleTokenList } from '../2-auth/auth-utilities.mjs';
import { Exception, generateJWTRequest, ImageTypeEnum, JwtSearchRequest } from '../api-types.mjs';
import { clearImage, clearImageByID, uploadImage } from '../../2-services/10-utilities/image-utilities.mjs';
import { ProfileEditRequest, ProfileEditWalkLevelRequest, ProfileImageRequest, ProfileSignupRequest } from './profile-types.mjs';
import { LoginResponseBody } from '../../0-assets/field-sync/api-type-sync/auth-types.mjs';
import { DB_DELETE_PARTNERSHIP } from '../../2-services/2-database/queries/partner-queries.mjs';
import { InputRangeField } from '../../0-assets/field-sync/input-config-sync/inputField.mjs';
import { searchList } from '../api-search-utilities.mjs';
import { SearchType } from '../../0-assets/field-sync/input-config-sync/search-config.mjs';
import { populateDemoRelations } from '../../2-services/10-utilities/mock-utilities/mock-generate.mjs';
import { sendUserEmailVerification } from '../../2-services/4-email/configurations/email-verification.mjs';



//Verifies Unique Profile Fields for realtime validations | userID excludes profile for editing
//Uses Query Parameters: GET localhost:5000/resources/available-account?email=ethan@encouragingprayer.org&displayName=ethan
export const GET_AvailableAccount =  async (request: Request, response: Response, next: NextFunction) => { //(ALL fields and values are case insensitive)
    const fieldMap:Map<string, string> = new Map(new URLSearchParams(URL.parse(request.originalUrl).query ?? '').entries());

    if(fieldMap.size === 0 || Array.from(fieldMap.values()).some(v => v.trim() === ''))
        return next(new Exception(400, `Missing Details: Please supply -email- and/or -displayName- query parameters in request.  Including -userID- excludes profile.`, 'Invalid Account'));

    const result:boolean|undefined = await DB_UNIQUE_USER_EXISTS(fieldMap, true);
    if(result === undefined) 
        response.status(400).send(`Invalid Field Request: ${Array.from(fieldMap.keys()).join(', ')}`);
    else if(result === false) 
        response.status(204).send(`No Account exists for ${Array.from(fieldMap.values()).join(', ')}`);
    else
        response.status(403).send(`Account Exists`);
}
   
export const GET_publicProfile =  async (request: JwtClientRequest, response: Response, next: NextFunction) => {
    const profile:USER = await DB_SELECT_USER(new Map([['userID', request.clientID]]));

    if(profile.isValid) {
        profile.circleList = await DB_SELECT_USER_CIRCLES(profile.userID, DATABASE_CIRCLE_STATUS_ENUM.MEMBER);   
        response.status(200).send(profile.toPublicJSON())   
        log.event('Returning public profile for userID: ', request.clientID);
    } else //Necessary; otherwise no response waits for timeout | Ignored if next() already replied
        next(new Exception(404, `GET_publicProfile - user  ${request.clientID} failed to parse from database and is invalid.`, 'Profile Not Found')); 
};

export const GET_profileAccessUserList =  async (request: JwtRequest, response: Response, next: NextFunction) => { 

    if(isMaxRoleGreaterThan({testUserRole: RoleEnum.CIRCLE_LEADER, currentMaxUserRole:request.jwtUserRole}))
        response.status(200).send(await DB_SELECT_MEMBERS_OF_ALL_LEADER_MANAGED_CIRCLES(request.jwtUserID, true));
    
    else {
        log.warn(`Unauthorized profile access attempt: User: ${request.jwtUserID} with userRole: ${request.jwtUserRole} asked for profile access list`);
        next(new Exception(401, `GET_profileAccessUserList - user  ${request.jwtUserID} is not authorized to access other profiles.`, 'Not Authorized')); 
    }
}


export const GET_userProfile = async (request: JwtClientRequest, response: Response, next: NextFunction) => {
    const profile:USER = await DB_SELECT_USER_PROFILE(new Map([['userID', request.clientID]]));

    if(profile.isValid) {
        response.status(200).send(profile.toJSON())   
        log.event('Returning profile for userID: ', request.clientID);
    } else //Necessary; otherwise no response waits for timeout | Ignored if next() already replied
        next(new Exception(404, `GET_userProfile - user  ${request.clientID} failed to parse from database and is invalid.`, 'Profile Not Found')); 
};

export const GET_partnerProfile = async (request: JwtClientRequest, response: Response, next: NextFunction) => {     
    const profile:USER = await DB_SELECT_USER_PROFILE(new Map([['userID', request.clientID]]));

    if(profile.isValid) {
        response.status(200).send(profile.toNewPartnerListItem())   
        log.event('Returning partner profile for userID: ', request.clientID);
    } else //Necessary; otherwise no response waits for timeout | Ignored if next() already replied
        next(new Exception(500, `GET_partnerProfile - user  ${request.clientID} failed to parse from database and is invalid.`, 'Invalid Partner')); 
};


 /* Unauthenticated Route */
 export const POST_signup =  async(request: ProfileSignupRequest, response: Response, next: NextFunction) => {
    
    const newProfile:USER|Exception = await USER.constructByJson({jsonObj:request.body, fieldList: SIGNUP_PROFILE_FIELDS});

    if(!(newProfile instanceof Exception)) {
        if(USER_TABLE_COLUMNS_REQUIRED.every((column) => newProfile[column] !== undefined) === false) 
            next(new Exception(400, `Signup Failed :: Missing Required Fields: ${JSON.stringify(USER_TABLE_COLUMNS_REQUIRED)}.`, 'Missing Details'));

        //Verify user roles and verify account type tokens
        else if(await validateNewRoleTokenList({newRoleList:newProfile.userRoleList, jsonRoleTokenList: request.body.userRoleTokenList, email: newProfile.email}) === false)
            next(new Exception(401, `Signup Failed :: failed to verify token for user roles: ${JSON.stringify(newProfile.userRoleList)}for new user ${newProfile.email}.`, 'Ineligible Account Type'));

        //Create 'user' database entry
        else if(await DB_INSERT_USER(newProfile.getDatabaseProperties()) === false) 
                next(new Exception(500, `Signup Failed :: Failed to save new user account.`, 'Signup Save Failed'));

        //New Account Success -> Auto Login Response
        else { 
            //Add user roles, already verified permission above
            const saveUserRole:boolean = newProfile.userRoleList.length > 1; //Only save 'USER' role for multi role users
            const insertRoleList:DATABASE_USER_ROLE_ENUM[] = newProfile.userRoleList.filter((role) => (role !== RoleEnum.USER || saveUserRole)).map((role) => DATABASE_USER_ROLE_ENUM[role]);
            if(insertRoleList.length > 0 && !(await DB_INSERT_USER_ROLE({email:newProfile.email, userRoleList: insertRoleList})))
                log.error(`SIGNUP: Error assigning userRoles ${JSON.stringify(insertRoleList)} to ${newProfile.email}`);

            const loginDetails:LoginResponseBody = await getEmailLogin(newProfile.email, request.body['password'], false);

            if(loginDetails) {
                newProfile.userID = loginDetails.userID;
                newProfile.isValid = true;

                await sendUserEmailVerification(newProfile.userID, newProfile.email, newProfile.firstName);

                if(insertRoleList.length > 1) loginDetails.userProfile.userRoleList = await DB_SELECT_USER_ROLES(loginDetails.userID);

                //Optional Demo User Populate
                if(request.query.populate === 'true' && newProfile.isRole(RoleEnum.USER)) {
                    loginDetails.userProfile = (await populateDemoRelations(newProfile)).toJSON();
                }

                response.status(201).send(loginDetails);
                await DB_FLUSH_USER_SEARCH_CACHE_ADMIN();
                
                log.event('Successfully Signed up New User', newProfile.userID, newProfile.displayName, JSON.stringify(newProfile.userRoleList), (request.query.populate === 'true') ? 'Populated Demo Profile' : '');
            } else
                next(new Exception(404, `Signup Failed: Account successfully created; but failed to auto login new user.`, 'Please Login'));
        }
    } else
        next(newProfile);
};

/* Update Profiles */
//NOTE: request.userID is editor and request.clientID is profile editing
export const PATCH_userProfile = async (request: ProfileEditRequest, response: Response, next: NextFunction) => {

    const currentProfile:USER = await DB_SELECT_USER(new Map([['userID', request.clientID]]));

    const editProfile:USER|Exception = await USER.constructAndEvaluateByJson({currentModel: currentProfile, jsonObj:request.body, fieldList: (request.jwtUserRole === RoleEnum.ADMIN) ? EDIT_PROFILE_FIELDS_ADMIN : EDIT_PROFILE_FIELDS});

    if(currentProfile.isValid && !(editProfile instanceof Exception) && editProfile.isValid) {
        //Verify user roles and verify account type tokens
        const currentRoleList:RoleEnum[] = await DB_SELECT_USER_ROLES(request.clientID);
        if(await validateNewRoleTokenList({newRoleList:editProfile.userRoleList, jsonRoleTokenList: request.body.userRoleTokenList, email: editProfile.email, currentRoleList: currentRoleList, adminOverride: (request.jwtUserRole === RoleEnum.ADMIN)}) === false)
            next(new Exception(401, `Edit Profile Failed :: failed to verify token for user roles: ${JSON.stringify(editProfile.userRoleList)} for user ${editProfile.email}.`, 'Ineligible Account Type'));

        else if((USER.getUniqueDatabaseProperties(editProfile, currentProfile).size > 0 )
                && await DB_UPDATE_USER(request.clientID, USER.getUniqueDatabaseProperties(editProfile, currentProfile)) === false) 
            next(new Exception(500, `Edit Profile Failed :: Failed to update user ${request.clientID} account.`, 'Save Failed'));

        else {
            //Handle userRoleList: Add new user roles, already verified permission above
            const deleteRoleList:DATABASE_USER_ROLE_ENUM[] = currentRoleList.filter((role) => (!editProfile.userRoleList.includes(role))).map((role) => DATABASE_USER_ROLE_ENUM[role]);
            if(deleteRoleList.length > 0 && !DB_DELETE_USER_ROLE({userID:editProfile.userID, userRoleList: deleteRoleList}))
                log.error(`Edit Profile Failed :: Error removing userRoles ${JSON.stringify(deleteRoleList)} to ${editProfile.userID}`);

            const saveUserRole:boolean = editProfile.userRoleList.length > 1; //Only save 'USER' role for multi role users
            const insertRoleList:DATABASE_USER_ROLE_ENUM[] = editProfile.userRoleList?.filter((role) => ((role !== RoleEnum.USER || saveUserRole) && !currentRoleList.includes(role))).map((role) => DATABASE_USER_ROLE_ENUM[role]);
            if(insertRoleList.length > 0 && !DB_INSERT_USER_ROLE({userID:editProfile.userID, userRoleList: insertRoleList}))
                log.error(`Edit Profile Failed :: Error assigning userRoles ${JSON.stringify(insertRoleList)} to ${editProfile.userID}`);

            response.status(202).send(editProfile.toJSON());
        }
    } else //Necessary; otherwise no response waits for timeout | Ignored if next() already replied
        next((editProfile instanceof Exception) ? editProfile
            : new Exception(500, `PATCH_userProfile - user  ${request.clientID} failed to parse from database and is invalid.`, 'Profile Save Failed'));
};

/* Delete Profiles */
export const DELETE_userProfile = async (request: JwtClientRequest, response: Response, next: NextFunction) => {

    if(await DB_DELETE_CIRCLE_USER_STATUS({userID: request.clientID, circleID: undefined}) === false) //Leader must delete circle manually
        next(new Exception(500, `Failed to delete all circle membership of user ${request.clientID}`, 'Linked Circle Membership Exists'));

    else if(await DB_DELETE_PARTNERSHIP(request.clientID) === false)
        next(new Exception(500, `Failed to delete all partnerships of user ${request.clientID}`, 'Linked Partnerships Exists'));

    else if(await DB_DELETE_ALL_USER_PRAYER_REQUEST(request.clientID) === false)
        next(new Exception(500, `Failed to delete all prayer requests of user ${request.clientID}`, 'Linked Prayer Requests Exists'));

    else if(await DB_DELETE_USER_ROLE({userID: request.clientID, userRoleList: undefined}) === false)
        next(new Exception(500, `Failed to delete all user roles of user ${request.clientID}`, 'Linked User Roles Exists'));

    else if(await clearImageByID({id: request.clientID, imageType: ImageTypeEnum.USER_PROFILE}) === false)
        next(new Exception(500, `Failed to delete profile image for user ${request.clientID}`, 'Linked Profile Image Exists'));

    else if(await DB_DELETE_USER(request.clientID))
        response.status(204).send(`User ${request.clientID} deleted successfully`);
    else
        next(new Exception(500, `Profile Delete Failed :: Failed to delete user ${request.clientID} account.`, 'Profile Delete Failed'));
};

/* Profile Images */
export const GET_profileImage = async(request: JwtClientRequest, response: Response, next: NextFunction) => {
    const filePath:string|undefined = (await DB_SELECT_USER(new Map([['userID', request.clientID]]))).image || undefined;
    if(filePath !== undefined)
        response.status(200).send(filePath);
    else
        next(new Exception(404, `User ${request.clientID} doesn't have a saved profile image`, 'No Image'));
}

/* Headers: Content-Type: 'image/jpg' or 'image/png' & Content-Length: (calculated) | Body: binary: Blob */
export const POST_profileImage = async(request: ProfileImageRequest, response: Response, next: NextFunction) => {
    const fileName:string = request.params.file || 'invalid'; //Necessary to parse file extension
    const fileExtension:string = fileName.split('.').pop();
    let filePath:string|undefined = undefined;

    const existingFilePath:string|undefined = (await DB_SELECT_USER(new Map([['userID', request.clientID]]))).image || undefined;
    const existingFileName:string = (existingFilePath || '').split('/').pop();
    const existingFileExtension:string = (existingFilePath || '').split('.').pop();

    if(fileExtension !== existingFileExtension && existingFilePath !== undefined && await clearImage(existingFileName) === false)
        next(new Exception(500, `Profile image deletion failed for ${request.clientID} : ${existingFilePath}`, 'Existing Image'));

    else if((filePath = await uploadImage({id:request.clientID, fileName, imageBlob: request.body, imageType: ImageTypeEnum.USER_PROFILE})) === undefined)
        next(new Exception(500, `Profile image upload failed for fileName: ${fileName}`, 'Upload Failed'));

    else if(await DB_UPDATE_USER(request.clientID, new Map([['image', filePath]])) === false)
        next(new Exception(500, `Profile image upload failed to save: ${filePath}`, 'Save Failed'));

    else
        response.status(202).send(filePath);
}

export const DELETE_profileImage = async(request: JwtClientRequest, response: Response, next: NextFunction) => {

    if(await clearImageByID({id:request.clientID, imageType: ImageTypeEnum.USER_PROFILE}) && await DB_UPDATE_USER(request.clientID, new Map([['image', null]])))
        response.status(202).send(`Successfully deleted profile image for ${request.clientID}`);
    else
        next(new Exception(500, `Profile image deletion failed for ${request.clientID}`, 'Delete Failed'));
}


/* walkLevel set via Flow Quiz | range defined in EDIT_PROFILE_FIELDS_ADMIN config */
export const PATCH_profileWalkLevel = async(request: ProfileEditWalkLevelRequest, response: Response, next: NextFunction) => {
    const walkLevel:number = request.body.walkLevel;
    const walkLevelConfig:InputRangeField = EDIT_PROFILE_FIELDS_ADMIN.find(field => field.field === 'walkLevel') as InputRangeField;

    if(walkLevelConfig === undefined)
        next(new Exception(500, `PATCH_profileWalkLevel | Server Configuration Error: Failed to find walkLevel in EDIT_PROFILE_FIELDS_ADMIN`, 'Configuration Error'));

    else if(walkLevel === undefined || isNaN(walkLevel) || !walkLevelConfig.validationRegex.test(String(walkLevel))
        || walkLevel < (walkLevelConfig.minValue as number)
        || walkLevel > (walkLevelConfig.maxValue as number))
        next(new Exception(400, `Profile Walk Level Bad Input: ${walkLevel}`, 'Invalid Walk Level'));

    else if(await DB_UPDATE_USER(request.clientID, new Map([['walkLevel', walkLevel]])) === false)
        next(new Exception(500, `Profile Walk Level Save Failed: ${walkLevel}`, 'Save Failed'));

    else
        response.status(202).send(`Saved Profile Walk Level to ${walkLevel}`);
}


/* CONTACTS */
/* Partnerships, Co-Circle Members and leaders | (SearchType also available) */
export const GET_contactList = async(request: JwtClientRequest, response: Response, next: NextFunction) => {
    response.status(200).send(await searchList(SearchType.CONTACT, generateJWTRequest(request.clientID, request.jwtUserRole) as JwtSearchRequest)); //Uses Search Cache
}

export const POST_refreshContactList = async(request: JwtClientRequest, response: Response, next: NextFunction) => {
    await DB_DELETE_CONTACT_CACHE(request.clientID);
    response.status(200).send(await searchList(SearchType.CONTACT, generateJWTRequest(request.clientID, request.jwtUserRole) as JwtSearchRequest));
}

export const DELETE_contactCache = async(request: JwtClientRequest, response: Response, next: NextFunction) => {
    if(await DB_DELETE_CONTACT_CACHE(request.clientID)) {
        response.status(202).send(`Successfully flushed contact cache`);
        log.event(`User ${request.jwtUserID} has flushed the contact cache for user ${request.clientID}.`);

    } else
        next(new Exception(500, `Failed to flush user ${request.clientID} contact cache.`, 'Flush failed'));
}


/***********************
 *  CLIENT SEARCH
 ***********************/

export const DELETE_flushClientSearchCache = async (request:JwtRequest, response:Response, next: NextFunction) => {

    if(await DB_FLUSH_USER_SEARCH_CACHE_ADMIN()) {
        response.status(202).send(`Successfully flushed user search cache`);
        log.auth(`User ${request.jwtUserID} has reset the server's user search cache`);

    } else
        next(new Exception(500, 'Failed to flush user search cache.', 'Flush failed'));
}
