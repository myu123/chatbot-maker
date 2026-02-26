import fs from 'fs/promises'
import path from 'path'
import { v4 as uuidv4 } from 'uuid'
import type { TrainingFile, TrainingJob, ChatbotModel } from '@/types'
import logger from '@/utils/logger'

interface StorageData {
  files: TrainingFile[]
  jobs: TrainingJob[]
  models: ChatbotModel[]
  activeModelId: string | null
}

const EMPTY_DATA: StorageData = {
  files: [],
  jobs: [],
  models: [],
  activeModelId: null
}

class Storage {
  private readonly uploadsDir: string
  private readonly modelsDir: string
  private readonly dataFile: string
  private initialized: Promise<void>

  constructor() {
    this.uploadsDir = path.join(process.cwd(), '..', 'uploads')
    this.modelsDir = path.join(process.cwd(), '..', 'models')
    this.dataFile = path.join(process.cwd(), '..', 'data.json')
    this.initialized = this.initializeStorage()
  }

  private async initializeStorage(): Promise<void> {
    try {
      await Promise.all([
        fs.mkdir(this.uploadsDir, { recursive: true }),
        fs.mkdir(this.modelsDir, { recursive: true }),
        fs.mkdir(path.join(process.cwd(), '..', 'logs'), { recursive: true })
      ])

      try {
        await fs.access(this.dataFile)
      } catch {
        await this.saveData({ ...EMPTY_DATA })
      }
    } catch (error) {
      logger.error('Failed to initialize storage', { error })
    }
  }

  private async ensureReady(): Promise<void> {
    await this.initialized
  }

  private async loadData(): Promise<StorageData> {
    await this.ensureReady()
    try {
      const raw = await fs.readFile(this.dataFile, 'utf-8')
      return JSON.parse(raw) as StorageData
    } catch {
      return { ...EMPTY_DATA }
    }
  }

  private async saveData(data: StorageData): Promise<void> {
    // Write atomically: write to temp then rename
    const tmp = this.dataFile + '.tmp'
    await fs.writeFile(tmp, JSON.stringify(data, null, 2))
    await fs.rename(tmp, this.dataFile)
  }

  // ---- File operations ----

  async saveFile(file: Express.Multer.File): Promise<TrainingFile> {
    const fileId = uuidv4()
    // Sanitize original filename
    const safeName = file.originalname.replace(/[^a-zA-Z0-9._-]/g, '_')
    const fileName = `${fileId}_${safeName}`
    const filePath = path.join(this.uploadsDir, fileName)

    await fs.writeFile(filePath, file.buffer)

    const trainingFile: TrainingFile = {
      id: fileId,
      name: file.originalname,
      size: file.size,
      type: file.mimetype,
      path: filePath,
      uploadedAt: new Date()
    }

    const data = await this.loadData()
    data.files.push(trainingFile)
    await this.saveData(data)

    return trainingFile
  }

  async getFiles(): Promise<TrainingFile[]> {
    const data = await this.loadData()
    return data.files
  }

  async deleteFile(fileId: string): Promise<void> {
    const data = await this.loadData()
    const idx = data.files.findIndex((f) => f.id === fileId)

    if (idx === -1) {
      throw new Error('File not found')
    }

    const file = data.files[idx]!

    try {
      await fs.unlink(file.path)
    } catch (error) {
      logger.warn('Could not delete file from disk (may already be gone)', {
        path: file.path,
        error
      })
    }

    data.files.splice(idx, 1)
    await this.saveData(data)
  }

  // ---- Training job operations ----

  async createTrainingJob(config: TrainingFile extends never ? never : Record<string, unknown>): Promise<string> {
    const jobId = uuidv4()
    const job: TrainingJob = {
      id: jobId,
      status: 'pending',
      config: config as TrainingJob['config'],
      progress: 0,
      currentEpoch: 0,
      totalEpochs: (config as Record<string, number>).epochs ?? 0,
      startTime: new Date()
    }

    const data = await this.loadData()
    data.jobs.push(job)
    await this.saveData(data)

    return jobId
  }

  async updateTrainingJob(jobId: string, updates: Partial<TrainingJob>): Promise<void> {
    const data = await this.loadData()
    const idx = data.jobs.findIndex((j) => j.id === jobId)

    if (idx === -1) {
      throw new Error('Job not found')
    }

    data.jobs[idx] = { ...data.jobs[idx]!, ...updates }
    await this.saveData(data)
  }

  async getTrainingJob(jobId: string): Promise<TrainingJob | null> {
    const data = await this.loadData()
    return data.jobs.find((j) => j.id === jobId) ?? null
  }

  // ---- Model operations ----

  async saveModel(model: Omit<ChatbotModel, 'id' | 'createdAt'>): Promise<ChatbotModel> {
    const modelId = uuidv4()
    const newModel: ChatbotModel = {
      ...model,
      id: modelId,
      createdAt: new Date()
    }

    const data = await this.loadData()
    data.models.push(newModel)
    await this.saveData(data)

    return newModel
  }

  async getModels(): Promise<ChatbotModel[]> {
    const data = await this.loadData()
    return data.models
  }

  async deleteModel(modelId: string): Promise<void> {
    const data = await this.loadData()
    const idx = data.models.findIndex((m) => m.id === modelId)

    if (idx === -1) {
      throw new Error('Model not found')
    }

    const model = data.models[idx]!

    try {
      await fs.rm(model.path, { recursive: true, force: true })
    } catch (error) {
      logger.warn('Could not delete model directory', { path: model.path, error })
    }

    data.models.splice(idx, 1)

    if (data.activeModelId === modelId) {
      data.activeModelId = null
    }

    await this.saveData(data)
  }

  async setActiveModel(modelId: string): Promise<void> {
    const data = await this.loadData()
    const model = data.models.find((m) => m.id === modelId)

    if (!model) {
      throw new Error('Model not found')
    }

    for (const m of data.models) {
      m.isActive = m.id === modelId
    }
    data.activeModelId = modelId

    await this.saveData(data)
  }

  async getActiveModel(): Promise<ChatbotModel | null> {
    const data = await this.loadData()
    return data.models.find((m) => m.isActive) ?? null
  }

  getUploadsDir(): string {
    return this.uploadsDir
  }

  getModelsDir(): string {
    return this.modelsDir
  }
}

export default new Storage()
