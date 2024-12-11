/********* ONLY DEPENDENCIES FROM DIRECTORY: /field-sync/ *********/

import { RoleEnum } from '../input-config-sync/profile-field-config.mjs'
import { ProfileResponse } from './profile-types.mjs';

/********************************************************************
*                   AUTH TYPES                                      *
* Sync across all repositories: server, portal, mobile              *
* Server: Additional Types Declared in: 1-api/2-auth/auth-types.mts *
* Portal:                                                           *
* Mobile:                                                           *
*********************************************************************/

export interface LoginRequestBody {
    email: string, 
    password: string,
    deviceID: string
};

export interface JwtResponseBody {
    jwt: string, 
    userID: number, 
    userRole: RoleEnum
};

export interface LoginResponseBody extends JwtResponseBody {
    userProfile: ProfileResponse,
    service:string
};
