declare module 'helmet' {
  import { RequestHandler } from 'express';
  const helmet: () => RequestHandler;
  export default helmet;
}


