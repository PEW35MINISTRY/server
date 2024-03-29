import express, { NextFunction, Request, Response, Router } from 'express';
import fs, { PathLike } from 'fs';
import * as log from '../../2-services/log.mjs';
import { JwtAdminRequest } from '../2-auth/auth-types.mjs';

const adminRouter:Router = express.Router();
adminRouter.use(express.text());


//Event
adminRouter.get('/event', (request: JwtAdminRequest, response: Response) => {
    const readStream = fs.createReadStream(log.getLogFilePath(log.LOG_TYPE.EVENT) as PathLike);
    readStream.pipe(response);
});

adminRouter.post('/event', (request: JwtAdminRequest, response: Response) => {
    if(log.event(request.body.toString())) response.status(200).send('Event message has been saved.');
    else response.status(500).send('Server Error, failed to save Event message.');
});


//Authenticate
adminRouter.get('/auth', (request: JwtAdminRequest, response: Response) => {
    const readStream = fs.createReadStream(log.getLogFilePath(log.LOG_TYPE.AUTH) as PathLike);
    readStream.pipe(response);
});

adminRouter.post('/auth', (request: JwtAdminRequest, response: Response) => {
    if(log.auth(request.body.toString())) response.status(200).send('Authentication message has been saved.');
    else response.status(500).send('Server Error, failed to save Authentication message.');
});


//Warning
adminRouter.get('/warn', (request: JwtAdminRequest, response: Response) => {
    const readStream = fs.createReadStream(log.getLogFilePath(log.LOG_TYPE.WARN) as PathLike);
    readStream.pipe(response);
});

adminRouter.post('/warn', (request: JwtAdminRequest, response: Response) => { 
    if(log.warn(request.body.toString())) response.status(200).send('Warning message has been saved.');
    else response.status(500).send('Server Error, failed to save Warning message.');
});

//Alert
adminRouter.post('/alert', (request: JwtAdminRequest, response: Response) => {
    if(log.warn(request.body.toString())) response.status(200).send('Alert message has been sent.');
    else response.status(500).send('Server Error, failed to send Alert message.');
});

//Error
adminRouter.get('/error', (request: JwtAdminRequest, response: Response) => {
    const readStream = fs.createReadStream(log.getLogFilePath(log.LOG_TYPE.ERROR) as PathLike);
    readStream.pipe(response);
});

adminRouter.post('/error', (request: JwtAdminRequest, response: Response) => {
    if(log.error(request.body.toString())) response.status(200).send('Error message has been saved.');
    else response.status(500).send('Server Error, failed to save Error message.');
});

adminRouter.get('*', (request: JwtAdminRequest, response: Response) => {
    const readStream = fs.createReadStream(log.getLogFilePath(log.LOG_TYPE.ERROR) as PathLike);
    readStream.pipe(response);
});

adminRouter.post('*', (request: JwtAdminRequest, response: Response) => {
    if(log.error(request.body.toString())) response.status(200).send('Error message has been saved.');
    else response.status(500).send('Server Error, failed to save Error message.');
});

export default adminRouter;

