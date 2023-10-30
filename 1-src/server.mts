import dotenv from 'dotenv';
dotenv.config(); 
import fs from 'fs';
import path from 'path';
const __dirname = path.resolve();
import { createServer } from 'http';
import express, { Application , Request, Response, NextFunction} from 'express';
import { Server, Socket } from 'socket.io';
import bodyParser from 'body-parser';
import cors from 'cors';

//Import Types
import {Exception} from './1-api/api-types.mjs'
import { DefaultEventsMap } from 'socket.io/dist/typed-events.js';
import { JwtAdminRequest, JwtCircleRequest, JwtClientRequest, JwtPrayerRequest, JwtRequest } from './1-api/2-auth/auth-types.mjs';
import { JwtCircleClientRequest } from './1-api/4-circle/circle-types.mjs';

//Import Routes
import logRoutes from './1-api/1-log/log.mjs';
import apiRoutes from './1-api/api.mjs';
import { authenticatePartnerMiddleware, authenticateCircleMembershipMiddleware, authenticateClientAccessMiddleware, authenticateCircleLeaderMiddleware, authenticateAdminMiddleware, jwtAuthenticationMiddleware, authenticateLeaderMiddleware, authenticatePrayerRequestRecipientMiddleware, authenticatePrayerRequestRequestorMiddleware, extractCircleMiddleware, extractClientMiddleware } from './1-api/2-auth/authorization.mjs';
import { GET_userContacts } from './1-api/7-chat/chat.mjs';
import { GET_allUserCredentials, GET_jwtVerify, POST_login, POST_logout, POST_authorization_reset } from './1-api/2-auth/auth.mjs';
import { GET_EditProfileFields, GET_partnerProfile, GET_profileAccessUserList, GET_publicProfile, GET_RoleList, GET_SignupProfileFields, GET_userProfile, PATCH_userProfile, GET_AvailableAccount, DELETE_userProfile, POST_profileImage, DELETE_profileImage, GET_profileImage, POST_signup } from './1-api/3-profile/profile.mjs';
import { GET_publicCircle, GET_circle, POST_newCircle, DELETE_circle, DELETE_circleLeaderMember, DELETE_circleMember, PATCH_circle, POST_circleLeaderAccept, POST_circleMemberAccept, POST_circleMemberJoinAdmin, POST_circleMemberRequest, POST_circleLeaderMemberInvite, DELETE_circleAnnouncement, POST_circleAnnouncement, POST_circleImage, DELETE_circleImage, GET_circleImage } from './1-api/4-circle/circle.mjs';
import { DELETE_prayerRequest, DELETE_prayerRequestComment, GET_PrayerRequest, GET_PrayerRequestRequestorDetails, GET_PrayerRequestCircleList, GET_PrayerRequestRequestorList, GET_PrayerRequestRequestorResolvedList, GET_PrayerRequestUserList, PATCH_prayerRequest, POST_prayerRequest, POST_prayerRequestComment, POST_prayerRequestCommentIncrementLikeCount, POST_prayerRequestIncrementPrayerCount, POST_prayerRequestResolved } from './1-api/5-prayer-request/prayer-request.mjs';

//Import Services
import * as log from './2-services/log.mjs';
import { verifyJWT } from './1-api/2-auth/auth-utilities.mjs';
import CHAT from './2-services/3-chat/chat.mjs';

/********************
    EXPRESS SEVER
 *********************/
const SERVER_PORT = process.env.SERVER_PORT || 5000;
const publicServer: Application = express();
const apiServer: Application = express();

/********************
   Socket.IO Chat
 *********************/
const httpServer = createServer(apiServer).listen( SERVER_PORT, () => console.log(`Back End Server listening on HTTP port: ${SERVER_PORT}`));


//***LOCAL ENVIRONMENT****/ only HTTP | AWS uses loadBalancer to redirect HTTPS
const chatIO:Server<DefaultEventsMap, DefaultEventsMap, DefaultEventsMap, any> = new Server(httpServer, { 
    path: '/chat',
    cors: { origin: "*"}
});

//Socket Middleware Authenticates JWT before Connect
chatIO.use((socket, next)=> {
    log.event('Requesting to join chat:', socket.handshake.auth);

    if(verifyJWT(socket.handshake.auth.JWT)) next();
    else  next(new Error('Invalid JWT, Please Login Again to Chat'));
});

