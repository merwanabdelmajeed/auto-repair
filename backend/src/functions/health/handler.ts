import type { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { ok } from '../../shared/utils/response.js';

export const handler = async (_event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {
  return ok({
    status: 'ok',
    service: 'autorepair-api',
    timestamp: new Date().toISOString(),
  });
};
