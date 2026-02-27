import { Server as HttpServer } from 'http';
import { Server, Socket } from 'socket.io';

export class SocketService {
  private io?: Server;

  init(server: HttpServer) {
    this.io = new Server(server, {
      cors: {
        origin: '*',
        methods: ['GET', 'POST']
      }
    });

    this.io.on('connection', (socket: Socket) => {
      const { userId } = socket.handshake.auth as any;
      console.log("Intentando conectar usuario", socket.handshake)
      if (userId) {
        console.log(userId, 'User connected to socket');
        socket.join(`user:${userId}`);
      }

      socket.on('disconnect', () => {
        // cleanup if necessary
      });
    });
  }

  emitToUser(userId: string, event: string, payload: any) {
    if (!this.io) return;
    console.log(userId, event, payload, 'Emitting to user');
    this.io.to(`user:${userId}`).emit(event, payload);
  }
}

export default SocketService;
