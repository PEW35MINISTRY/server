import { Response, NextFunction } from 'express';
import { fetchContacts } from '../../services/chat/chat-utilities.mjs';
import * as log from '../../services/log.mjs';
import {Exception} from '../api-types.mjs'
import { JwtRequest } from '../auth/auth-types.mjs';

export const GET_userContacts =  async(request: JwtRequest, response: Response, next: NextFunction) => {

    response.status(200).send(await fetchContacts(request.jwtUserID));
};