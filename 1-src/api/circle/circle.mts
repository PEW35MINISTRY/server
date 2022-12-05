import { Response, NextFunction } from 'express';
import { fetchContacts, fetchUserCircles } from '../../services/chat/chat-utilities.mjs';
import { DB_USER } from '../../services/database/database-types.mjs';
import { query, queryAll, queryTest, TestResult } from "../../services/database/database.mjs";
import * as log from '../../services/log.mjs';
import {Exception} from '../api-types.mjs'
import { CredentialRequest } from '../auth/auth-types.mjs';

export const GET_userCircles =  async(request: CredentialRequest, response: Response, next: NextFunction) => {

    response.status(200).send(await fetchUserCircles(request.userId));
};