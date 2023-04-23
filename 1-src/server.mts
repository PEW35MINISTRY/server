import dotenv from 'dotenv';
dotenv.config(); 
import fs from 'fs';
import path from 'path';
const __dirname = path.resolve();
import { createServer } from 'http';
import { createServer as createSecureServer } from 'https';
import express, { Application , Request, Response, NextFunction} from 'express';
import { Server, Socket } from 'socket.io';
import bodyParser from 'body-parser';
import cors from 'cors';
import {Exception} from './api/api-types.mjs'
import * as log from './services/log.mjs';
import CHAT from './services/chat/chat.mjs';

//Import Routes
import logRoutes from './api/log/log.mjs';
import apiRoutes from './api/api.mjs';

import {GET_allUserCredentials, GET_jwtVerify, POST_login, POST_logout, POST_signup } from './api/auth/auth.mjs';
import { GET_partnerProfile, GET_profileAccessUserList, GET_ProfileRoleEditList, GET_publicProfile, GET_RoleList, GET_userProfile, PATCH_userProfile, POST_EmailExists, POST_UsernameExists } from './api/profile/profile.mjs';
import { DELETE_prayerRequest, GET_prayerRequestCircle, GET_profilePrayerRequestSpecific, GET_prayerRequestUser, PATCH_prayerRequestAnswered, POST_prayerRequest } from './api/prayer-request/prayer-request.mjs';

import { IdentityCircleRequest, IdentityClientRequest, IdentityRequest, JWTRequest } from './api/auth/auth-types.mjs';
import { authenticatePartnerMiddleware, authenticateCircleMiddleware, authenticateProfileMiddleware, authenticateLeaderMiddleware, authenticateAdminMiddleware, authenticateUserMiddleware, jwtAuthenticationMiddleware } from './api/auth/authorization.mjs';
import { SocketContact, SocketMessage } from './services/chat/chat-types.mjs';
import { fetchCircleMessageNames, fetchNames, formatMessageNames } from './services/chat/chat-utilities.mjs';
import { GET_userContacts } from './api/chat/chat.mjs';
import { GET_userCircles } from './api/circle/circle.mjs';
import { DefaultEventsMap } from 'socket.io/dist/typed-events.js';
import { verifyJWT } from './api/auth/auth-utilities.mjs';

 

const SERVER_PORT = process.env.SERVER_PORT || 5000;
const HTTPS_SERVER_PORT = process.env.HTTPS_SERVER_PORT || 5555;
const publicServer: Application = express();
const apiServer: Application = express();

/********************
   Socket.IO Chat
 *********************/
const httpServer = createServer(apiServer).listen( SERVER_PORT, () => console.log(`Back End Server listening on HTTP port: ${SERVER_PORT}`));

//***AWS ENVIRONMENT****/ only enable for HTTPS and DNS
// const privateKey = fs.readFileSync('aws/privkey.pem', 'utf8');
// const certificate = fs.readFileSync('aws/cert.pem', 'utf8');
// const ca = fs.readFileSync('aws/chain.pem', 'utf8');
// const credentials = {
// 	key: privateKey,
// 	cert: certificate,
// 	ca: ca
// };

// const httpsServer = createSecureServer(credentials, apiServer);

//***LOCAL ENVIRONMENT****/ only HTTP
const httpsServer = httpServer;

const chatIO:Server<DefaultEventsMap, DefaultEventsMap, DefaultEventsMap, any> = new Server(httpsServer, { 
    path: '/chat',
    cors: { origin: "*"}
});
httpsServer.listen( HTTPS_SERVER_PORT, () => console.log(`Back End Server listening on HTTPS port: ${HTTPS_SERVER_PORT}`));

//Socket Middleware Authenticates JWT before Connect
chatIO.use((socket, next)=> {
    console.log('Requesting to join chat:', socket.handshake.auth);

    if(verifyJWT(socket.handshake.auth.JWT)) next();
    else  next(new Error('Invalid JWT, Please Login Again to Chat'));
});

/*  Initialize Direct and Circle Chat */
CHAT(chatIO);

/* Middleware  */
// apiServer.use(express.static(path.join(__dirname, 'build')));
// apiServer.use(bodyParser.json());
// apiServer.use(bodyParser.urlencoded({ extended: true }));
// apiServer.use(bodyParser.raw());
apiServer.use(cors());

/********************
 HTTP Routes
 *********************/
 publicServer.use(cors());
 publicServer.use(express.static(path.join(__dirname, 'website')));
 publicServer.get('/', (request: Request, response: Response) => {
     response.status(200).sendFile(path.join(__dirname, 'website', 'index.html'));
 });
 
 //Redirect all other routes to HTTPS
//  publicServer.get('/*', (request: Request, response: Response) => {
//     log.event('Redirecting to HTTPS:', 'https://' + request.headers.host + request.url);
//      response.status(301).redirect('https://' + request.headers.host + request.url);
//  });

/********************
 Unauthenticated Routes
 *********************/

/* Routes  */ //Order Matters: First Matches
apiServer.use(express.static(path.join(__dirname, 'website')));
apiServer.get('/', (request: Request, response: Response) => {
    response.status(200).sendFile(path.join(__dirname, 'website', 'index.html'));
});

apiServer.get('/website', (request: Request, response: Response) => {
    response.status(200).sendFile(path.join(__dirname, 'website', 'index.html'));
});

apiServer.use(express.static(path.join(__dirname, 'portal')));
apiServer.get('/portal', (request: Request, response: Response) => {
    response.status(200).sendFile(path.join(__dirname, 'portal', 'index.html'));
});

