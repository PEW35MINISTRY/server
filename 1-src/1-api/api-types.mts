

/************************************
* SERVER SPECIFIC TYPES | API TYPES *
*************************************/

export class Exception extends Error {
    status: number;
    message: string;
    notification: string;
    
    constructor(status: number, message: string, notification?: string) {
      super(message);
      this.status = status;
      this.message = message;
      this.notification = notification;
    }
  }

  export enum ImageTypeEnum {
    USER_PROFILE = 'USER_PROFILE',
    CIRCLE_PROFILE = 'CIRCLE_PROFILE',
    CIRCLE_EVENT = 'CIRCLE_EVENT'
  }