/*  Initialize Direct and Circle Chat */
CHAT(chatIO);

/* Middleware  */
// apiServer.use(express.static(path.join(process.env.SERVER_PATH || __dirname, 'build')));
// apiServer.use(bodyParser.json());
// apiServer.use(bodyParser.urlencoded({ extended: true }));
// apiServer.use(bodyParser.raw());
apiServer.use(cors());

/********************
 HTTP Routes
 *********************/
 publicServer.use(cors());
 publicServer.use(express.static(path.join(process.env.SERVER_PATH || __dirname, 'website')));
 publicServer.get('/', (request: Request, response: Response) => {
     response.status(200).sendFile(path.join(process.env.SERVER_PATH || __dirname, 'website', 'index.html'));
 });
 
/********************
 Unauthenticated Routes
 *********************/

/* Routes  */ //Order Matters: First Matches
apiServer.use(express.static(path.join(process.env.SERVER_PATH || __dirname, 'website')));
apiServer.get('/', (request: Request, response: Response) => {
    response.status(200).sendFile(path.join(process.env.SERVER_PATH || __dirname, 'website', 'index.html'));
});

apiServer.get('/website/*', (request: Request, response: Response) => {
    response.status(301).redirect('/website');
});

apiServer.get('/website', (request: Request, response: Response) => {
    response.status(200).sendFile(path.join(process.env.SERVER_PATH || __dirname, 'website', 'index.html'));
});

apiServer.use(express.static(path.join(process.env.SERVER_PATH || __dirname, 'portal')));
apiServer.get('/portal/*', (request: Request, response: Response) => {
    response.status(301).redirect('/portal');
});

apiServer.get('/portal', (request: Request, response: Response) => {
    response.status(200).sendFile(path.join(process.env.SERVER_PATH || __dirname, 'portal', 'index.html'));
});

apiServer.get('/login', (request: Request, response: Response) => {
    response.status(200).sendFile(path.join(process.env.SERVER_PATH || __dirname, 'portal', 'index.html'));
});

apiServer.get('/signup', (request: Request, response: Response) => {
    response.status(200).sendFile(path.join(process.env.SERVER_PATH || __dirname, 'portal', 'index.html'));
});

//Formatting Request Body
apiServer.use(express.json());

apiServer.post('/signup', POST_signup);

apiServer.get('/resources/role-list', GET_RoleList);
apiServer.get('/resources/available-account', GET_AvailableAccount);

apiServer.get('/resources/signup-fields/:role?', GET_SignupProfileFields);

apiServer.post('/login', POST_login);

//TODO: Temporary Debugging
apiServer.get('/login/credentials', GET_allUserCredentials);


/************************************************************/
/*            Authenticate JWT Validity                     */
/* cache: request.jwtUserID, request.jwtUserRole (max role) */
/************************************************************/
apiServer.use('/api', (request:JwtRequest, response:Response, next:NextFunction) => jwtAuthenticationMiddleware(request, response, next));

//General API Routes
apiServer.use('/api', apiRoutes);

apiServer.get('/api/authenticate', GET_jwtVerify);

apiServer.post('/api/logout', POST_logout);

apiServer.get('/api/contacts', GET_userContacts); //Returns id and Name

apiServer.get('/api/user/profile/edit-fields', GET_EditProfileFields);

apiServer.get('/api/prayer-request/user-list', GET_PrayerRequestUserList);
apiServer.post('/api/prayer-request', POST_prayerRequest);


/*****************************************************************************/
/* Authenticate Recipient to Prayer Request | cache: request.prayerRequestID */
/*****************************************************************************/
apiServer.use('/api/prayer-request/:prayer', (request:JwtPrayerRequest, response:Response, next:NextFunction) => authenticatePrayerRequestRecipientMiddleware(request, response, next));

apiServer.get('/api/prayer-request/:prayer', GET_PrayerRequest);
apiServer.post('/api/prayer-request/:prayer/like', POST_prayerRequestIncrementPrayerCount);
apiServer.post('/api/prayer-request/:prayer/comment/:comment/like', POST_prayerRequestCommentIncrementLikeCount);
apiServer.post('/api/prayer-request/:prayer/comment', POST_prayerRequestComment);
apiServer.delete('/api/prayer-request/:prayer/comment/:comment', DELETE_prayerRequestComment);


