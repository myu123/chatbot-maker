export interface TrainingFile {
  id: string
  name: string
  size: number
  type: string
  uploadedAt: Date
}

export interface ChatMessage {
  id: string
  content: string
  isUser: boolean
  timestamp: Date
}

export interface TrainingConfig {
  modelSize: 'gpt2' | 'gpt2-medium' | 'gpt2-large' | 'gpt2-xl'
  epochs: number
  batchSize: number
  learningRate: number
  maxLength: number
  trainFraction: number
}

export interface TrainingStatus {
  isTraining: boolean
  progress: number
  currentEpoch: number
  totalEpochs: number
  loss?: number
  estimatedTimeRemaining?: number
  status: 'idle' | 'preparing' | 'training' | 'completed' | 'error'
  error?: string
}

export interface ChatbotModel {
  id: string
  name: string
  createdAt: Date
  config: TrainingConfig
  status: 'ready' | 'training' | 'error'
  fileCount: number
}