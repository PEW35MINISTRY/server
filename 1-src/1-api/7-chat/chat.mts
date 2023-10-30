import { NextFunction, Response } from 'express';
import { fetchContacts } from '../../2-services/3-chat/chat-utilities.mjs';
import * as log from '../../2-services/log.mjs';
import { JwtRequest } from '../2-auth/auth-types.mjs';

export const GET_userContacts =  async(request: JwtRequest, response: Response, next: NextFunction) => {

    response.status(200).send(await fetchContacts(request.jwtUserID));
};