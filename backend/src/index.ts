import express from 'express'
import cors from 'cors'
import helmet from 'helmet'
import rateLimit from 'express-rate-limit'
import { createServer } from 'http'
import { Server } from 'socket.io'
import dotenv from 'dotenv'

import logger from '@/utils/logger'
import { errorHandler, notFoundHandler } from '@/middleware/errorHandler'
import trainingService from '@/services/trainingService'

// Routes
import filesRouter from '@/routes/files'
import trainingRouter from '@/routes/training'
import modelsRouter from '@/routes/models'
import chatRouter from '@/routes/chat'

dotenv.config()

const app = express()
const server = createServer(app)

const FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:3000'

const io = new Server(server, {
  cors: {
    origin: FRONTEND_URL,
    methods: ['GET', 'POST']
  },
  pingTimeout: 30_000,
  pingInterval: 10_000
})

const PORT = process.env.PORT || 5000

// Security middleware
app.use(helmet())
app.use(cors({
  origin: FRONTEND_URL,
  credentials: true
}))

// Rate limiting — separate limits for chat vs general
const generalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 200,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many requests', message: 'Please try again in a few minutes.' }
})
app.use(generalLimiter)

const chatLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 30,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many messages', message: 'Slow down — max 30 messages per minute.' }
})
app.use('/api/chat', chatLimiter)

// Body parsing
app.use(express.json({ limit: '10mb' }))
app.use(express.urlencoded({ extended: true, limit: '10mb' }))

// API routes
app.use('/api/files', filesRouter)
app.use('/api/training', trainingRouter)
app.use('/api/models', modelsRouter)
app.use('/api/chat', chatRouter)

// Health check
app.get('/api/health', (_req, res) => {
  res.json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    version: '2.0.0',
    uptime: Math.floor(process.uptime())
  })
})

// WebSocket handling
io.on('connection', (socket) => {
  logger.info(`WS client connected: ${socket.id}`)

  socket.on('subscribe-training', (jobId: string) => {
    if (typeof jobId === 'string' && jobId.length > 0) {
      socket.join(`training-${jobId}`)
      logger.debug(`Client ${socket.id} subscribed to training ${jobId}`)
    }
  })

  socket.on('unsubscribe-training', (jobId: string) => {
    if (typeof jobId === 'string') {
      socket.leave(`training-${jobId}`)
    }
  })

  socket.on('disconnect', () => {
    logger.debug(`WS client disconnected: ${socket.id}`)
  })
})

// Wire up training service with socket.io
trainingService.setSocketIO(io)

// Error handling (must be last)
app.use(notFoundHandler)
app.use(errorHandler)

// Start
server.listen(PORT, () => {
  logger.info(`Server running on port ${PORT}`)
  logger.info(`Frontend URL: ${FRONTEND_URL}`)
  logger.info('Chatbot Maker Backend v2.0.0 started')
})

// Graceful shutdown
const shutdown = (signal: string) => {
  logger.info(`${signal} received — shutting down`)
  server.close(() => {
    logger.info('Server closed')
    process.exit(0)
  })
  // Force exit after 10s
  setTimeout(() => process.exit(1), 10_000)
}

process.on('SIGTERM', () => shutdown('SIGTERM'))
process.on('SIGINT', () => shutdown('SIGINT'))
