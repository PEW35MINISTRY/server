import { Request, Response, NextFunction } from "express";

/*    Type Declarations     */

export class Exception extends Error {
    status: number;
    message: string;
    constructor(status: number, message: string) {
      super(message);
      this.status = status;
      this.message = message;
    }
  }


