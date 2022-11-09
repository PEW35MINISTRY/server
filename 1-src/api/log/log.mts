import express, {Router, Request, Response, NextFunction} from 'express';
import fs, { PathLike } from 'fs';
import * as log from '../../services/log.mjs';
import { CredentialRequest } from '../auth/auth-types.mjs';
import authenticateAccess, { authenticateIdentity, authenticateIdentityAndAdmin } from '../auth/auth-utilities.mjs';

const router:Router = express.Router();
router.use(express.text());

//Verify ADMIN ONLY
router.use((request:CredentialRequest, response:Response, next:NextFunction) => authenticateIdentityAndAdmin(request, response, next));

//Event
router.get('/event', (request: Request, response: Response) => {
    const readStream = fs.createReadStream(log.getLogFilePath(log.LOG_TYPE.EVENT) as PathLike);
    readStream.pipe(response);
});

router.post('/event', (request: Request, response: Response) => {
    if(log.event(request.body.toString())) response.status(200).send("Event message has been saved.");
    else response.status(500).send("Server Error, failed to save Event message.");
});


//Authenticate
router.get('/auth', (request: Request, response: Response) => {
    const readStream = fs.createReadStream(log.getLogFilePath(log.LOG_TYPE.AUTH) as PathLike);
    readStream.pipe(response);
});

router.post('/auth', (request: Request, response: Response) => {
    if(log.auth(request.body.toString())) response.status(200).send("Authentication message has been saved.");
    else response.status(500).send("Server Error, failed to save Authentication message.");
});


//Warning
router.get('/warn', (request: Request, response: Response) => {
    const readStream = fs.createReadStream(log.getLogFilePath(log.LOG_TYPE.WARN) as PathLike);
    readStream.pipe(response);
});

router.post('/warn', (request: Request, response: Response) => { console.log(request.body);
    if(log.warn(request.body.toString())) response.status(200).send("Warning message has been saved.");
    else response.status(500).send("Server Error, failed to save Warning message.");
});

//Alert
router.post('/alert', (request: Request, response: Response) => {
    if(log.warn(request.body.toString())) response.status(200).send("Alert message has been sent.");
    else response.status(500).send("Server Error, failed to send Alert message.");
});

//Error
router.get('*', (request: Request, response: Response) => {
    const readStream = fs.createReadStream(log.getLogFilePath(log.LOG_TYPE.ERROR) as PathLike);
    readStream.pipe(response);
});

router.post('*', (request: Request, response: Response) => {
    if(log.error(request.body.toString())) response.status(200).send("Error message has been saved.");
    else response.status(500).send("Server Error, failed to save Error message.");
});

export default router;

export function auth(arg0: string, userid: any) {
    throw new Error('Function not implemented.');
}
