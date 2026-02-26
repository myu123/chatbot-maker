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
    const jobId = await storage.createTrainingJob(config as unknown as Record<string, unknown>)
    // Fire and forget — progress is tracked via stdout parsing
    this.runTraining(jobId, config)
    return jobId
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

      logger.info(`Starting training job ${jobId}`, {
        modelSize: config.modelSize,
        epochs: config.epochs,
        batchSize: config.batchSize,
        learningRate: config.learningRate
      })

      const child = spawn('python', args, {
        stdio: ['pipe', 'pipe', 'pipe'],
        env: { ...process.env, PYTHONUNBUFFERED: '1' }
      })

      this.activeJobs.set(jobId, child)

      // Buffer partial lines from stdout
      let stdoutBuffer = ''
      child.stdout?.on('data', (chunk: Buffer) => {
        stdoutBuffer += chunk.toString()
        const lines = stdoutBuffer.split('\n')
        // Keep the last (possibly incomplete) line in the buffer
        stdoutBuffer = lines.pop() ?? ''

        for (const line of lines) {
          const trimmed = line.trim()
          if (!trimmed) continue
          if (trimmed.startsWith('{')) {
            try {
              const parsed = JSON.parse(trimmed)
              this.handleProgressUpdate(jobId, parsed)
            } catch {
              logger.debug(`Training ${jobId} non-JSON output: ${trimmed}`)
            }
          } else {
            logger.info(`Training ${jobId}: ${trimmed}`)
          }
        }
      })

      // Collect stderr but don't treat it all as errors (transformers/torch log to stderr)
      let stderrOutput = ''
      child.stderr?.on('data', (chunk: Buffer) => {
        const text = chunk.toString()
        stderrOutput += text
        // Only log a sample to avoid flooding
        if (stderrOutput.length < 5000) {
          logger.debug(`Training ${jobId} stderr: ${text.trim()}`)
        }
      })

      child.on('close', async (code: number | null) => {
        this.activeJobs.delete(jobId)

        // Flush remaining buffer
        if (stdoutBuffer.trim().startsWith('{')) {
          try {
            this.handleProgressUpdate(jobId, JSON.parse(stdoutBuffer.trim()))
          } catch { /* ignore */ }
        }

        if (code === 0) {
          await this.handleTrainingSuccess(jobId, modelOutputPath, config)
        } else {
          const errorSnippet = stderrOutput.slice(-500).trim()
          await this.handleTrainingError(
            jobId,
            `Process exited with code ${code}${errorSnippet ? ': ' + errorSnippet : ''}`
          )
        }
      })

      child.on('error', async (error: Error) => {
        this.activeJobs.delete(jobId)
        logger.error(`Training ${jobId} spawn error`, { error: error.message })
        await this.handleTrainingError(jobId, error.message)
      })

    } catch (error) {
      logger.error(`Failed to launch training ${jobId}`, { error })
      await this.handleTrainingError(jobId, (error as Error).message)
    }
  }

  private async handleProgressUpdate(jobId: string, data: Record<string, unknown>) {
    try {
      const updates: Partial<import('@/types').TrainingJob> = {}

      if (typeof data.progress === 'number') updates.progress = data.progress
      if (typeof data.epoch === 'number') updates.currentEpoch = data.epoch
      if (typeof data.loss === 'number') updates.loss = data.loss
      if (typeof data.eta === 'number') updates.estimatedTimeRemaining = data.eta

      if (Object.keys(updates).length > 0) {
        await storage.updateTrainingJob(jobId, updates)
      }

      if (this.io) {
        this.io.emit('training-progress', { jobId, ...data })
      }
    } catch (error) {
      logger.error('Failed to process progress update', { jobId, error })
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

      const files = await storage.getFiles()
      await storage.saveModel({
        name: `Model_${new Date().toISOString().split('T')[0]}_${jobId.slice(0, 8)}`,
        path: modelPath,
        config,
        status: 'ready',
        fileCount: files.length,
        isActive: false
      })

      if (this.io) {
        this.io.emit('training-complete', { jobId, modelPath, epochs: config.epochs })
      }

      logger.info(`Training ${jobId} completed successfully`)
    } catch (error) {
      logger.error(`Failed to finalize training ${jobId}`, { error })
    }
  }

  private async handleTrainingError(jobId: string, error: string) {
    try {
      await storage.updateTrainingJob(jobId, {
        status: 'failed',
        error,
        endTime: new Date()
      })

      if (this.io) {
        this.io.emit('training-error', { jobId, error })
      }

      logger.error(`Training ${jobId} failed: ${error}`)
    } catch (err) {
      logger.error(`Failed to record training error for ${jobId}`, { err })
    }
  }

  async stopTraining(jobId: string): Promise<void> {
    const child = this.activeJobs.get(jobId)

    if (!child) {
      logger.warn(`Stop requested for unknown/finished job ${jobId}`)
      return
    }

    child.kill('SIGTERM')

    // Give it a few seconds to shut down cleanly, then force-kill
    const forceKillTimeout = setTimeout(() => {
      if (!child.killed) {
        child.kill('SIGKILL')
        logger.warn(`Force-killed training ${jobId}`)
      }
    }, 10_000)

    child.once('close', () => clearTimeout(forceKillTimeout))

    this.activeJobs.delete(jobId)

    await storage.updateTrainingJob(jobId, {
      status: 'cancelled',
      endTime: new Date()
    })

    if (this.io) {
      this.io.emit('training-cancelled', { jobId })
    }

    logger.info(`Training ${jobId} stopped`)
  }

  async getTrainingStatus(jobId: string) {
    return await storage.getTrainingJob(jobId)
  }
}

export default new TrainingService()
