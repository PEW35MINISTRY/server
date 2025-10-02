import dotenv from 'dotenv';
dotenv.config(); 
import fs, { readFileSync } from 'fs';
import path, { join } from 'path';
const __dirname = path.resolve();
import { execSync } from 'child_process';
import { createServer, request } from 'http';
import express, { Application , Request, Response, NextFunction, response} from 'express';
import { Server, Socket } from 'socket.io';
import bodyParser from 'body-parser';
import cors from 'cors';

//Import Types
import { checkAWSAuthentication, getEnvironment, toStringArray } from './2-services/10-utilities/utilities.mjs';
import { ENVIRONMENT_TYPE, SUPPORTED_IMAGE_EXTENSION_LIST, SENSITIVE_KEYWORDS } from './0-assets/field-sync/input-config-sync/inputField.mjs';
import { ServerDebugErrorResponse, ServerErrorResponse } from './0-assets/field-sync/api-type-sync/utility-types.mjs';
import {Exception, JwtSearchRequest} from './1-api/api-types.mjs'
import { DefaultEventsMap } from 'socket.io/dist/typed-events.js';
import { JwtAdminRequest, JwtCircleRequest, JwtClientPartnerRequest, JwtClientRequest, JwtContentRequest, JwtClientStatusRequest, JwtPrayerRequest, JwtRequest, JwtClientStatusFilterRequest, LogSearchRequest, LogEntryNewRequest } from './1-api/2-auth/auth-types.mjs';
import { JwtCircleClientRequest } from './1-api/4-circle/circle-types.mjs';

//Import Routes
import apiRoutes, { GET_createMockCircle, GET_createMockPrayerRequest, GET_createMockUser, POST_populateDemoUser } from './1-api/api.mjs';
import { DELETE_LogEntryByS3Key, DELETE_LogEntryS3ByDay, GET_LogDefaultList, GET_LogDownloadFile, GET_LogEntryByS3Key, GET_LogSearchList, POST_LogEmailReport, POST_LogEntry, POST_LogPartitionBucket, POST_LogResetFile } from './1-api/1-utility/log.mjs';
import { authenticatePartnerMiddleware, authenticateCircleMembershipMiddleware, authenticateClientAccessMiddleware, authenticateCircleLeaderMiddleware, authenticateAdminMiddleware, jwtAuthenticationMiddleware, authenticateCircleManagerMiddleware, authenticatePrayerRequestRecipientMiddleware, authenticatePrayerRequestRequestorMiddleware, extractCircleMiddleware, extractClientMiddleware, authenticateContentApproverMiddleware, extractContentMiddleware, extractPartnerMiddleware, authenticatePendingPartnerMiddleware, authenticateLeaderMiddleware, authenticateDemoUserMiddleware } from './1-api/2-auth/authorization.mjs';
import { GET_userContacts } from './1-api/7-chat/chat.mjs';
import { POST_JWTLogin, POST_login, POST_logout, POST_emailSubscribe, POST_resetPasswordAdmin } from './1-api/2-auth/auth.mjs';
import { GET_partnerProfile, GET_profileAccessUserList, GET_publicProfile, GET_userProfile, PATCH_userProfile, GET_AvailableAccount, DELETE_userProfile, POST_profileImage, DELETE_profileImage, GET_profileImage, DELETE_flushClientSearchCache, POST_signup, PATCH_profileWalkLevel, GET_contactList, DELETE_contactCache, POST_refreshContactList } from './1-api/3-profile/profile.mjs';
import { GET_circle, POST_newCircle, DELETE_circle, DELETE_circleLeaderMember, DELETE_circleMember, PATCH_circle, POST_circleLeaderAccept, POST_circleMemberAccept, POST_circleMemberJoinAdmin, POST_circleMemberRequest, POST_circleLeaderMemberInvite, DELETE_circleAnnouncement, POST_circleAnnouncement, POST_circleImage, DELETE_circleImage, GET_circleImage, DELETE_flushCircleSearchCache } from './1-api/4-circle/circle.mjs';
import { DELETE_prayerRequest, DELETE_prayerRequestComment, GET_PrayerRequest, GET_PrayerRequestCircleList, GET_PrayerRequestRequestorList, GET_PrayerRequestRequestorResolvedList, GET_PrayerRequestUserList, PATCH_prayerRequest, POST_prayerRequest, POST_prayerRequestComment, POST_prayerRequestCommentIncrementLikeCount, POST_prayerRequestIncrementPrayerCount, POST_prayerRequestResolved } from './1-api/5-prayer-request/prayer-request.mjs';
import { DELETE_contentArchive, DELETE_contentArchiveImage, GET_contentArchiveImage, GET_ContentRequest, GET_UserContentList, PATCH_contentArchive, POST_contentArchiveImage, POST_contentIncrementLikeCount, POST_fetchContentArchiveMetaData, POST_newContentArchive } from './1-api/11-content/content.mjs';
import { DELETE_flushSearchCacheAdmin, GET_SearchList } from './1-api/api-search-utilities.mjs';
import { POST_PartnerContractAccept, DELETE_PartnerContractDecline, DELETE_PartnershipLeave, GET_PartnerList, GET_PendingPartnerList, POST_NewPartnerSearch, DELETE_PartnershipAdmin, DELETE_PartnershipByTypeAdmin, POST_PartnerStatusAdmin, GET_AvailablePartnerList, GET_AllFewerPartnerStatusMap, GET_AllPartnerStatusMap, GET_AllUnassignedPartnerList, GET_AllPartnerPairPendingList } from './1-api/6-partner/partner-request.mjs';
import { DELETE_allUserNotificationDevices, DELETE_notificationDevice, GET_notificationDeviceDetailAdmin, GET_notificationDeviceList, PATCH_notificationDeviceAdmin, PATCH_notificationDeviceName, POST_newNotificationDeviceUser, POST_verifyNotificationDeviceUser } from './1-api/8-notification/notification.mjs';

