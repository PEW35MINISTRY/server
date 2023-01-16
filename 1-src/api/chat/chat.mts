import { Response, NextFunction } from 'express';
import { fetchContacts } from '../../services/chat/chat-utilities.mjs';
import { DB_USER } from '../../services/database/database-types.mjs';
import { query, queryAll, queryTest, TestResult } from "../../services/database/database.mjs";
import * as log from '../../services/log.mjs';
import {Exception} from '../api-types.mjs'
import { IdentityRequest } from '../auth/auth-types.mjs';

export const GET_userContacts =  async(request: IdentityRequest, response: Response, next: NextFunction) => {

    response.status(200).send(await fetchContacts(request.userId));
};