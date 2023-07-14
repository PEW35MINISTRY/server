import { Response, NextFunction } from 'express';
import { fetchContacts, fetchUserCircles } from '../../services/chat/chat-utilities.mjs';
import * as log from '../../services/log.mjs';
import {Exception} from '../api-types.mjs'
import { IdentityRequest } from '../auth/auth-types.mjs';

export const GET_userCircles =  async(request: IdentityRequest, response: Response, next: NextFunction) => {

    response.status(200).send(await fetchUserCircles(request.userID));
};