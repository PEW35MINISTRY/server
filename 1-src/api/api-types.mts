
/*    Type Declarations     */

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


