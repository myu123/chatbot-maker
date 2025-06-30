import fs from 'fs/promises'
import path from 'path'
import { v4 as uuidv4 } from 'uuid'
import type { TrainingFile, TrainingJob, ChatbotModel } from '@/types'

class Storage {
  private readonly uploadsDir: string
  private readonly modelsDir: string
  private readonly dataFile: string

  constructor() {
    this.uploadsDir = path.join(process.cwd(), '..', 'uploads')
    this.modelsDir = path.join(process.cwd(), '..', 'models')
    this.dataFile = path.join(process.cwd(), '..', 'data.json')
    this.initializeStorage()
  }

  private async initializeStorage() {
    try {
      await fs.mkdir(this.uploadsDir, { recursive: true })
      await fs.mkdir(this.modelsDir, { recursive: true })
      await fs.mkdir(path.join(process.cwd(), '..', 'logs'), { recursive: true })
      
      // Initialize data file if it doesn't exist
      try {
        await fs.access(this.dataFile)
      } catch {
        await this.saveData({
          files: [],
          jobs: [],
          models: [],
          activeModelId: null
        })
      }
    } catch (error) {
      console.error('Failed to initialize storage:', error)
    }
  }

  private async loadData() {
    try {
      const data = await fs.readFile(this.dataFile, 'utf-8')
      return JSON.parse(data)
    } catch {
      return {
        files: [],
        jobs: [],
        models: [],
        activeModelId: null
      }
    }
  }

  private async saveData(data: any) {
    await fs.writeFile(this.dataFile, JSON.stringify(data, null, 2))
  }

  // File operations
  async saveFile(file: Express.Multer.File): Promise<TrainingFile> {
    const fileId = uuidv4()
    const fileName = `${fileId}_${file.originalname}`
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
    const fileIndex = data.files.findIndex((f: TrainingFile) => f.id === fileId)
    
    if (fileIndex === -1) {
      throw new Error('File not found')
    }

    const file = data.files[fileIndex]
    
    try {
      await fs.unlink(file.path)
    } catch (error) {
      console.warn('Failed to delete file from filesystem:', error)
    }

    data.files.splice(fileIndex, 1)
    await this.saveData(data)
  }

  // Training job operations
  async createTrainingJob(config: any): Promise<string> {
    const jobId = uuidv4()
    const job: TrainingJob = {
      id: jobId,
      status: 'pending',
      config,
      progress: 0,
      currentEpoch: 0,
      totalEpochs: config.epochs,
      startTime: new Date()
    }

    const data = await this.loadData()
    data.jobs.push(job)
    await this.saveData(data)

    return jobId
  }

  async updateTrainingJob(jobId: string, updates: Partial<TrainingJob>): Promise<void> {
    const data = await this.loadData()
    const jobIndex = data.jobs.findIndex((j: TrainingJob) => j.id === jobId)
    
    if (jobIndex === -1) {
      throw new Error('Job not found')
    }

    data.jobs[jobIndex] = { ...data.jobs[jobIndex], ...updates }
    await this.saveData(data)
  }

  async getTrainingJob(jobId: string): Promise<TrainingJob | null> {
    const data = await this.loadData()
    return data.jobs.find((j: TrainingJob) => j.id === jobId) || null
  }

  // Model operations
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
    const modelIndex = data.models.findIndex((m: ChatbotModel) => m.id === modelId)
    
    if (modelIndex === -1) {
      throw new Error('Model not found')
    }

    const model = data.models[modelIndex]
    
    // Delete model files
    try {
      await fs.rm(model.path, { recursive: true, force: true })
    } catch (error) {
      console.warn('Failed to delete model files:', error)
    }

    data.models.splice(modelIndex, 1)
    
    // Clear active model if it was deleted
    if (data.activeModelId === modelId) {
      data.activeModelId = null
    }
    
    await this.saveData(data)
  }

  async setActiveModel(modelId: string): Promise<void> {
    const data = await this.loadData()
    const model = data.models.find((m: ChatbotModel) => m.id === modelId)
    
    if (!model) {
      throw new Error('Model not found')
    }

    // Update all models to inactive
    data.models.forEach((m: ChatbotModel) => {
      m.isActive = false
    })

    // Set the selected model as active
    model.isActive = true
    data.activeModelId = modelId
    
    await this.saveData(data)
  }

  async getActiveModel(): Promise<ChatbotModel | null> {
    const data = await this.loadData()
    return data.models.find((m: ChatbotModel) => m.isActive) || null
  }

  getUploadsDir(): string {
    return this.uploadsDir
  }

  getModelsDir(): string {
    return this.modelsDir
  }
}

export default new Storage()