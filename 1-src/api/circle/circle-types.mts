import { Request, Response, NextFunction } from "express";
import { IncomingHttpHeaders } from "http";
import { DB_USER } from "../../services/database-types.mjs";
import { CredentialRequest } from "../auth/auth-types.mjs";
import { GenderEnum, ProfileResponse, RoleEnum, StageEnum } from "../profile/profile-types.mjs";



export interface CircleRequest extends CredentialRequest {
    headers: CredentialRequest["headers"] & {
      'circle-id': number
    }
    circleId: number
};