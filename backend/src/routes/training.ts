import { Router, Request, Response, NextFunction } from 'express'
import trainingService from '@/services/trainingService'
import logger from '@/utils/logger'

const router = Router()

// Start training
router.post('/start', async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const config = req.body
    
    // Validate config
    if (!config.modelSize || !config.epochs || !config.batchSize) {
      res.status(400).json({
        error: 'Invalid configuration',
        message: 'Missing required training parameters'
      })
      return
    }

    // Validate model size
    const validModelSizes = ['gpt2', 'gpt2-medium', 'gpt2-large', 'gpt2-xl']
    if (!validModelSizes.includes(config.modelSize)) {
      res.status(400).json({
        error: 'Invalid model size',
        message: 'Model size must be one of: ' + validModelSizes.join(', ')
      })
      return
    }

    // Validate numeric parameters
    if (config.epochs < 1 || config.epochs > 1000) {
      res.status(400).json({
        error: 'Invalid epochs',
        message: 'Epochs must be between 1 and 1000'
      })
      return
    }

    if (config.batchSize < 1 || config.batchSize > 32) {
      res.status(400).json({
        error: 'Invalid batch size',
        message: 'Batch size must be between 1 and 32'
      })
      return
    }

    if (config.learningRate < 0.00001 || config.learningRate > 0.1) {
      res.status(400).json({
        error: 'Invalid learning rate',
        message: 'Learning rate must be between 0.00001 and 0.1'
      })
      return
    }

    if (config.trainFraction < 0.5 || config.trainFraction > 0.95) {
      res.status(400).json({
        error: 'Invalid train fraction',
        message: 'Train fraction must be between 0.5 and 0.95'
      })
      return
    }

    const jobId = await trainingService.startTraining(config)
    logger.info(`Started training job ${jobId}`)
    
    res.json({ jobId })
  } catch (error) {
    next(error)
  }
})

// Get training status
router.get('/status/:jobId', async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { jobId } = req.params
    
    if (!jobId) {
      res.status(400).json({
        error: 'Job ID required',
        message: 'Please provide a valid job ID'
      })
      return
    }

    const job = await trainingService.getTrainingStatus(jobId)
    
    if (!job) {
      res.status(404).json({
        error: 'Job not found',
        message: 'The requested training job does not exist'
      })
      return
    }

    res.json(job)
  } catch (error) {
    next(error)
  }
})

// Stop training
router.post('/stop/:jobId', async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { jobId } = req.params
    
    if (!jobId) {
      res.status(400).json({
        error: 'Job ID required',
        message: 'Please provide a valid job ID'
      })
      return
    }

    await trainingService.stopTraining(jobId)
    logger.info(`Stopped training job ${jobId}`)
    
    res.json({ message: 'Training stopped successfully' })
  } catch (error) {
    next(error)
  }
})

export default router