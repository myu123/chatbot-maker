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
const io = new Server(server, {
  cors: {
    origin: process.env.FRONTEND_URL || "http://localhost:3000",
    methods: ["GET", "POST"]
  }
})

const PORT = process.env.PORT || 5000

// Security middleware
app.use(helmet())
app.use(cors({
  origin: process.env.FRONTEND_URL || "http://localhost:3000",
  credentials: true
}))

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100 // limit each IP to 100 requests per windowMs
})
app.use(limiter)

// Body parsing middleware
app.use(express.json({ limit: '10mb' }))
app.use(express.urlencoded({ extended: true, limit: '10mb' }))

// API routes
app.use('/api/files', filesRouter)
app.use('/api/training', trainingRouter)
app.use('/api/models', modelsRouter)
app.use('/api/chat', chatRouter)

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({ 
    status: 'healthy', 
    timestamp: new Date().toISOString(),
    version: '1.0.0'
  })
})

// WebSocket connection handling
io.on('connection', (socket) => {
  logger.info(`Client connected: ${socket.id}`)

  socket.on('subscribe-training', (jobId: string) => {
    socket.join(`training-${jobId}`)
    logger.info(`Client ${socket.id} subscribed to training ${jobId}`)
  })

  socket.on('unsubscribe-training', (jobId: string) => {
    socket.leave(`training-${jobId}`)
    logger.info(`Client ${socket.id} unsubscribed from training ${jobId}`)
  })

  socket.on('disconnect', () => {
    logger.info(`Client disconnected: ${socket.id}`)
  })
})

// Initialize training service with socket.io
trainingService.setSocketIO(io)

// Error handling middleware (must be last)
app.use(notFoundHandler)
app.use(errorHandler)

// Start server
server.listen(PORT, () => {
  logger.info(`Server running on port ${PORT}`)
  logger.info(`Frontend URL: ${process.env.FRONTEND_URL || "http://localhost:3000"}`)
  logger.info('Chatbot Maker Backend started successfully')
})

// Graceful shutdown
process.on('SIGTERM', () => {
  logger.info('SIGTERM received, shutting down gracefully')
  server.close(() => {
    logger.info('Process terminated')
    process.exit(0)
  })
})

process.on('SIGINT', () => {
  logger.info('SIGINT received, shutting down gracefully')
  server.close(() => {
    logger.info('Process terminated')
    process.exit(0)
  })
})