interface ServerToClientEvents {
    noArg: () => void;
    basicEmit: (a: number, b: string, c: Buffer) => void;
    withAck: (d: string, callback: (e: number) => void) => void;
  }
  
interface ClientToServerEvents {
hello: () => void;
}

interface InterServerEvents {
ping: () => void;
}

interface SocketData {
name: string;
age: number;
}

export type SocketContact = {
    userID: number,
    displayName: string,
    socketID: string
}

export type SocketMessage = {
    senderID: number,
    senderName?: string,
    recipientID: number,
    recipientName?: string,
    message: string,
    time?: number,
}
