import { spawn, ChildProcess } from 'child_process'
import path from 'path'
import { Server } from 'socket.io'
import storage from '@/utils/storage'
import logger from '@/utils/logger'
import type { TrainingConfig } from '@/types'

class TrainingService {
  private io: Server | null = null
  private activeJobs = new Map<string, ChildProcess>()

  setSocketIO(io: Server) {
    this.io = io
  }

  async startTraining(config: TrainingConfig): Promise<string> {
    try {
      const jobId = await storage.createTrainingJob(config)
      
      // Start training in background
      this.runTraining(jobId, config)
      
      return jobId
    } catch (error) {
      logger.error('Failed to start training:', error)
      throw error
    }
  }

  private async runTraining(jobId: string, config: TrainingConfig) {
    try {
      await storage.updateTrainingJob(jobId, { status: 'running' })
      
      const pythonScript = path.join(process.cwd(), '..', 'python-services', 'enhanced_trainer.py')
      const uploadsDir = storage.getUploadsDir()
      const modelsDir = storage.getModelsDir()
      const modelOutputPath = path.join(modelsDir, jobId)

      const args = [
        pythonScript,
        '--input-dir', uploadsDir,
        '--output-dir', modelOutputPath,
        '--model-size', config.modelSize,
        '--epochs', config.epochs.toString(),
        '--batch-size', config.batchSize.toString(),
        '--learning-rate', config.learningRate.toString(),
        '--max-length', config.maxLength.toString(),
        '--train-fraction', config.trainFraction.toString(),
        '--job-id', jobId
      ]

      logger.info(`Starting training job ${jobId} with args:`, args)

      const childProcess = spawn('python', args, {
        stdio: ['pipe', 'pipe', 'pipe'],
        env: { ...process.env, PYTHONUNBUFFERED: '1' }
      })

      this.activeJobs.set(jobId, childProcess)

      // Handle stdout for progress updates
      childProcess.stdout?.on('data', (data: Buffer) => {
        const output = data.toString()
        logger.info(`Training ${jobId} stdout:`, output)
        
        try {
          // Try to parse JSON progress updates
          const lines = output.split('\n').filter((line: string) => line.trim())
          for (const line of lines) {
            if (line.startsWith('{')) {
              const progressData = JSON.parse(line)
              this.handleProgressUpdate(jobId, progressData)
            }
          }
        } catch (error) {
          // Not JSON, just log it
          logger.info(`Training ${jobId} output:`, output)
        }
      })

      // Handle stderr
      childProcess.stderr?.on('data', (data: Buffer) => {
        const error = data.toString()
        logger.error(`Training ${jobId} stderr:`, error)
      })

      // Handle process completion
      childProcess.on('close', async (code: number | null) => {
        this.activeJobs.delete(jobId)
        
        if (code === 0) {
          await this.handleTrainingSuccess(jobId, modelOutputPath, config)
        } else {
          await this.handleTrainingError(jobId, `Training process exited with code ${code}`)
        }
      })

      childProcess.on('error', async (error: Error) => {
        this.activeJobs.delete(jobId)
        logger.error(`Training ${jobId} process error:`, error)
        await this.handleTrainingError(jobId, error.message)
      })

    } catch (error) {
      logger.error(`Failed to run training ${jobId}:`, error)
      await this.handleTrainingError(jobId, (error as Error).message)
    }
  }

  private async handleProgressUpdate(jobId: string, progressData: any) {
    try {
      await storage.updateTrainingJob(jobId, {
        progress: progressData.progress || 0,
        currentEpoch: progressData.epoch || 0,
        loss: progressData.loss,
        estimatedTimeRemaining: progressData.eta
      })

      // Emit to connected clients
      if (this.io) {
        this.io.emit('training-progress', {
          jobId,
          ...progressData
        })
      }
    } catch (error) {
      logger.error('Failed to handle progress update:', error)
    }
  }

  private async handleTrainingSuccess(jobId: string, modelPath: string, config: TrainingConfig) {
    try {
      await storage.updateTrainingJob(jobId, {
        status: 'completed',
        progress: 100,
        endTime: new Date(),
        modelPath
      })

      // Save the trained model
      const files = await storage.getFiles()
      await storage.saveModel({
        name: `Model_${new Date().toISOString().split('T')[0]}_${jobId.slice(0, 8)}`,
        path: modelPath,
        config,
        status: 'ready',
        fileCount: files.length,
        isActive: false
      })

      // Emit completion event
      if (this.io) {
        this.io.emit('training-complete', {
          jobId,
          modelPath,
          epochs: config.epochs
        })
      }

      logger.info(`Training ${jobId} completed successfully`)
    } catch (error) {
      logger.error(`Failed to handle training success for ${jobId}:`, error)
    }
  }

  private async handleTrainingError(jobId: string, error: string) {
    try {
      await storage.updateTrainingJob(jobId, {
        status: 'failed',
        error,
        endTime: new Date()
      })

      // Emit error event
      if (this.io) {
        this.io.emit('training-error', {
          jobId,
          error
        })
      }

      logger.error(`Training ${jobId} failed:`, error)
    } catch (err) {
      logger.error(`Failed to handle training error for ${jobId}:`, err)
    }
  }

  async stopTraining(jobId: string): Promise<void> {
    const childProcess = this.activeJobs.get(jobId)
    
    if (childProcess) {
      childProcess.kill('SIGTERM')
      this.activeJobs.delete(jobId)
      
      await storage.updateTrainingJob(jobId, {
        status: 'cancelled',
        endTime: new Date()
      })
      
      logger.info(`Training ${jobId} stopped`)
    }
  }

  async getTrainingStatus(jobId: string) {
    return await storage.getTrainingJob(jobId)
  }
}

export default new TrainingService()