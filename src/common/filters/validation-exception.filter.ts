import { ExceptionFilter, Catch, ArgumentsHost, BadRequestException } from '@nestjs/common';
import { Response } from 'express';

@Catch(BadRequestException)
export class ValidationExceptionFilter implements ExceptionFilter {
  catch(exception: BadRequestException, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const status = exception.getStatus();
    const exceptionResponse = exception.getResponse();

    // Check if this is a validation error
    if (typeof exceptionResponse === 'object' && 'message' in exceptionResponse) {
      const message = exceptionResponse.message;

      // If it's an array of validation errors, format them nicely
      if (Array.isArray(message)) {
        return response.status(status).json({
          statusCode: status,
          error: 'Validation Failed',
          message: 'Request validation failed',
          errors: message,
          timestamp: new Date().toISOString(),
        });
      }
    }

    // Default response for other BadRequest exceptions
    return response.status(status).json({
      statusCode: status,
      error: 'Bad Request',
      message: typeof exceptionResponse === 'string' ? exceptionResponse : (exceptionResponse as any).message,
      timestamp: new Date().toISOString(),
    });
  }
}