//Import Services
import * as log from './2-services/10-utilities/logging/log.mjs';
import { initializeDatabase } from './2-services/2-database/database.mjs';
import { verifyJWT } from './1-api/2-auth/auth-utilities.mjs';
import CHAT from './2-services/3-chat/chat.mjs';

/********************
    EXPRESS SEVER
 *********************/
export const SERVER_START_TIMESTAMP:Date = new Date();
const SERVER_PORT = process.env.SERVER_PORT || 5000;
const publicServer: Application = express();
const apiServer: Application = express();

/************************
* SERVER INITIALIZATION *
*************************/
const httpServer = createServer(apiServer).listen( SERVER_PORT, () => console.log(`Back End Server listening on HTTP port: ${SERVER_PORT} at ${SERVER_START_TIMESTAMP.toISOString()}`));
await initializeDatabase(); 
await checkAWSAuthentication();


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
apiServer.use(cors());
 
/***************************************
 *   Unauthenticated Public Routes     *
 * Order Matters, executes First Match *
 ***************************************/
apiServer.use(['/', '/website'], express.static(path.join(process.env.SERVER_PATH || __dirname, 'website')));
// apiServer.get('/', (request:Request, response:Response) => response.status(200).sendFile(path.join(process.env.SERVER_PATH || __dirname, 'website', 'index.html')));

apiServer.get('/website/*', (request:Request, response:Response) => response.status(301).redirect('/website'));
apiServer.get('/website', (request:Request, response:Response) => response.status(200).sendFile(path.join(process.env.SERVER_PATH || __dirname, 'website', 'index.html')));

apiServer.use(['/portal', '/login', '/signup'], express.static(path.join(process.env.SERVER_PATH || __dirname, 'portal')));

apiServer.get('/portal', (request:Request, response:Response) => {
  response.status(200).sendFile(path.join(process.env.SERVER_PATH || __dirname, 'portal', 'index.html'));
});

apiServer.get(['/portal', '/portal/*', '/login', '/signup'], (request:Request, response:Response) => {
  response.status(200).sendFile(path.join(process.env.SERVER_PATH || __dirname, 'portal', 'index.html'));
});



/*********************
 * PUBLIC API ROUTES *
 *********************/
apiServer.use(express.json()); //Formatting Request Body

apiServer.get('/resources/available-account', GET_AvailableAccount); //Utility for available email/username

apiServer.post('/subscribe', POST_emailSubscribe);

apiServer.post('/signup', POST_signup); //Optional query: populate=true

apiServer.post('/login', POST_login);

