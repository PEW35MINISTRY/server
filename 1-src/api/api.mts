import express, {Router, Application , Request, Response} from 'express';

const router:Router = express.Router();



router.get('/', (request: Request, response: Response) => {
    response.status(200).send("Welcome to PEW35 Encouraging Prayer API");
});


export default router;