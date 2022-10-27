import express, { Application , Request, Response} from 'express';


export default function(app){

    app.get('/go', (request: Request, response: Response) => {
        response.status(200).send("This is Go Success URL")
    });

    app.get('/end', (request: Request, response: Response) => {
        response.status(200).send("This is End Success URL")
    });

}