/*****************************************************************************/
/* Authenticate Requestor to Prayer Request | cache: request.prayerRequestID */
/*****************************************************************************/
apiServer.use('/api/prayer-request-edit/:prayer', (request:JwtPrayerRequest, response:Response, next:NextFunction) => authenticatePrayerRequestRequestorMiddleware(request, response, next));

apiServer.get('/api/prayer-request-edit/:prayer', GET_PrayerRequestRequestorDetails);
apiServer.patch('/api/prayer-request-edit/:prayer', PATCH_prayerRequest);
apiServer.post('/api/prayer-request-edit/:prayer/resolved', POST_prayerRequestResolved);
apiServer.delete('/api/prayer-request-edit/:prayer', DELETE_prayerRequest);


/*********************************************************/
/* Authenticate Partner Status | cache: request.clientID */
/*********************************************************/
apiServer.use('/api/partner/:client', (request:JwtClientRequest, response:Response, next:NextFunction) => extractClientMiddleware(request, response, next));
apiServer.use('/api/partner/:client', (request:JwtClientRequest, response:Response, next:NextFunction) => authenticatePartnerMiddleware(request, response, next));

apiServer.get('/api/partner/:client', GET_partnerProfile);

apiServer.get('/api/partner/:client/prayer-request-list', GET_PrayerRequestRequestorList);


/******************************************************/
/* Extract Circle Parameter | cache: request.clientID */
/******************************************************/
apiServer.use('/api/user/:client', (request:JwtClientRequest, response:Response, next:NextFunction) => extractClientMiddleware(request, response, next));

apiServer.get('/api/user/:client/public', GET_publicProfile);
apiServer.get('/api/user/:client/image', GET_profileImage);


/**********************************************/
/* Authenticate User access to Client profile */
/**********************************************/
apiServer.use('/api/user/:client', async (request:JwtClientRequest, response:Response, next:NextFunction) => await authenticateClientAccessMiddleware(request, response, next));

apiServer.post('/api/user/:client/logout', POST_logout);

apiServer.get('/api/user/:client', GET_userProfile);
apiServer.patch('/api/user/:client', PATCH_userProfile);
apiServer.delete('/api/user/:client', DELETE_userProfile);
apiServer.delete('/api/user/:client/image', DELETE_profileImage);

apiServer.get('/api/user/:client/prayer-request-list', GET_PrayerRequestRequestorList);
apiServer.get('/api/user/:client/prayer-request-resolved-list', GET_PrayerRequestRequestorResolvedList);

apiServer.use(bodyParser.raw({type: ['image/png', 'image/jpg', 'image/jpeg'], limit: process.env.IMAGE_UPLOAD_SIZE || '5mb'}));
apiServer.post('/api/user/:client/image/:file', POST_profileImage);


/******************************************************/
/* Extract Circle Parameter | cache: request.circleID */
/******************************************************/
apiServer.use('/api/circle/:circle', (request:JwtCircleRequest, response:Response, next:NextFunction) => extractCircleMiddleware(request, response, next));

apiServer.get('/api/circle/:circle/public', GET_publicCircle);
apiServer.get('/api/circle/:circle/image', GET_circleImage);

apiServer.post('/api/circle/:circle/request', POST_circleMemberRequest);
apiServer.post('/api/circle/:circle/accept', POST_circleMemberAccept); //Existing Circle Membership Invite must exist (Student Accepts)
apiServer.delete('/api/circle/:circle/leave', DELETE_circleMember);


/**********************************/
/* Authenticate Circle Membership */
/**********************************/
apiServer.use('/api/circle/:circle', (request:JwtCircleRequest, response:Response, next:NextFunction) => authenticateCircleMembershipMiddleware(request, response, next));

apiServer.get('/api/circle/:circle', GET_circle);

apiServer.get('/api/circle/:circle/prayer-request-list', GET_PrayerRequestCircleList);


/*******************************************/
/* Authenticate leader of specified circle */
/*******************************************/
apiServer.use('/api/leader/circle/:circle', (request:JwtCircleRequest, response:Response, next:NextFunction) => extractCircleMiddleware(request, response, next));
apiServer.use('/api/leader/circle/:circle', (request:JwtCircleRequest, response:Response, next:NextFunction) => authenticateCircleLeaderMiddleware(request, response, next));