apiServer.get('/version', (request: Request, response: Response, next:NextFunction) => {
    try {
        const packageJsonPath:string = join(__dirname, 'package.json');
        const packageJson:{version:string} = JSON.parse(readFileSync(packageJsonPath, 'utf8'));
        const version = packageJson.version ?? '0.0.0';
        const environment = process.env.ENVIRONMENT ?? 'ENVIRONMENT';
        const gitBranch = process.env.GIT_BUILD_BRANCH ?? 'BRANCH';
        const gitCommit = process.env.GIT_BUILD_COMMIT ?? 'COMMIT';
        response.status(200).send(`${version} | ${environment} | ${gitBranch} @ ${gitCommit} | ${SERVER_START_TIMESTAMP.toISOString()}`);

    } catch(error) {
        log.warn('Failed to Parse Server Version:', error, error.message);
        response.status(200).send(`Version Unavailable | ${SERVER_START_TIMESTAMP.toISOString()}`);
    }
});


/************************************************************************** 
*             STATIC HTML WEBPAGES                                        *
* Automatically picks up html files in: 0-compiled/0-assets/static-pages/ *
* Unmatched routes return 404 (not-found.html)                            *
***************************************************************************/
//Production uses AWS CDN
if(getEnvironment() === ENVIRONMENT_TYPE.LOCAL) {
  apiServer.use('/assets', express.static(path.join(__dirname, '1-src', '0-assets', 'public')));
}

apiServer.get('/*', (request:JwtRequest, response:Response, next:NextFunction) => {
  if(request.path.startsWith('/api')) //All other mis-matches receive 404
    return next();

  const requestedPath = request.path.endsWith('/') ? request.path.slice(0, -1) : request.path;
  const htmlFilePath = path.join(__dirname, '0-compiled', '0-assets', 'static-pages', requestedPath + '.html');

  fs.access(htmlFilePath, fs.constants.F_OK, (err) => {
    if(err) {
      response.status(404).sendFile(path.join(__dirname, '0-compiled', '0-assets', 'static-pages', 'not-found.html'));
    } else {
      response.status(200).sendFile(htmlFilePath);
    }
  });
});



/************************************************************/
/*            Authenticate JWT Validity                     */
/* cache: request.jwtUserID, request.jwtUserRole (max role) */
/************************************************************/
apiServer.use('/api', (request:JwtRequest, response:Response, next:NextFunction) => jwtAuthenticationMiddleware(request, response, next));

//General API Routes
apiServer.use('/api', apiRoutes);

apiServer.post('/api/authenticate', POST_JWTLogin);

apiServer.post('/api/logout', POST_logout);

apiServer.get('/api/contacts', GET_userContacts); //Returns id and Name

apiServer.get('/api/search-list/:type', (request:JwtSearchRequest, response:Response, next:NextFunction) => GET_SearchList(undefined, request, response, next)); //(Handles authentication)

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

apiServer.get('/api/prayer-request-edit/:prayer', GET_PrayerRequest);
apiServer.patch('/api/prayer-request-edit/:prayer', PATCH_prayerRequest);
apiServer.post('/api/prayer-request-edit/:prayer/resolved', POST_prayerRequestResolved);
apiServer.delete('/api/prayer-request-edit/:prayer', DELETE_prayerRequest);


/************************************************************/
/* Extract Partner Pending Status | cache: request.clientID */
/************************************************************/
apiServer.use('/api/partner-pending/:client', (request:JwtClientRequest, response:Response, next:NextFunction) => extractClientMiddleware(request, response, next));
apiServer.use('/api/partner-pending/:client', (request:JwtClientRequest, response:Response, next:NextFunction) => authenticatePendingPartnerMiddleware(request, response, next));

apiServer.post('/api/partner-pending/:client/accept', POST_PartnerContractAccept);
apiServer.delete('/api/partner-pending/:client/decline', DELETE_PartnerContractDecline);


/****************************************************/
/* Extract Partner Status | cache: request.clientID */
/****************************************************/
apiServer.use('/api/partner/:client', (request:JwtClientRequest, response:Response, next:NextFunction) => extractClientMiddleware(request, response, next));
apiServer.use('/api/partner/:client', (request:JwtClientRequest, response:Response, next:NextFunction) => authenticatePartnerMiddleware(request, response, next));

apiServer.get('/api/partner/:client', GET_partnerProfile);
apiServer.delete('/api/partner/:client/leave', DELETE_PartnershipLeave);

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

apiServer.post('/api/user/:client/demo-populate', POST_populateDemoUser);

apiServer.post('/api/user/:client/logout', POST_logout);

