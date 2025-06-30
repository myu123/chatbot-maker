import { Router, Request, Response, NextFunction } from 'express'
import storage from '@/utils/storage'
import logger from '@/utils/logger'

const router = Router()

// Get all models
router.get('/', async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const models = await storage.getModels()
    res.json(models)
  } catch (error) {
    next(error)
  }
})

// Delete a model
router.delete('/:modelId', async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { modelId } = req.params
    
    if (!modelId) {
      res.status(400).json({
        error: 'Model ID required',
        message: 'Please provide a valid model ID'
      })
      return
    }

    await storage.deleteModel(modelId)
    logger.info(`Deleted model ${modelId}`)
    
    res.json({ message: 'Model deleted successfully' })
  } catch (error) {
    if ((error as Error).message === 'Model not found') {
      res.status(404).json({
        error: 'Model not found',
        message: 'The requested model does not exist'
      })
      return
    }
    next(error)
  }
})

// Set active model
router.post('/:modelId/activate', async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { modelId } = req.params
    
    if (!modelId) {
      res.status(400).json({
        error: 'Model ID required',
        message: 'Please provide a valid model ID'
      })
      return
    }

    await storage.setActiveModel(modelId)
    logger.info(`Activated model ${modelId}`)
    
    res.json({ message: 'Model activated successfully' })
  } catch (error) {
    if ((error as Error).message === 'Model not found') {
      res.status(404).json({
        error: 'Model not found',
        message: 'The requested model does not exist'
      })
      return
    }
    next(error)
  }
})

export default router