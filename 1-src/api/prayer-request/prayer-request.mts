import express, {Router, Request, Response, NextFunction} from 'express';
import * as log from '../../services/log.mjs';
import {Exception} from '../api-types.mjs'
import { CredentialRequest } from '../auth/auth-types.mjs';
import authenticateJWT from '../auth/auth-utilities.mjs';
import { PrayerRequestCircleRequest, PrayerRequestNewRequest, PrayerRequestRequest, PrayerRequestUserRequest } from './prayer-request-types.mjs';
import { getPrayerRequest, getUserPrayerRequestList, getCirclePrayerRequestList } from './prayer-request-utilities.mjs';


const router:Router = express.Router();
router.use(express.json());

//Verify Authentication
router.use((request:CredentialRequest, response:Response, next:NextFunction) => authenticateJWT(request, response, next));
   

/* Return Individual Prayer Request */
router.get('/', (request: PrayerRequestRequest, response: Response) => {
    //Query Database

    response.status(200).send(getPrayerRequest(request.headers['prayer-request-id']));
    log.event("Returning specific Prayer Request:", request.headers['request-id']);
});


router.post('/', (request: PrayerRequestNewRequest, response: Response) => {
    //Query Database

    const newRequestId:string = '203';

    response.status(200).send(getPrayerRequest(newRequestId));
    log.event("New Prayer Request Created.");
});

router.post('/answered', (request: PrayerRequestRequest, response: Response) => {
    //Query Database

    response.status(200).send(getPrayerRequest(request.headers['prayer-request-id']));
    log.event("Prayer Request Answered", request.headers['prayer-request-id']);
});

router.delete('/prayer-request', (request: PrayerRequestNewRequest, response: Response) => {
    //Query Database


    response.status(200).send('Prayer Request has been deleted.');
    log.event("New Prayer Request Created.");
});


/* Return Group Lists */
router.get('/user', (request: PrayerRequestUserRequest, response: Response) => {
    //Query Database

    response.status(200).send(getUserPrayerRequestList(request.headers['request-user-id']));
    log.event("Returning all User Prayer Requests", request.headers['request-user-id']);
});

router.get('/circle', (request: PrayerRequestCircleRequest, response: Response) => {
    //Query Database

    response.status(200).send(getCirclePrayerRequestList(request.headers['circle-id']));
    log.event("Returning all Circle Prayer Requests", request.headers['circle-id']);
});



export default router;


