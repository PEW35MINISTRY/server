import express, { NextFunction, Request, Response, Router } from 'express';
import * as log from '../../2-services/log.mjs';
import { Exception } from '../api-types.mjs';
import { JwtAdminRequest, JwtClientPartnerRequest, JwtClientRequest, JwtClientStatusFilterRequest } from '../2-auth/auth-types.mjs';
import { PartnerStatusEnum, RoleEnum } from '../../0-assets/field-sync/input-config-sync/profile-field-config.mjs';
import { DB_ASSIGN_PARTNER_STATUS, DB_DELETE_PARTNERSHIP,  DB_SELECT_AVAILABLE_PARTNER_LIST, DB_SELECT_PARTNER_LIST, DB_SELECT_PARTNER_STATUS, DB_SELECT_PARTNER_STATUS_MAP, DB_SELECT_PARTNERSHIP, DB_SELECT_PENDING_PARTNER_LIST, DB_SELECT_PENDING_PARTNER_PAIR_LIST, DB_SELECT_UNASSIGNED_PARTNER_USER_LIST, getPartnerID, getUserID } from '../../2-services/2-database/queries/partner-queries.mjs';
import { DATABASE_PARTNER_STATUS_ENUM, DATABASE_USER_ROLE_ENUM } from '../../2-services/2-database/database-types.mjs';
import USER from '../../2-services/1-models/userModel.mjs';
import { DB_DELETE_CONTACT_CACHE, DB_DELETE_CONTACT_CACHE_BATCH, DB_IS_USER_ROLE, DB_SELECT_USER, DB_SELECT_USER_ROLES } from '../../2-services/2-database/queries/user-queries.mjs';
import { PartnerListItem, ProfileListItem } from '../../0-assets/field-sync/api-type-sync/profile-types.mjs';



/*********************************
 *  List PARTNER REQUEST ROUTES  *
 *********************************/
export const GET_PartnerList = async(statusFilter:PartnerStatusEnum|undefined, request:JwtClientStatusFilterRequest, response:Response, next:NextFunction) => {
    if(statusFilter === undefined) {
        statusFilter = PartnerStatusEnum[request.query.status];
    } //Still undefined returns all partnerships

    response.status(200).send(await DB_SELECT_PARTNER_LIST(request.clientID, DATABASE_PARTNER_STATUS_ENUM[statusFilter]));
};


export const GET_PendingPartnerList = async(request:JwtClientRequest, response:Response) => {
    response.status(200).send(await DB_SELECT_PENDING_PARTNER_LIST(request.clientID));
};



/***************************
 *  UPDATE PARTNER ROUTES  *
 ***************************/
export const POST_NewPartnerSearch = async(request:JwtClientRequest, response:Response, next:NextFunction) => { //clientID is applying
    const profile:USER = await DB_SELECT_USER(new Map([['userID', request.clientID]]));

    if(!profile.isValid)
        return next(new Exception(404, `POST_NewPartnerSearch - user  ${request.clientID} failed to parse from database and is invalid.`, 'Invalid Profile')); 

    else if(await DB_IS_USER_ROLE(request.clientID, DATABASE_USER_ROLE_ENUM.USER, true) === false)
        return next(new Exception(401, `POST_NewPartnerSearch - user  ${request.clientID} is not a USER role and not eligible for partners.`, 'User Role Required')); 

    const availableList:ProfileListItem[] = await DB_SELECT_AVAILABLE_PARTNER_LIST(profile);

    if(availableList.length === 0) { 
        //TODO also notify support of un-partnered user
        return next(new Exception(404, `Unable to find available partner, support has been notified.`, 'Partner Unavailable')); 
        
    } else { //Assign new Partnership
        const newPartner:PartnerListItem = {...availableList[0], status: PartnerStatusEnum.PENDING_CONTRACT_BOTH};

        log.event(`Creating new partnership between ${request.clientID} and ${newPartner.userID}`);
        //TODO also notify users

        if(await DB_ASSIGN_PARTNER_STATUS(request.clientID, newPartner.userID, DATABASE_PARTNER_STATUS_ENUM.PENDING_CONTRACT_BOTH))
            response.status(200).send(newPartner);
        else
            return next(new Exception(500, `Failed to create new  partnership status for user ${request.clientID} and partner ${newPartner.userID}`, 'Save Failed'));
    }
};


