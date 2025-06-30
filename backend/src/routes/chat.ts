import { Router, Request, Response, NextFunction } from 'express'
import chatService from '@/services/chatService'
import logger from '@/utils/logger'

const router = Router()

// Send chat message
router.post('/message', async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { message, modelId } = req.body
    
    if (!message || typeof message !== 'string' || message.trim().length === 0) {
      res.status(400).json({
        error: 'Invalid message',
        message: 'Please provide a valid message'
      })
      return
    }

    if (message.length > 1000) {
      res.status(400).json({
        error: 'Message too long',
        message: 'Message must be less than 1000 characters'
      })
      return
    }

    const response = await chatService.sendMessage(message.trim(), modelId)
    
    logger.info(`Chat message processed for model ${response.modelId}`)
    res.json(response)
  } catch (error) {
    next(error)
  }
})

// Get active model
router.get('/active-model', async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const activeModel = await chatService.getActiveModel()
    
    if (!activeModel) {
      res.status(404).json({
        error: 'No active model',
        message: 'No model is currently active'
      })
      return
    }

    res.json(activeModel)
  } catch (error) {
    next(error)
  }
})

// Health check for chat service
router.get('/health', async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const isHealthy = await chatService.healthCheck()
    
    if (isHealthy) {
      res.json({ status: 'healthy', message: 'Chat service is running' })
    } else {
      res.status(503).json({ 
        status: 'unhealthy', 
        message: 'Chat service is not available' 
      })
    }
  } catch (error) {
    next(error)
  }
})

export default router