apiServer.get('/login', (request: Request, response: Response) => {
    response.status(200).sendFile(path.join(__dirname, 'portal', 'index.html'));
});

apiServer.get('/signup', (request: Request, response: Response) => {
    response.status(200).sendFile(path.join(__dirname, 'portal', 'index.html'));
});

//Formatting Request Body
apiServer.use(express.json());

apiServer.post('/signup', POST_signup);

apiServer.get('/resources/role-list', GET_RoleList);
// apiServer.post('/resources/account-exists', POST_EmailExists);
// apiServer.post('/resources/name-exists', POST_UsernameExists);

apiServer.get('/resources/profile-edit-list', GET_ProfileRoleEditList);

apiServer.post('/login', POST_login);

//TODO: Temporary Debugging
apiServer.get('/login/credentials', GET_allUserCredentials);


//***************************************
// #0 - Authenticate JWT Validity
//***************************************
apiServer.use('/api', (request:JWTRequest, response:Response, next:NextFunction) => jwtAuthenticationMiddleware(request, response, next));

//General API Routes
apiServer.use('/api', apiRoutes);

apiServer.get('/api/authenticate', GET_jwtVerify);

apiServer.post('/api/logout/:client', POST_logout);

apiServer.get('/api/public/profile/:client', GET_publicProfile);



//***************************************
// #1 - Verify Identity & Cache Profiles
//***************************************
apiServer.use('/api/user', (request:IdentityRequest, response:Response, next:NextFunction) => authenticateUserMiddleware(request, response, next));

// apiServer.get('/api/public/circle/:circle', GET_publicCircle);

apiServer.get('/api/user/contacts', GET_userContacts); //Returns id and Name

apiServer.get('/api/user/profile/access', GET_profileAccessUserList); //Returns id Name, role

apiServer.get('/api/user/circles', GET_userCircles);



//******************************
// #2 - Verify Partner Status & Cache Client
//******************************
apiServer.use('/api/user/partner/:client', (request:IdentityClientRequest, response:Response, next:NextFunction) => authenticatePartnerMiddleware(request, response, next));

apiServer.get('/api/user/partner/:client', GET_partnerProfile);

apiServer.get('/api/user/partner/:client/prayer-request', GET_prayerRequestUser);
apiServer.get('/api/user/partner/:client/prayer-request/:prayer', GET_profilePrayerRequestSpecific);


//******************************
// #3 - Verify Circle Status & Cache Circle
//******************************
apiServer.use('/api/user/circle/:circle', (request:IdentityCircleRequest, response:Response, next:NextFunction) => authenticateCircleMiddleware(request, response, next));

apiServer.get('/api/user/circle/:circle/prayer-request', GET_prayerRequestCircle);
apiServer.get('/api/user/circle/:circle/prayer-request/:prayer', GET_profilePrayerRequestSpecific);


//******************************
// #4 - Verify User Profile Access
//******************************
apiServer.use('/api/user/profile/:client', async (request:IdentityClientRequest, response:Response, next:NextFunction) => await authenticateProfileMiddleware(request, response, next));

apiServer.get('/api/user/profile/:client', GET_userProfile);
apiServer.patch('/api/user/profile/:client', PATCH_userProfile);

apiServer.get('/api/user/profile/:client/prayer-request', GET_prayerRequestUser);
apiServer.get('/api/user/profile/:client/prayer-request/:prayer', GET_profilePrayerRequestSpecific);
apiServer.post('/api/user/profile/:client/prayer-request', POST_prayerRequest);
apiServer.patch('/api/user/profile/:client/prayer-request/:prayer/answered', PATCH_prayerRequestAnswered);
apiServer.delete('/api/user/profile/:client/prayer-request/:prayer', DELETE_prayerRequest);



//******************************
// #5 - Verify Leader Access
//******************************
apiServer.use('/api/user/circle/:circle/leader', (request:IdentityCircleRequest, response:Response, next:NextFunction) => authenticateLeaderMiddleware(request, response, next));


//******************************
// #6 - Verify ADMIN Access
//******************************
apiServer.use('/api/user/admin', (request:IdentityRequest, response:Response, next:NextFunction) => authenticateAdminMiddleware(request, response, next));

apiServer.use(express.text());
apiServer.use('/api/user/admin/log', logRoutes);


//******************************
/* Error Handling  */
//******************************
apiServer.use((request: Request, response:Response, next: NextFunction) => {
    next(new Exception(404, "Invalid Request"));
});

apiServer.use((error: Exception, request: Request, response:Response, next: NextFunction) => {
    const status = error.status || 500;
    const message = error.message || 'Server Error';
    const action = request.method + ' -> ' + request.url + ' = ' + message;
    const errorResponse:serverErrorResponse = {
        status: status,
        message: message,
        action: action,
        type: request.method,
        url: request.originalUrl,
        params: request.params,
        query: request.query,
        header: request.headers,
        body: request.body
    }
    response.status(error.status || 500).send(errorResponse);

    if(status < 400) log.event('API Event:', message);
    else if(status >= 400 && status <= 403) log.auth('HTTP user verification failed:', message);
    else log.error('API Server Error:', message);

    console.error("API", errorResponse);
});

//Must match Portal in app-types.tsx
export type serverErrorResponse = {
    status: number, 
    message: string,
    action: string,
    type: string,
    url: string,
    params: any, //ParamsDictionary
    query: any, //ParsedQs
    header: string | object,
    body: string | object
};