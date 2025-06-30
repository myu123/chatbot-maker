import axios from 'axios'
import storage from '@/utils/storage'
import logger from '@/utils/logger'
import type { ChatMessage, ChatResponse } from '@/types'

class ChatService {
  private readonly chatAPIUrl: string

  constructor() {
    this.chatAPIUrl = process.env.CHAT_API_URL || 'http://localhost:8000'
  }

  async sendMessage(message: string, modelId?: string): Promise<ChatResponse> {
    try {
      // Get active model if no modelId provided
      let targetModel
      if (modelId) {
        const models = await storage.getModels()
        targetModel = models.find(m => m.id === modelId)
      } else {
        targetModel = await storage.getActiveModel()
      }

      if (!targetModel) {
        throw new Error('No active model available')
      }

      // Send request to Python chat service
      const response = await axios.post(`${this.chatAPIUrl}/chat`, {
        message,
        model_path: targetModel.path,
        max_length: targetModel.config.maxLength
      }, {
        timeout: 30000
      })

      return {
        response: response.data.response,
        modelId: targetModel.id
      }
    } catch (error) {
      logger.error('Chat service error:', error)
      
      if (axios.isAxiosError(error)) {
        if (error.code === 'ECONNREFUSED') {
          throw new Error('Chat service is not available. Please ensure the Python service is running.')
        } else if (error.response?.status === 404) {
          throw new Error('Model not found or not loaded.')
        } else if (error.response?.status === 500) {
          throw new Error('Chat service encountered an internal error.')
        }
      }
      
      throw new Error('Failed to process chat message')
    }
  }

  async getActiveModel() {
    return await storage.getActiveModel()
  }

  async healthCheck(): Promise<boolean> {
    try {
      const response = await axios.get(`${this.chatAPIUrl}/health`, {
        timeout: 5000
      })
      return response.status === 200
    } catch (error) {
      logger.warn('Chat service health check failed:', error)
      return false
    }
  }
}

export default new ChatService()