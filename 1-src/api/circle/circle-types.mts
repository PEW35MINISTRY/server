import { Request, Response, NextFunction } from "express";
import { IncomingHttpHeaders } from "http";
import { DB_USER } from "../../services/database/database-types.mjs";
import { IdentityRequest } from "../auth/auth-types.mjs";
import { GenderEnum, ProfileResponse, RoleEnum, StageEnum } from "../profile/profile-types.mjs";



