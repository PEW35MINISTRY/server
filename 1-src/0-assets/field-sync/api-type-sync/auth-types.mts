/********* ONLY DEPENDENCIES FROM DIRECTORY: /field-sync/ *********/

import { RoleEnum } from '../input-config-sync/profile-field-config.mjs'

/********************************************************************
*                   AUTH TYPES                                      *
* Sync across all repositories: server, portal, mobile              *
* Server: Additional Types Declared in: 1-api/2-auth/auth-types.mts *
* Portal:                                                           *
* Mobile:                                                           *
*********************************************************************/

export interface LoginRequestBody {
    email: string, 
    password: string
};

export interface JwtResponseBody {
    jwt: string, 
    userID: number, 
    userRole: RoleEnum
};
