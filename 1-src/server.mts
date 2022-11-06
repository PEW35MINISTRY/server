import dotenv from 'dotenv';
dotenv.config(); 
import path from 'path';
const __dirname = path.resolve();
import express, { Application , Request, Response, NextFunction, Errback} from 'express';
import bodyParser from 'body-parser';
import cors from 'cors';
import {Exception} from './api/api-types.mjs'
import * as log from './services/log.mjs';
 

const SERVER_PORT = process.env.SERVER_PORT || 5000;
const apiServer: Application = express();
apiServer.listen( SERVER_PORT, () => console.log(`Back End Server listening on LOCAL port: ${SERVER_PORT}`));

/* Middleware  */
apiServer.use(express.static(path.join(__dirname, 'build')));
apiServer.use(bodyParser.json());
apiServer.use(bodyParser.urlencoded({ extended: true }));
apiServer.use(bodyParser.raw());
apiServer.use(cors());

/* Routes  */ //Order Matters: First Matches
apiServer.get('/', (request: Request, response: Response) => {
    response.sendFile(path.join(__dirname, 'build', 'index.html'));
});

apiServer.get('/portal', (request: Request, response: Response) => {
    response.status(308).send("Portal Interface is coming Soon!");
});

/* API Routes  */
import apiRoutes from './api/api.mjs';
apiServer.use('/api', apiRoutes);

import logRoutes from './api/log/log.mjs';
apiServer.use('/api/log', logRoutes);

import authRoutes from './api/auth/auth.mjs';
apiServer.use('/api/auth', authRoutes);

import profileRoutes from './api/profile/profile.mjs';
apiServer.use('/api/profile', profileRoutes);

import prayerRequestRoutes from './api/prayer-request/prayer-request.mjs';
apiServer.use('/api/prayer-request', prayerRequestRoutes);



/* Error Handling  */
apiServer.use((request: Request, response:Response, next: NextFunction) => {
    next(new Exception(404, "Invalid Request"));
});

apiServer.use((error: Exception, request: Request, response:Response, next: NextFunction) => {
        const status = error.status || 500;
        const message = error.message || 'Server Error';
        response.status(error.status || 500).send({status, message});

        if(status < 400) log.event('API Event:', message);
        else if(status === 401 || status === 403) log.auth('HTTP user verification failed', message);
        else log.error('Server Error', message);

        console.error("API", status, message, request.headers, request.body);
});