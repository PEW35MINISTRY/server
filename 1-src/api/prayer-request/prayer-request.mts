import express, {Router, Request, Response, NextFunction} from 'express';
import * as log from '../../services/log.mjs';
import {Exception} from '../api-types.mjs'
import { CredentialRequest } from '../auth/auth-types.mjs';
import { PrayerRequestCircleRequest, PrayerRequestNewRequest, PrayerRequestRequest, PrayerRequestUserRequest } from './prayer-request-types.mjs';
import { getPrayerRequest, getUserPrayerRequestList, getCirclePrayerRequestList } from './prayer-request-utilities.mjs';


/* Return Individual Prayer Request */
export const GET_prayerRequestSpecific = (request: PrayerRequestRequest, response: Response) => {
    //Query Database

    response.status(200).send(getPrayerRequest(request.params['prayer-request-id']));
    log.event("Returning specific Prayer Request:", request.params.id);
};


export const POST_prayerRequest =  (request: PrayerRequestNewRequest, response: Response) => { //POST includes sharing to circle/partners/leaders
    //Query Database

    const newRequestId:string = '203';

    response.status(200).send(getPrayerRequest(newRequestId));
    log.event("New Prayer Request Created.");
};

export const PATCH_prayerRequestAnswered =  (request: PrayerRequestRequest, response: Response) => {
    //Query Database

    response.status(200).send(getPrayerRequest(request.headers['prayer-request-id']));
    log.event("Prayer Request Answered", request.headers['prayer-request-id']);
};

export const DELETE_prayerRequest =  (request: PrayerRequestNewRequest, response: Response) => {
    //Query Database


    response.status(200).send('Prayer Request has been deleted.');
    log.event("New Prayer Request Created.");
};


/* Return Group Lists */
export const GET_prayerRequestUser =  (request: PrayerRequestUserRequest, response: Response) => {
    //Query Database

    response.status(200).send(getUserPrayerRequestList(request.headers['request-user-id']));
    log.event("Returning all User Prayer Requests", request.headers['request-user-id']);
};

export const GET_prayerRequestCircle =  (request: PrayerRequestCircleRequest, response: Response) => {
    //Query Database

    response.status(200).send(getCirclePrayerRequestList(request.headers['circle-id']));
    log.event("Returning all Circle Prayer Requests", request.headers['circle-id']);
};