apiServer.get('/api/user/:client', GET_userProfile);
apiServer.patch('/api/user/:client', PATCH_userProfile);
apiServer.delete('/api/user/:client', DELETE_userProfile);
apiServer.delete('/api/user/:client/image', DELETE_profileImage);
apiServer.patch('/api/user/:client/walk-level', PATCH_profileWalkLevel);

apiServer.get('/api/user/:client/contact-list', GET_contactList);
apiServer.post('/api/user/:client/update-contacts', POST_refreshContactList);
apiServer.delete('/api/user/:client/contact-list-cache', DELETE_contactCache);

apiServer.get('/api/user/:client/prayer-request-list', GET_PrayerRequestRequestorList);
apiServer.get('/api/user/:client/prayer-request-resolved-list', GET_PrayerRequestRequestorResolvedList);

apiServer.use('/api/user/:client/mock-prayer-request', (request:JwtRequest, response:Response, next:NextFunction) => authenticateDemoUserMiddleware(request, response, next));
apiServer.get('/api/user/:client/mock-prayer-request', GET_createMockPrayerRequest);

apiServer.post('/api/user/:client/notification/device', POST_newNotificationDeviceUser)
apiServer.delete('/api/user/:client/notification/device/:device', DELETE_notificationDevice);
apiServer.post('/api/user/:client/notification/device/:device/verify', POST_verifyNotificationDeviceUser)
apiServer.patch('/api/user/:client/notification/device/:device/device-name', PATCH_notificationDeviceName);

apiServer.get('/api/user/:client/notification/device-list', GET_notificationDeviceList);
apiServer.delete('/api/user/:client/notification/device-all', DELETE_allUserNotificationDevices);

apiServer.get('/api/user/:client/partner-list', (request:JwtClientStatusFilterRequest, response:Response, next:NextFunction) => GET_PartnerList(undefined, request, response, next));
apiServer.get('/api/user/:client/partner-pending-list', GET_PendingPartnerList);
apiServer.post('/api/user/:client/new-partner', POST_NewPartnerSearch);

apiServer.get('/api/user/:client/content-list', GET_UserContentList);

apiServer.use('/api/user/:client/content/:content', (request:JwtContentRequest, response:Response, next:NextFunction) => extractContentMiddleware(request, response, next));
apiServer.post('/api/user/:client/content/:content/like', POST_contentIncrementLikeCount);

apiServer.use(bodyParser.raw({type: ['image/png', 'image/jpg', 'image/jpeg'], limit: process.env.IMAGE_UPLOAD_SIZE || '5mb'}));
apiServer.post('/api/user/:client/image/:file', POST_profileImage);


/******************************************************/
/* Extract Circle Parameter | cache: request.circleID */
/******************************************************/
apiServer.use('/api/circle/:circle', (request:JwtCircleRequest, response:Response, next:NextFunction) => extractCircleMiddleware(request, response, next));

apiServer.get('/api/circle/:circle', GET_circle);  //Handles relevant circle status
apiServer.get('/api/circle/:circle/image', GET_circleImage);

apiServer.post('/api/circle/:circle/request', POST_circleMemberRequest);
apiServer.post('/api/circle/:circle/accept', POST_circleMemberAccept); //Existing Circle Membership Invite must exist (User Accepts)
apiServer.delete('/api/circle/:circle/leave', DELETE_circleMember);


/**********************************/
/* Authenticate Circle Membership */
/**********************************/
apiServer.use('/api/circle/:circle', (request:JwtCircleRequest, response:Response, next:NextFunction) => authenticateCircleMembershipMiddleware(request, response, next));

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

apiServer.use(bodyParser.raw({type: SUPPORTED_IMAGE_EXTENSION_LIST.map(ext => `image/${ext}`), limit: process.env.IMAGE_UPLOAD_SIZE || '5mb'}));
apiServer.post('/api/leader/circle/:circle/image/:file', POST_circleImage);


/*******************************************************************/
/* Authenticate Current CIRCLE_MANAGER role (Circle not specified) */
/*******************************************************************/
apiServer.use('/api/leader', (request:JwtRequest, response:Response, next:NextFunction) => authenticateLeaderMiddleware(request, response, next));

apiServer.post('/api/leader/circle', POST_newCircle);

apiServer.use('/api/leader/mock-circle', (request:JwtRequest, response:Response, next:NextFunction) => authenticateDemoUserMiddleware(request, response, next));
apiServer.get('/api/leader/mock-circle', GET_createMockCircle);


