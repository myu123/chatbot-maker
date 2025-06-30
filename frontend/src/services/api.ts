import axios from 'axios'
import type { TrainingConfig, ChatbotModel, TrainingFile } from '@/types'

const api = axios.create({
  baseURL: '/api',
  timeout: 30000
})

export const fileApi = {
  uploadFiles: async (files: File[]): Promise<TrainingFile[]> => {
    const formData = new FormData()
    files.forEach(file => formData.append('files', file))
    
    const response = await api.post('/files/upload', formData, {
      headers: { 'Content-Type': 'multipart/form-data' }
    })
    return response.data
  },

  getFiles: async (): Promise<TrainingFile[]> => {
    const response = await api.get('/files')
    return response.data
  },

  deleteFile: async (fileId: string): Promise<void> => {
    await api.delete(`/files/${fileId}`)
  }
}

export const trainingApi = {
  startTraining: async (config: TrainingConfig): Promise<string> => {
    const response = await api.post('/training/start', config)
    return response.data.jobId
  },

  getTrainingStatus: async (jobId: string) => {
    const response = await api.get(`/training/status/${jobId}`)
    return response.data
  },

  stopTraining: async (jobId: string): Promise<void> => {
    await api.post(`/training/stop/${jobId}`)
  }
}

export const modelApi = {
  getModels: async (): Promise<ChatbotModel[]> => {
    const response = await api.get('/models')
    return response.data
  },

  deleteModel: async (modelId: string): Promise<void> => {
    await api.delete(`/models/${modelId}`)
  },

  setActiveModel: async (modelId: string): Promise<void> => {
    await api.post(`/models/${modelId}/activate`)
  }
}

export const chatApi = {
  sendMessage: async (message: string, modelId?: string): Promise<string> => {
    const response = await api.post('/chat/message', { 
      message, 
      modelId 
    })
    return response.data.response
  },

  getActiveModel: async (): Promise<ChatbotModel | null> => {
    try {
      const response = await api.get('/chat/active-model')
      return response.data
    } catch (error) {
      return null
    }
  }
}

export default api