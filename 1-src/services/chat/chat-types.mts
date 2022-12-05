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
    userId: number,
    displayName: string,
    socketId: string
}

export type SocketMessage = {
    senderId: number,
    senderName?: string,
    recipientId: number,
    recipientName?: string,
    message: string,
    time?: number,
}
