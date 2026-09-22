import { Server as HttpServer } from 'http';
import jwt from 'jsonwebtoken';
import { Server, Socket } from 'socket.io';
import { config } from '../config';

// Same access token identity-service issues (jwt.service.ts): HS256 (the
// jsonwebtoken default for a string secret), payload field `userId`,
// issuer 'cba-auth-service', audience 'cba-platform'. Every other service
// that verifies these tokens (exam-service's auth.middleware.ts) only
// checks the secret, not issuer/audience — but since we control both ends
// of this handshake we pin them here for defense in depth.
interface AccessTokenPayload {
  userId: string;
  email?: string;
  role?: string;
}

function extractToken(socket: Socket): string | null {
  const authToken = (socket.handshake.auth as any)?.token;
  if (typeof authToken === 'string' && authToken.length > 0) return authToken;

  const header = socket.handshake.headers?.authorization;
  if (typeof header === 'string' && header.startsWith('Bearer ')) {
    return header.slice('Bearer '.length);
  }

  return null;
}

export class SocketService {
  private io?: Server;

  init(server: HttpServer) {
    this.io = new Server(server, {
      cors: {
        origin: config.app.corsOrigin,
        methods: ['GET', 'POST']
      }
    });

    // Authenticate every handshake before the connection is accepted — the
    // room a socket joins (`user:<id>`) must come from a verified token, not
    // from an unverified value the client hands us directly. A client that
    // can't produce a valid access token never gets a connection, so it
    // never receives any user's pushes.
    this.io.use((socket, next) => {
      const token = extractToken(socket);
      if (!token) {
        next(new Error('Authentication required'));
        return;
      }

      try {
        const decoded = jwt.verify(token, config.jwt.secret, {
          algorithms: ['HS256'],
          issuer: 'cba-auth-service',
          audience: 'cba-platform',
        }) as AccessTokenPayload;

        if (!decoded?.userId) {
          next(new Error('Invalid token payload'));
          return;
        }

        (socket.data as any).userId = decoded.userId;
        next();
      } catch (error) {
        next(new Error('Invalid or expired token'));
      }
    });

    this.io.on('connection', (socket: Socket) => {
      const userId = (socket.data as any).userId as string;
      socket.join(`user:${userId}`);

      socket.on('disconnect', () => {
        // cleanup if necessary
      });
    });
  }

  emitToUser(userId: string, event: string, payload: any) {
    if (!this.io) return;
    this.io.to(`user:${userId}`).emit(event, payload);
  }
}

export default SocketService;