//user 'jwtUserID' is taking action with partner 'clientID'
export const POST_PartnerContractAccept = async(request:JwtClientRequest, response:Response, next:NextFunction) => {
    const currentStatus:PartnerStatusEnum = await DB_SELECT_PARTNER_STATUS(request.jwtUserID, request.clientID);
    let newStatus:PartnerStatusEnum = currentStatus;
    if((currentStatus === PartnerStatusEnum.PENDING_CONTRACT_BOTH) && (request.jwtUserID === getUserID(request.jwtUserID , request.clientID))) 
        newStatus = PartnerStatusEnum.PENDING_CONTRACT_PARTNER;
    
    else if((currentStatus === PartnerStatusEnum.PENDING_CONTRACT_BOTH) && (request.jwtUserID === getPartnerID(request.jwtUserID , request.clientID)))
        newStatus = PartnerStatusEnum.PENDING_CONTRACT_USER;

    else if((currentStatus === PartnerStatusEnum.PENDING_CONTRACT_USER) && (request.jwtUserID === getUserID(request.jwtUserID , request.clientID))) 
        newStatus = PartnerStatusEnum.PARTNER;

    else if((currentStatus === PartnerStatusEnum.PENDING_CONTRACT_PARTNER) && (request.jwtUserID === getPartnerID(request.jwtUserID , request.clientID))) 
        newStatus = PartnerStatusEnum.PARTNER;

    else //No pending status identified
        return  next(new Exception(400, `Partnership is not PENDING between user ${request.jwtUserID} and partner ${request.clientID}, unable to accept partnership contract.`, 'Partnership not found'));

    //Assign new status
    if(await DB_ASSIGN_PARTNER_STATUS(request.jwtUserID, request.clientID, DATABASE_PARTNER_STATUS_ENUM[newStatus])) {
        if(newStatus === PartnerStatusEnum.PARTNER) 
            await DB_DELETE_CONTACT_CACHE_BATCH([request.jwtUserID, request.clientID]);

        log.event(`User ${request.jwtUserID} and partner ${request.clientID} are now ${newStatus}`);
        response.status(200).send(await DB_SELECT_PARTNERSHIP(request.jwtUserID, request.clientID));
    } else
        return next(new Exception(500, `Failed to save partnership status for user ${request.jwtUserID} and partner ${request.clientID} as ${newStatus}`, 'Save Failed'));
};


//user 'jwtUserID' is taking action with partner 'clientID'
export const DELETE_PartnerContractDecline = async(request:JwtClientRequest, response:Response, next:NextFunction) => {
    if(await DB_ASSIGN_PARTNER_STATUS(request.jwtUserID, request.clientID, DATABASE_PARTNER_STATUS_ENUM.FAILED))
        response.status(200).send(`Declined partnership between user ${request.jwtUserID} and partner ${request.clientID}}`);
    else
        return next(new Exception(500, `Failed to save partnership status for user ${request.jwtUserID} and partner ${request.clientID} as FAILED`, 'Decline Failed'));
};


//user 'jwtUserID' is taking action with partner 'clientID'
export const DELETE_PartnershipLeave = async(request:JwtClientRequest, response:Response, next:NextFunction) => {

    if(await DB_ASSIGN_PARTNER_STATUS(request.jwtUserID, request.clientID, DATABASE_PARTNER_STATUS_ENUM.ENDED) === false)
        return next(new Exception(500, `Failed to save ENDED partnership between user ${request.jwtUserID} and partner ${request.clientID}`, 'Save Failed'));

    else {
        await DB_DELETE_CONTACT_CACHE_BATCH([request.jwtUserID, request.clientID]);
        response.status(200).send(`User ${request.jwtUserID} and partner ${request.clientID} partnership has now ENDED.`);
    }
};



/*********************************
 *  ADMIN ASSIGN PARTNER ROUTES  *
 *********************************/
