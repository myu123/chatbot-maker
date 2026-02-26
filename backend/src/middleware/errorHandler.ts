import { Request, Response, NextFunction } from 'express'
import logger from '@/utils/logger'

export const errorHandler = (
  error: Error,
  req: Request,
  res: Response,
  _next: NextFunction
): void => {
  logger.error('Unhandled error', {
    message: error.message,
    url: req.url,
    method: req.method,
    ip: req.ip,
    stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
  })

  // Known error patterns from multer
  const knownErrors: Record<string, { status: number; error: string; message: string }> = {
    'Only .txt and .pdf files are allowed': {
      status: 400,
      error: 'Invalid file type',
      message: 'Only .txt and .pdf files are allowed.'
    },
    'File too large': {
      status: 400,
      error: 'File too large',
      message: 'Maximum file size is 50 MB.'
    },
    'Too many files': {
      status: 400,
      error: 'Too many files',
      message: 'Maximum 10 files allowed per upload.'
    }
  }

  for (const [pattern, response] of Object.entries(knownErrors)) {
    if (error.message.includes(pattern)) {
      res.status(response.status).json(response)
      return
    }
  }

  // Generic fallback
  res.status(500).json({
    error: 'Internal server error',
    message: process.env.NODE_ENV === 'development'
      ? error.message
      : 'Something went wrong. Please try again.'
  })
}

export const notFoundHandler = (req: Request, res: Response): void => {
  res.status(404).json({
    error: 'Not found',
    message: `Route ${req.method} ${req.originalUrl} does not exist.`
  })
}
