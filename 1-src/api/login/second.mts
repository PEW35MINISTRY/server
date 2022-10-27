import {Request, Response} from 'express';


export default (request: Request, response: Response) => {
        response.status(200).send("This is Second Success URL")
    };

    