import './forceNetlifyFlag.ts';
import serverless from 'serverless-http';
import { createApp } from '../../server.ts';

let serverlessHandlerPromise: Promise<ReturnType<typeof serverless>> | null = null;

export const handler = async (event: any, context: any) => {
  if (!serverlessHandlerPromise) {
    serverlessHandlerPromise = createApp().then(app => serverless(app));
  }
  const serverlessHandler = await serverlessHandlerPromise;
  return serverlessHandler(event, context);
};
