import dotenv from 'dotenv';
dotenv.config(); 
import path from 'path';
const __dirname = path.resolve();
import express, { Application , Request, Response} from 'express';
import cors from 'cors';


const SERVER_PORT = process.env.SERVER_PORT || 5000;
const apiServer: Application = express();

apiServer.use(express.static(path.join(__dirname, 'build')));
apiServer.use(express.json());  
apiServer.use(cors());

apiServer.get('/', function(request: Request, response: Response) {
    response.sendFile(path.join(__dirname, 'build', 'index.html'));
});

















apiServer.listen( SERVER_PORT, () => console.log(`Back End Server listening on LOCAL port: ${SERVER_PORT}`));