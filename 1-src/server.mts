import dotenv from 'dotenv';
dotenv.config(); 
import path from 'path';
const __dirname = path.resolve();
import express, { Application , Request, Response} from 'express';
import bodyParser from 'body-parser';
import cors from 'cors';
import fs, { appendFile } from 'fs';


const SERVER_PORT = process.env.SERVER_PORT || 5000;
const apiServer: Application = express();
apiServer.listen( SERVER_PORT, () => console.log(`Back End Server listening on LOCAL port: ${SERVER_PORT}`));

/* Middleware  */
apiServer.use(express.static(path.join(__dirname, 'build')));
apiServer.use(bodyParser.json());
apiServer.use(bodyParser.urlencoded({ extended: true }));
apiServer.use(cors());

/* Routes  */ //Order Matters: First Matches
apiServer.get('/', (request: Request, response: Response) => {
    response.sendFile(path.join(__dirname, 'build', 'index.html'));
});


import second from './api/login/second.mjs';
apiServer.use('/sec', second);

import third from './api/login/third.mjs';
apiServer.use('/sec/third', third);













//Otherwise Redirect -> Searches routes in file top to bottom, * matches everything
apiServer.get('*', function(request, response) {
    response.redirect('/');
});