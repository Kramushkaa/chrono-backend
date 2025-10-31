import { JWTPayload } from './auth';

// Расширение типов Express для добавления поля user
declare global {
  namespace Express {
    interface Request {
      user?: JWTPayload;
    }
  }
}
