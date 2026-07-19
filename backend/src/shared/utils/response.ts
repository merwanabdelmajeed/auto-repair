import type { APIGatewayProxyResult } from 'aws-lambda';

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type,Authorization',
  'Access-Control-Allow-Methods': 'GET,POST,PUT,DELETE,OPTIONS',
  'Content-Type': 'application/json',
};

const json = (statusCode: number, body: unknown): APIGatewayProxyResult => ({
  statusCode,
  headers: CORS_HEADERS,
  body: JSON.stringify(body),
});

export const ok = (data: unknown): APIGatewayProxyResult =>
  json(200, { success: true, data });

export const paginated = (items: unknown[], nextCursor: string | null): APIGatewayProxyResult =>
  json(200, { success: true, data: { items, nextCursor } });

export const created = (data: unknown): APIGatewayProxyResult =>
  json(201, { success: true, data });

export const badRequest = (error: string): APIGatewayProxyResult =>
  json(400, { success: false, error });

export const unauthorized = (error = 'Unauthorized'): APIGatewayProxyResult =>
  json(401, { success: false, error });

export const forbidden = (error = 'Forbidden'): APIGatewayProxyResult =>
  json(403, { success: false, error });

export const notFound = (error = 'Not found'): APIGatewayProxyResult =>
  json(404, { success: false, error });

export const conflict = (error: string): APIGatewayProxyResult =>
  json(409, { success: false, error });

export const tooManyRequests = (error = 'Too many requests'): APIGatewayProxyResult =>
  json(429, { success: false, error });

export const serverError = (error = 'Internal server error'): APIGatewayProxyResult =>
  json(500, { success: false, error });
