import dotenv from 'dotenv';
dotenv.config(); 
import path from 'path';
const __dirname = path.resolve();
import express, { Application , Request, Response, NextFunction, Errback} from 'express';
import bodyParser from 'body-parser';
import cors from 'cors';
import {Exception} from './api/api-types.mjs'
import * as log from './services/log.mjs';

//Import Routes
import logRoutes from './api/log/log.mjs';
import apiRoutes from './api/api.mjs';

import {GET_login, POST_logout, POST_signup } from './api/auth/auth.mjs';
import { GET_partnerProfile, GET_publicProfile, GET_userProfile, PATCH_userProfile } from './api/profile/profile.mjs';
import { DELETE_prayerRequest, GET_prayerRequestCircle, GET_prayerRequestSpecific, GET_prayerRequestUser, PATCH_prayerRequestAnswered, POST_prayerRequest } from './api/prayer-request/prayer-request.mjs';

import { CredentialRequest } from './api/auth/auth-types.mjs';
import { authenticatePartner, authenticateCircle, authenticateProfile, authenticateLeader, authenticateAdmin, authenticateIdentity } from './api/auth/authorization.mjs';
import { CircleRequest } from './api/circle/circle-types.mjs';


 

const SERVER_PORT = process.env.SERVER_PORT || 5000;
const apiServer: Application = express();
apiServer.listen( SERVER_PORT, () => console.log(`Back End Server listening on LOCAL port: ${SERVER_PORT}`));

/* Middleware  */
// apiServer.use(express.static(path.join(__dirname, 'build')));
// apiServer.use(bodyParser.json());
// apiServer.use(bodyParser.urlencoded({ extended: true }));
// apiServer.use(bodyParser.raw());
apiServer.use(cors());

/********************
 Unauthenticated Routes
 *********************/

/* Routes  */ //Order Matters: First Matches
apiServer.get('/', (request: Request, response: Response) => {
    response.sendFile(path.join(__dirname, 'build', 'index.html'));
});

apiServer.get('/portal', (request: Request, response: Response) => {
    response.status(308).send("Portal Interface is coming Soon!");
});

//Formatting Request Body
apiServer.use(express.json());

apiServer.post('/signup', POST_signup);
apiServer.post('/login', GET_login);


//***************************************
// #1 - Verify Identity & Cache Profiles
//***************************************
apiServer.use('/api', (request:CredentialRequest, response:Response, next:NextFunction) => authenticateIdentity(request, response, next));

//General API Routes
apiServer.use('/api', apiRoutes);

apiServer.post('/api/logout', POST_logout);

apiServer.get('/api/profile', GET_publicProfile);


//******************************
// #2 - Verify Partner Status
//******************************
apiServer.use('/api/partner', (request:CredentialRequest, response:Response, next:NextFunction) => authenticatePartner(request, response, next));

apiServer.get('/api/partner', GET_partnerProfile);

apiServer.get('/api/partner/prayer-request', GET_prayerRequestUser);
apiServer.get('/api/partner/prayer-request/:id', GET_prayerRequestSpecific);


//******************************
// #3 - Verify Circle Status
//******************************
apiServer.use('/api/circle', (request:CircleRequest, response:Response, next:NextFunction) => authenticateCircle(request, response, next));

apiServer.get('/api/circle/:circle-id/prayer-request', GET_prayerRequestCircle);
apiServer.get('/api/circle/:circle-id/prayer-request/:prayer-request-id', GET_prayerRequestSpecific);


//******************************
// #4 - Verify User Profile Access
//******************************
apiServer.use('api/profile', (request:CredentialRequest, response:Response, next:NextFunction) => authenticateProfile(request, response, next));

apiServer.get('/api/profile/user', GET_userProfile);
apiServer.get('/api/profile/partner', GET_partnerProfile);
apiServer.patch('/api/profile/user', PATCH_userProfile);

apiServer.get('/api/profile/prayer-request', GET_prayerRequestUser);
apiServer.patch('/api/profile/prayer-request', PATCH_prayerRequestAnswered);
apiServer.delete('/api/profile/prayer-request', DELETE_prayerRequest);
apiServer.post('/api/profile/prayer-request', POST_prayerRequest);


//******************************
// #5 - Verify Leader Access
//******************************
apiServer.use('/api/circle/leader', (request:CircleRequest, response:Response, next:NextFunction) => authenticateLeader(request, response, next));


//******************************
// #6 - Verify ADMIN Access
//******************************
apiServer.use('/api/admin', (request:CredentialRequest, response:Response, next:NextFunction) => authenticateAdmin(request, response, next));

apiServer.use(express.text());
apiServer.use('/api/admin/log', logRoutes);


//******************************
/* Error Handling  */
//******************************
apiServer.use((request: Request, response:Response, next: NextFunction) => {
    next(new Exception(404, "Invalid Request"));
});

apiServer.use((error: Exception, request: Request, response:Response, next: NextFunction) => {
    const status = error.status || 500;
    const message = error.message || 'Server Error';
    response.status(error.status || 500).send({status, message});

    if(status < 400) log.event('API Event:', message);
    else if(status >= 400 && status <= 403) log.auth('HTTP user verification failed:', message);
    else log.error('API Server Error:', message);

    console.error("API", status, message, request.headers, request.body);
});