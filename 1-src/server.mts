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

//Import Routes
import logRoutes from './api/log/log.mjs';
import apiRoutes from './api/api.mjs';

import {POST_login, POST_logout, POST_signup } from './api/auth/auth.mjs';
import { GET_partnerProfile, GET_publicProfile, GET_userProfile, PATCH_userProfile } from './api/profile/profile.mjs';
import { DELETE_prayerRequest, GET_prayerRequestCircle, GET_profilePrayerRequestSpecific, GET_prayerRequestUser, PATCH_prayerRequestAnswered, POST_prayerRequest } from './api/prayer-request/prayer-request.mjs';

import { CircleRequest, CredentialRequest, ProfileRequest } from './api/auth/auth-types.mjs';
import { authenticatePartner, authenticateCircle, authenticateProfile, authenticateLeader, authenticateAdmin, authenticateIdentity } from './api/auth/authorization.mjs';
import { SocketContact, SocketMessage } from './services/chat/chat-types.mjs';
import { verifyJWT } from './api/auth/auth-utilities.mjs';
import { fetchNames, formatMessageNames } from './services/chat/chat-utilities.mjs';

 

const SERVER_PORT = process.env.SERVER_PORT || 5000;
const apiServer: Application = express();

/********************
   Socket.IO Chat
 *********************/
const httpServer = createServer(apiServer);
const chatIO = new Server(httpServer, { 
    path: '/chat',
    cors: { origin: "*"}
});
httpServer.listen( SERVER_PORT, () => console.log(`Back End Server listening on LOCAL port: ${SERVER_PORT}`));

chatIO.on("connection", (socket) => {
    console.log('Main Connection');
    socket.emit('server', "hello");
  });


const contactMap = new Map<number, string>(); //userId:socketId

const getSocketId = (userId: number):string => contactMap.get(userId);

const getUserId = (socketId: string):number => [...contactMap].find(([key, val]) => val === socketId)[0];


//Socket Middleware Authenticates JWT before Connect
chatIO.use((socket, next)=> {
    console.log('Requesting to join direct chat:', socket.handshake.auth);

    if(verifyJWT(socket.handshake.auth.JWT, socket.handshake.auth.userId)) 
        next();
    else 
        next(new Error('Invalid JWT, Please Login Again to Chat'));
    // console.log('Direct Contacts Online: ', contactMap);
});

chatIO.on("connection", async (socket:Socket) => {
    console.log('\nDirect Chat: New Connection:', socket.handshake.auth.userId, socket.id);
    
    contactMap.set(socket.handshake.auth.userId, socket.id);
    console.log('Direct Contacts Online: ', contactMap);

    //Send All Available Contacts Online //TODO: Filter contacts from database table
    chatIO.emit('contactMap', JSON.stringify(await fetchNames(Array.from(contactMap.keys()))));
    
    //Announce Online
    socket.emit('server', 'Welcome to Direct Chat!'); 
    chatIO.emit('server', `User: ${socket.handshake.auth.userId} has joined Direct Chat!`); 

//Socket Listeners
    socket.on('log', (text:string)=>{
        log.event('Direct Chat Event:', socket.id, getUserId(socket.id), text);
    });

    socket.on('leave', (userId:number)=>{
        console.log('Direct Chat: Leaving:', userId, socket.id);
        chatIO.emit('server', `User ${userId} has left the chat`)
        contactMap.delete(userId);
        console.log('Direct Contacts Online: ', contactMap);
    });

    socket.on('disconnect', ()=>{
        console.log('Direct Chat: Disconnecting:', socket.id);
    });

    socket.on('message', async (content:SocketMessage)=> {
        console.log('Direct Chat: Message:', content, contactMap.get(content.recipientId));

        //Note: Not authenticating Message

        if(contactMap.has(content.recipientId)) {
            const details = await formatMessageNames(content);
            chatIO.to(contactMap.get(content.recipientId)).emit('message', details);
            socket.emit('message', details);
            log.event(`Direct Message: [${content.time}] ${details.senderId}|${details.senderName} to ${content.recipientId}|${content.recipientName}:`, content.message);
        } else 
            socket.emit('server', 'Failed to send message: \"'+content.message+'/"');
        // TODO Send to Database
    });
    

    
  });



/* Middleware  */
apiServer.use(express.static(path.join(__dirname, 'build')));
// apiServer.use(bodyParser.json());
// apiServer.use(bodyParser.urlencoded({ extended: true }));
// apiServer.use(bodyParser.raw());
apiServer.use(cors());

/********************
 Unauthenticated Routes
 *********************/

/* Routes  */ //Order Matters: First Matches
apiServer.get('/', (request: Request, response: Response) => {
    response.status(200).sendFile(path.join(__dirname, 'build', 'index.html'));
});

apiServer.get('/portal', (request: Request, response: Response) => {
    response.status(308).send("Portal Interface is coming Soon!");
});

//Formatting Request Body
apiServer.use(express.json());

apiServer.post('/signup', POST_signup);
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