// Session type augmentation for express-session
import 'express-session';

declare module 'express-session' {
  interface SessionData {
    userId?: string;
    gmailOAuthState?: string;
  }
}
