import express, {Router, Request, Response, NextFunction} from 'express';
import { Exception } from './api-types.mjs';
import CIRCLE from '../2-services/1-models/circleModel.mjs';
import USER from '../2-services/1-models/userModel.mjs';
import { JwtAdminRequest, JwtClientRequest, JwtRequest } from './2-auth/auth-types.mjs';
import { createMockCircle, createMockPrayerRequest, createMockUser, populateDemoRelations } from '../2-services/10-utilities/mock-utilities/mock-generate.mjs';
import { DB_SELECT_USER } from '../2-services/2-database/queries/user-queries.mjs';
import { CreateDemoRequest } from './3-profile/profile-types.mjs';
import PRAYER_REQUEST from '../2-services/1-models/prayerRequestModel.mjs';
import { getEnvironment } from '../2-services/10-utilities/utilities.mjs';
import { ENVIRONMENT_TYPE } from '../0-assets/field-sync/input-config-sync/inputField.mjs';
import { answerAndNotifyPrayerRequests } from '../3-lambda/prayer-request/prayer-request-expired-script.mjs';

const router:Router = express.Router();



router.get('/', (request: Request, response: Response) => {
    response.status(200).send('Welcome to PEW35 Encouraging Prayer API');
});


export default router;



/******************
 * DEMO UTILITIES *
 ******************/
export const GET_createMockUser = async(request:CreateDemoRequest, response:Response, next:NextFunction) => {
    const populateDemoData:boolean = request.query.populate === 'true';
    const user:USER = await createMockUser(populateDemoData);

    if(user.isValid)
        response.status(202).send(user.toJSON());
    else
        next(new Exception(500, `Failed to create a mock user: ${user.displayName}.`, 'Create Failed'));
}

//Modify existing User
export const POST_populateDemoUser = async(request:JwtClientRequest, response:Response, next:NextFunction) => {
    if(getEnvironment() === ENVIRONMENT_TYPE.PRODUCTION)
        next(new Exception(403, `Demo profile populate is only available in development environment.`, 'Restricted Action'));

    else {
        const currentUser:USER = await DB_SELECT_USER(new Map([['userID', request.clientID]]));
        const newUser:USER = await populateDemoRelations(currentUser);

        if(newUser.isValid)
            response.status(202).send(newUser.toJSON());
        else
            next(new Exception(500, `Failed to populate demo relations for user ${request.clientID}.`, 'Populate Failed'));
    }
}

export const GET_createMockCircle = async(request:JwtRequest, response:Response, next:NextFunction) => {
    const circle:CIRCLE = await createMockCircle(request.jwtUserID);

    if(circle.isValid)
        response.status(202).send(circle.toJSON());
    else
        next(new Exception(500, `Failed to create a mock circle: ${circle.name} for leader ${request.jwtUserID}.`, 'Create Failed'));
}

export const GET_createMockPrayerRequest = async(request:JwtClientRequest, response:Response, next:NextFunction) => {
    const prayerRequest:PRAYER_REQUEST = await createMockPrayerRequest(request.clientID);

    if(prayerRequest.isValid)
        response.status(202).send(prayerRequest.toJSON());
    else
        next(new Exception(500, `Failed to create a mock prayer request: ${prayerRequest.topic} of user ${request.clientID}.`, 'Create Failed'));
}

/******************
 * CUSTOM SCRIPTS *
 ******************/

export const POST_PrayerRequestExpiredScript = async(request:JwtAdminRequest, response:Response, next:NextFunction) => {

    // invoke the script asynchronously
    answerAndNotifyPrayerRequests()

    return response.status(202).send();
}