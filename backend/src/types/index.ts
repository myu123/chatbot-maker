export interface TrainingFile {
  id: string
  name: string
  size: number
  type: string
  path: string
  uploadedAt: Date
}

export interface TrainingConfig {
  modelSize: 'gpt2' | 'gpt2-medium' | 'gpt2-large' | 'gpt2-xl'
  epochs: number
  batchSize: number
  learningRate: number
  maxLength: number
  trainFraction: number
}

export interface TrainingJob {
  id: string
  status: 'pending' | 'running' | 'completed' | 'failed' | 'cancelled'
  config: TrainingConfig
  progress: number
  currentEpoch: number
  totalEpochs: number
  loss?: number
  estimatedTimeRemaining?: number
  error?: string
  startTime: Date
  endTime?: Date
  modelPath?: string
}

export interface ChatbotModel {
  id: string
  name: string
  path: string
  config: TrainingConfig
  createdAt: Date
  status: 'ready' | 'training' | 'error'
  fileCount: number
  isActive: boolean
}

export interface ChatMessage {
  message: string
  modelId?: string
}

export interface ChatResponse {
  response: string
  modelId: string
}