export const POST_PartnerStatusAdmin = async(status:PartnerStatusEnum|undefined, request:JwtClientPartnerRequest, response:Response, next:NextFunction) => {
    if(status === undefined) {
        status = PartnerStatusEnum[request.params.status];

        if(status === undefined) return next(new Exception(400, `Failed to parse partner status filter :: missing 'status' parameter :: ${request.params.status}`, 'Missing Status Filter'));
    }

    if(await DB_ASSIGN_PARTNER_STATUS(request.clientID, request.partnerID, DATABASE_PARTNER_STATUS_ENUM[status])) {
        await DB_DELETE_CONTACT_CACHE_BATCH([request.clientID, request.partnerID]);
        log.event(`ADMIN: User ${request.clientID} and partner ${request.partnerID} are now ${status}`);
        response.status(200).send(await DB_SELECT_PARTNERSHIP(request.clientID, request.partnerID));
    } else
        return next(new Exception(500, `Failed to save partnership status for user ${request.clientID} and partner ${request.partnerID} as ${status}`, 'Save Failed'));
};


export const DELETE_PartnershipAdmin = async(request:JwtClientPartnerRequest, response:Response, next:NextFunction) => {
    if(await DB_DELETE_PARTNERSHIP(request.clientID, request.partnerID)) {
        await DB_DELETE_CONTACT_CACHE_BATCH([request.clientID, request.partnerID]);
        response.status(202).send('Partnership cleared');

    } else
        next(new Exception(500, `Failed to delete partnership between user ${request.clientID} and partner ${request.partnerID}`, 'Delete Failed'));
};


export const DELETE_PartnershipByTypeAdmin = async(status:PartnerStatusEnum|undefined, request:JwtClientPartnerRequest, response:Response, next:NextFunction) => {
    if(status === undefined) {
        status = PartnerStatusEnum[request.params.status];

        if(status === undefined) return next(new Exception(400, `Failed to parse status filter :: missing 'status' parameter :: ${request.params.status}`, 'Missing Status Filter'));
    }

    if(await DB_DELETE_PARTNERSHIP(request.clientID, undefined, status)) {
        await DB_DELETE_CONTACT_CACHE(request.clientID); //TODO we don't know the other partners whose partnership has now been cleared
        response.status(202).send(`All ${status} partnerships deleted for user ${request.clientID}`);
        
    } else
        next(new Exception(500, `Failed to delete all ${status} partnerships of user ${request.clientID}`, 'Partnerships Exists'));
};


/**************************
 *  ADMIN PARTNER ROUTES  *
 **************************/
export const GET_AllUnassignedPartnerList = async(request:JwtAdminRequest, response:Response) => {
    response.status(200).send(await DB_SELECT_UNASSIGNED_PARTNER_USER_LIST());
};


export const GET_AllPartnerPairPendingList = async(request:JwtAdminRequest, response:Response) => {
    response.status(200).send(await DB_SELECT_PENDING_PARTNER_PAIR_LIST()); //[PartnerListItem, PartnerListItem][]
};


//List of Users that have fewer partners than maxPartners
export const GET_AllFewerPartnerStatusMap = async(request:JwtAdminRequest, response:Response) => {
    //Note: Express can't serialize Maps, so returning a [key, value] pair array
    response.status(200).send(await DB_SELECT_PARTNER_STATUS_MAP(true));
};


//ProfilePartnerCountListItem[] : List of users and map of totals for each partner status
export const GET_AllPartnerStatusMap = async(request:JwtAdminRequest, response:Response) => {
    response.status(200).send(await DB_SELECT_PARTNER_STATUS_MAP());
};


export const GET_AvailablePartnerList = async(request:JwtClientRequest, response:Response, next:NextFunction) => {
    const profile:USER = await DB_SELECT_USER(new Map([['userID', request.clientID]]));
    profile.userRoleList = await DB_SELECT_USER_ROLES(request.clientID);

    if(!profile.isValid)
        next(new Exception(500, `GET_AvailablePartnerList - user ${request.clientID} failed to parse from database and is invalid.`, 'Invalid User')); 

    else if(await DB_IS_USER_ROLE(request.clientID, DATABASE_USER_ROLE_ENUM.USER, true) === false)
        next(new Exception(400, `GET_AvailablePartnerList - user ${request.clientID} is not a USER and not authorized to have partners.`, 'User Role Required'))

    else
        response.status(200).send(await DB_SELECT_AVAILABLE_PARTNER_LIST(profile, 15));
};
