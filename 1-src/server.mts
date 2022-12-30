import dotenv from 'dotenv';
dotenv.config(); 
import path from 'path';
const __dirname = path.resolve();
import { createServer } from "http";
import express, { Application , Request, Response, NextFunction} from 'express';
import { Server, Socket } from "socket.io";
import bodyParser from 'body-parser';
import cors from 'cors';
import {Exception} from './api/api-types.mjs'
import * as log from './services/log.mjs';
import CHAT from './services/chat/chat.mjs';

//Import Routes
import logRoutes from './api/log/log.mjs';
import apiRoutes from './api/api.mjs';

import {POST_login, POST_logout, POST_signup } from './api/auth/auth.mjs';
import { GET_partnerProfile, GET_publicProfile, GET_RoleList, GET_userProfile, PATCH_userProfile } from './api/profile/profile.mjs';
import { DELETE_prayerRequest, GET_prayerRequestCircle, GET_profilePrayerRequestSpecific, GET_prayerRequestUser, PATCH_prayerRequestAnswered, POST_prayerRequest } from './api/prayer-request/prayer-request.mjs';

import { CircleRequest, CredentialRequest, ProfileRequest } from './api/auth/auth-types.mjs';
import { authenticatePartner, authenticateCircle, authenticateProfile, authenticateLeader, authenticateAdmin, authenticateIdentity } from './api/auth/authorization.mjs';
import { SocketContact, SocketMessage } from './services/chat/chat-types.mjs';
import { verifyJWT } from './api/auth/auth-utilities.mjs';
import { fetchCircleMessageNames, fetchNames, formatMessageNames } from './services/chat/chat-utilities.mjs';
import { GET_userContacts } from './api/chat/chat.mjs';
import { GET_userCircles } from './api/circle/circle.mjs';
import { DefaultEventsMap } from 'socket.io/dist/typed-events.js';

 

const SERVER_PORT = process.env.SERVER_PORT || 5000;
const apiServer: Application = express();

/********************
   Socket.IO Chat
 *********************/
const httpServer = createServer(apiServer);
const chatIO:Server<DefaultEventsMap, DefaultEventsMap, DefaultEventsMap, any> = new Server(httpServer, { 
    path: '/chat',
    cors: { origin: "*"}
});
httpServer.listen( SERVER_PORT, () => console.log(`Back End Server listening on LOCAL port: ${SERVER_PORT}`));

//Socket Middleware Authenticates JWT before Connect
chatIO.use((socket, next)=> {
    console.log('Requesting to join chat:', socket.handshake.auth);

    if(verifyJWT(socket.handshake.auth.JWT, socket.handshake.auth.userId))  next();
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

//Formatting Request Body
apiServer.use(express.json());

apiServer.post('/signup', POST_signup);
apiServer.get('/resources/role-list', GET_RoleList);
apiServer.post('/login', POST_login);


//***************************************
// #1 - Verify Identity & Cache Profiles
//***************************************
apiServer.use('/api', (request:CredentialRequest, response:Response, next:NextFunction) => authenticateIdentity(request, response, next));

//General API Routes
apiServer.use('/api', apiRoutes);

apiServer.post('/api/logout/:client', POST_logout);

apiServer.get('/api/public/profile/:client', GET_publicProfile);

// apiServer.get('/api/public/circle/:circle', GET_publicCircle);

apiServer.get('/api/contacts', GET_userContacts); //Returns id and Name

apiServer.get('/api/circles', GET_userCircles);



//******************************
// #2 - Verify Partner Status
//******************************
apiServer.use('/api/partner/:client', (request:ProfileRequest, response:Response, next:NextFunction) => authenticatePartner(request, response, next));

apiServer.get('/api/partner/:client', GET_partnerProfile);

apiServer.get('/api/partner/:client/prayer-request', GET_prayerRequestUser);
apiServer.get('/api/partner/:client/prayer-request/:prayer', GET_profilePrayerRequestSpecific);


//******************************
// #3 - Verify Circle Status
//******************************
apiServer.use('/api/circle/:circle', (request:CircleRequest, response:Response, next:NextFunction) => authenticateCircle(request, response, next));

apiServer.get('/api/circle/:circle/prayer-request', GET_prayerRequestCircle);
apiServer.get('/api/circle/:circle/prayer-request/:prayer', GET_profilePrayerRequestSpecific);


//******************************
// #4 - Verify User Profile Access
//******************************
apiServer.use('/api/profile/:client', async (request:ProfileRequest, response:Response, next:NextFunction) => await authenticateProfile(request, response, next));

apiServer.get('/api/profile/:client', GET_userProfile);
apiServer.patch('/api/profile/:client', PATCH_userProfile);

apiServer.get('/api/profile/:client/prayer-request', GET_prayerRequestUser);
apiServer.get('/api/profile/:client/prayer-request/:prayer', GET_profilePrayerRequestSpecific);
apiServer.post('/api/profile/:client/prayer-request', POST_prayerRequest);
apiServer.patch('/api/profile/:client/prayer-request/:prayer/answered', PATCH_prayerRequestAnswered);
apiServer.delete('/api/profile/:client/prayer-request/:prayer', DELETE_prayerRequest);



//******************************
// #5 - Verify Leader Access
//******************************
apiServer.use('/api/circle/:circle/leader', (request:CircleRequest, response:Response, next:NextFunction) => authenticateLeader(request, response, next));


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
    const message = request.method + ' -> ' + request.url + ' = ' + error.message || 'Server Error';
    response.status(error.status || 500).send({status: status, message: message, type: request.method, url: request.originalUrl, params: request.params, query: request.query, header: request.headers, body: request.body});

    if(status < 400) log.event('API Event:', message);
    else if(status >= 400 && status <= 403) log.auth('HTTP user verification failed:', message);
    else log.error('API Server Error:', message);

    console.error("API", status, message, request.method, request.originalUrl, request.params, request.query, request.headers, request.body);
});