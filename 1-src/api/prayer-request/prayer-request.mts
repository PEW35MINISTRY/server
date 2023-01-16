import express, {Router, Request, Response, NextFunction} from 'express';
import * as log from '../../services/log.mjs';
import {Exception} from '../api-types.mjs'
import { IdentityCirclePrayerRequest, IdentityRequest, IdentityPrayerRequest } from '../auth/auth-types.mjs';
import { PrayerRequestCircleRequest, PrayerRequestNewRequest, PrayerRequestRequest, PrayerRequestUserRequest } from './prayer-request-types.mjs';
import { getPrayerRequest, getUserPrayerRequestList, getCirclePrayerRequestList } from './prayer-request-utilities.mjs';


/* Return Individual Prayer Request */
export const GET_profilePrayerRequestSpecific = (request: IdentityPrayerRequest, response: Response) => {
    //Query Database
console.log('PARAMETERS', request.params, request.params.client, request.params.prayer);
    response.status(200).send(getPrayerRequest(request.params.prayer));
    log.event("Returning specific Prayer Request:", request.params.client);
};


export const POST_prayerRequest =  (request: PrayerRequestNewRequest, response: Response) => { //POST includes sharing to circle/partners/leaders
    //Query Database

    const newRequestId:string = '203';

    response.status(200).send(getPrayerRequest(newRequestId));
    log.event("New Prayer Request Created.");
};

export const PATCH_prayerRequestAnswered =  (request: IdentityPrayerRequest, response: Response) => {
    //Query Database

    response.status(200).send(getPrayerRequest(request.params.prayer));
    log.event("Prayer Request Answered", request.params.prayer);
};

export const DELETE_prayerRequest =  (request: PrayerRequestNewRequest, response: Response) => {
    //Query Database


    response.status(200).send('Prayer Request has been deleted.');
    log.event("New Prayer Request Created.");
};


/* Return Group Lists */
export const GET_prayerRequestUser =  (request: IdentityPrayerRequest, response: Response) => {
    //Query Database

    response.status(200).send(getUserPrayerRequestList(request.params.prayer));
    log.event("Returning all User Prayer Requests", request.headers['request-user-id']);
};

export const GET_prayerRequestCircle =  (request: IdentityCirclePrayerRequest, response: Response) => {
    //Query Database

    response.status(200).send(getCirclePrayerRequestList(request.params.prayer));
    log.event("Returning all Circle Prayer Requests", request.headers['circle-id']);
};