/*******************************************************************/
/* Authenticate Current CIRCLE_MANAGER role (Circle not specified) */
/*******************************************************************/
apiServer.use('/api/manager', (request:JwtRequest, response:Response, next:NextFunction) => authenticateCircleManagerMiddleware(request, response, next));

apiServer.get('/api/manager/profile-access', GET_profileAccessUserList);


/**************************************/
/* Authenticate CONTENT_APPROVER Role */
/**************************************/
apiServer.use('/api/content-archive', (request:JwtRequest, response:Response, next:NextFunction) => authenticateContentApproverMiddleware(request, response, next));

apiServer.post('/api/content-archive/', POST_newContentArchive);
apiServer.post('/api/content-archive/utility/meta-data', POST_fetchContentArchiveMetaData); //Utility doesn't save to model

apiServer.use('/api/content-archive/:content', (request:JwtContentRequest, response:Response, next:NextFunction) => extractContentMiddleware(request, response, next));
apiServer.get('/api/content-archive/:content', GET_ContentRequest);
apiServer.patch('/api/content-archive/:content', PATCH_contentArchive);
apiServer.delete('/api/content-archive/:content', DELETE_contentArchive);

apiServer.get('/api/content-archive/:content/image', GET_contentArchiveImage);
apiServer.delete('/api/content-archive/:content/image', DELETE_contentArchiveImage);

apiServer.use(bodyParser.raw({type: SUPPORTED_IMAGE_EXTENSION_LIST.map(ext => `image/${ext}`), limit: process.env.IMAGE_UPLOAD_SIZE || '5mb'}));
apiServer.post('/api/content-archive/:content/image/:file', POST_contentArchiveImage);


/***********************************/
/* Authenticate Current ADMIN Role */
/***********************************/
apiServer.use('/api/admin', (request:JwtAdminRequest, response:Response, next:NextFunction) => authenticateAdminMiddleware(request, response, next));

apiServer.get('/api/admin/mock-user', GET_createMockUser); //Optional query: populate=true

apiServer.use(express.text());
apiServer.delete('/api/admin/flush-search-cache/:type', (request:JwtSearchRequest, response:Response, next:NextFunction) => DELETE_flushSearchCacheAdmin(undefined, request, response, next)); //(Handles authentication)

apiServer.get('/api/admin/log', GET_LogEntryByS3Key);
apiServer.delete('/api/admin/log', DELETE_LogEntryByS3Key);
apiServer.delete('/api/admin/log/day', DELETE_LogEntryS3ByDay);
apiServer.get('/api/admin/log/default', GET_LogDefaultList);
apiServer.post('/api/admin/log/athena-partition', POST_LogPartitionBucket);
apiServer.get('/api/admin/log/:type', (request:LogSearchRequest, response:Response, next:NextFunction) => GET_LogSearchList(undefined, request, response, next));
apiServer.post('/api/admin/log/:type', (request:LogEntryNewRequest, response:Response, next:NextFunction) => POST_LogEntry(undefined, request, response, next));
apiServer.post('/api/admin/log/:type/reset', (request:LogEntryNewRequest, response:Response, next:NextFunction) => POST_LogResetFile(undefined, request, response, next));
apiServer.get('/api/admin/log/:type/download', (request:LogEntryNewRequest, response:Response, next:NextFunction) => GET_LogDownloadFile(undefined, request, response, next));
apiServer.post('/api/admin/log/:type/report', (request:LogEntryNewRequest, response:Response, next:NextFunction) => POST_LogEmailReport(undefined, request, response, next));

apiServer.use('/api/admin/client/:client', (request:JwtClientRequest, response:Response, next:NextFunction) => extractClientMiddleware(request, response, next));
apiServer.post('/api/admin/client/:client/reset-password', POST_resetPasswordAdmin);

apiServer.get('/api/admin/notification/device/:device', GET_notificationDeviceDetailAdmin);
apiServer.patch('/api/admin/notification/device/:device', PATCH_notificationDeviceAdmin);

apiServer.use('/api/admin/circle/:circle/join/:client', (request:JwtCircleClientRequest, response:Response, next:NextFunction) => extractCircleMiddleware(request, response, next));
apiServer.use('/api/admin/circle/:circle/join/:client', (request:JwtCircleClientRequest, response:Response, next:NextFunction) => extractClientMiddleware(request, response, next));
apiServer.post('/api/admin/circle/:circle/join/:client', POST_circleMemberJoinAdmin);

