import { Request, Response, NextFunction } from 'express'
import logger from '@/utils/logger'

export const errorHandler = (
  error: Error,
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  logger.error('Error caught by error handler:', {
    message: error.message,
    stack: error.stack,
    url: req.url,
    method: req.method,
    ip: req.ip,
    userAgent: req.get('User-Agent')
  })

  // Multer errors
  if (error.message.includes('Only .txt and .pdf files are allowed')) {
    res.status(400).json({
      error: 'Invalid file type',
      message: 'Only .txt and .pdf files are allowed'
    })
    return
  }

  if (error.message.includes('File too large')) {
    res.status(400).json({
      error: 'File too large',
      message: 'Maximum file size is 50MB'
    })
    return
  }

  if (error.message.includes('Too many files')) {
    res.status(400).json({
      error: 'Too many files',
      message: 'Maximum 10 files allowed at once'
    })
    return
  }

  // Generic error response
  res.status(500).json({
    error: 'Internal server error',
    message: process.env.NODE_ENV === 'development' ? error.message : 'Something went wrong'
  })
}

export const notFoundHandler = (req: Request, res: Response): void => {
  res.status(404).json({
    error: 'Not found',
    message: `Route ${req.originalUrl} not found`
  })
}