apiServer.get('/api/leader/circle/:circle', GET_circle);
apiServer.patch('/api/leader/circle/:circle', PATCH_circle);
apiServer.delete('/api/leader/circle/:circle', DELETE_circle);
apiServer.delete('/api/leader/circle/:circle/image', DELETE_circleImage);

apiServer.post('/api/leader/circle/:circle/announcement', POST_circleAnnouncement);
apiServer.delete('/api/leader/circle/:circle/announcement/:announcement', DELETE_circleAnnouncement);

apiServer.use('/api/leader/circle/:circle/client/:client', (request:JwtCircleClientRequest, response:Response, next:NextFunction) => extractClientMiddleware(request, response, next));
apiServer.post('/api/leader/circle/:circle/client/:client/invite', POST_circleLeaderMemberInvite);
apiServer.post('/api/leader/circle/:circle/client/:client/accept', POST_circleLeaderAccept); //Existing Circle Membership Request must exist (Leader Accepts)
apiServer.delete('/api/leader/circle/:circle/client/:client/leave', DELETE_circleLeaderMember);

apiServer.use(bodyParser.raw({type: ['image/png', 'image/jpg', 'image/jpeg'], limit: process.env.IMAGE_UPLOAD_SIZE || '5mb'}));
apiServer.post('/api/leader/circle/:circle/image/:file', POST_circleImage);


/******************************************************************/
/* Authenticate Current CIRCLE_LEADER role (Circle not specified) */
/******************************************************************/
apiServer.use('/api/leader', (request:JwtRequest, response:Response, next:NextFunction) => authenticateLeaderMiddleware(request, response, next));

apiServer.get('/api/leader/profile-access', GET_profileAccessUserList);

apiServer.post('/api/leader/circle', POST_newCircle);


/***********************************/
/* Authenticate Current ADMIN Role */
/***********************************/
apiServer.use('/api/admin', (request:JwtAdminRequest, response:Response, next:NextFunction) => authenticateAdminMiddleware(request, response, next));


apiServer.use(express.text());
apiServer.use('/api/admin/log', logRoutes);
apiServer.post('/api/admin/authorization-reset', POST_authorization_reset);

apiServer.use('/api/admin/circle/:circle/join/:client', (request:JwtCircleClientRequest, response:Response, next:NextFunction) => extractCircleMiddleware(request, response, next));
apiServer.use('/api/admin/circle/:circle/join/:client', (request:JwtCircleClientRequest, response:Response, next:NextFunction) => extractClientMiddleware(request, response, next));
apiServer.post('/api/admin/circle/:circle/join/:client', POST_circleMemberJoinAdmin);


//******************/
/* Error Handling  */
/*******************/
apiServer.use((request: Request, response:Response, next: NextFunction) => {
    next(new Exception(404, "Invalid Request"));
});

apiServer.use((error: Exception, request: Request, response:Response, next: NextFunction) => {
    const status = error.status || 500;
    const message = error.message || 'Server Error';
    const action = request.method + ' -> ' + request.url + ' = ' + message;
    const notification = error.notification || ((status == 400) ? 'Missing details'
                            : (status == 401) ? 'Sorry not permitted'
                            : (status == 404) ? 'Not found'
                            : 'Unknown error has occurred');

    const errorResponse:ServerErrorResponse = {
        status: status,
        notification: notification,
        message: message,
        action: action,
        type: request.method,
        url: request.originalUrl,
        params: request.params?.toString(),
        query: request.query?.toString(),
        header: request.headers,
        body: request.body
    }
    response.status(error.status || 500).send(errorResponse);

    if(status < 400) log.event(`API | ${status} | Event:`, message);
    else if(status === 400) log.warn('API | 400 | User Request Invalid:', message);
    else if(status === 401) log.auth('API   401 | User Unauthorized:', message);
    else if(status === 404) log.warn('API | 404 | Request Not Found:', message);
    else log.error(`API | ${status} | Server Error:`, message);
});

//Must match Portal in app-types.tsx
export type ServerErrorResponse = {
    status: number, 
    notification: string,
    message: string,
    action: string,
    type: string,
    url: string,
    params: string,
    query: string,
    header: string | object,
    body: string | object
};