/* Partnerships */
apiServer.get('/api/admin/partnership/unassigned-list', GET_AllUnassignedPartnerList);
apiServer.get('/api/admin/partnership/pending-list', GET_AllPartnerPairPendingList);
apiServer.get('/api/admin/partnership/status-map', GET_AllPartnerStatusMap);
apiServer.get('/api/admin/partnership/fewer-status-map', GET_AllFewerPartnerStatusMap);

apiServer.use('/api/admin/partnership/client/:client', (request:JwtClientStatusRequest, response:Response, next:NextFunction) => extractClientMiddleware(request, response, next));
apiServer.get('/api/admin/partnership/client/:client/available', GET_AvailablePartnerList);
apiServer.delete('/api/admin/partnership/client/:client/status/:status', (request:JwtClientPartnerRequest, response:Response, next:NextFunction) => DELETE_PartnershipByTypeAdmin(undefined, request, response, next));

apiServer.use('/api/admin/partnership/client/:client/partner/:partner', (request:JwtClientPartnerRequest, response:Response, next:NextFunction) => extractPartnerMiddleware(request, response, next));
apiServer.post('/api/admin/partnership/client/:client/partner/:partner/status/:status', (request:JwtClientPartnerRequest, response:Response, next:NextFunction) => POST_PartnerStatusAdmin(undefined, request, response, next));
apiServer.delete('/api/admin/partnership/client/:client/partner/:partner', DELETE_PartnershipAdmin);



//******************/
/* Error Handling  */
/*******************/
apiServer.use('/error', (request: Request, response:Response, next: NextFunction) => {
    next(new Exception(500, 'EXPECTED ERROR - UI Defined Issue', 'Please Report Error'));
});

apiServer.use((request: Request, response:Response, next: NextFunction) => {
    next(new Exception(404, `Invalid Request: ${request.originalUrl}`));
});

apiServer.use((error: Exception, request: Request, response:Response, next: NextFunction) => {
    const status = error.status || 500;
    const message = error.message || 'Server Error';
    const action = request.method + ' -> ' + request.url + ' = ' + message;
    const notification = error.notification || ((status == 400) ? 'Missing details'
                            : (status == 401) ? 'Sorry not permitted'
                            : (status == 404) ? 'Not found'
                            : (status == 413) ? `File larger than ${process.env.IMAGE_UPLOAD_SIZE}`
                            : 'Unknown error has occurred');

    const errorResponse:ServerErrorResponse = {
        status: status,
        notification: notification
    }

    const debugResponse:ServerDebugErrorResponse = {
        ...errorResponse,
        message: message,
        action: action,
        jwtUserID: (request as JwtRequest).jwtUserID ?? -1,
        jwtUserRole: (request as JwtRequest)?.jwtUserRole ?? 'UNKNOWN',
        type: request.method,
        url: request.originalUrl,
        params: JSON.stringify(request.params),
        query: JSON.stringify(request.query),
        header: request.headers,
        body: request.body,
    };

    if(getEnvironment() === ENVIRONMENT_TYPE.PRODUCTION)
        response.status(error.status || 500).send(errorResponse);

    else
        response.status(error.status || 500).send(debugResponse);


    /* Logging API Errors */
    const sanitizedRequestFields:string[] = toStringArray(debugResponse, SENSITIVE_KEYWORDS, 100);

    if(status < 400) log.event(`API | ${status} | Event:`, message, ...sanitizedRequestFields);
    else if(status === 400) log.warn('API | 400 | User Request Invalid:', message, ...sanitizedRequestFields);
    else if(status === 401) log.auth('API | 401 | User Unauthorized:', message);
    else if(status === 403 || (status === 405)) log.auth('API | 403 | Forbidden Request:', message, ...sanitizedRequestFields);
    else if(status === 413) log.warn(`API | 413 | File larger than ${process.env.IMAGE_UPLOAD_SIZE}:`, message);

    else if(status === 404 && getEnvironment() === ENVIRONMENT_TYPE.LOCAL) log.warn('API | 404 | Request Not Found:', message);
    else if(status !== 404) log.errorWithoutTrace(`API | ${status} | Server Error:`, message, ...sanitizedRequestFields);
});
