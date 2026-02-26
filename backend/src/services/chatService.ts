import axios from 'axios'
import storage from '@/utils/storage'
import logger from '@/utils/logger'
import type { ChatResponse } from '@/types'

const MAX_RETRIES = 2
const RETRY_DELAY_MS = 500

class ChatService {
  private readonly chatAPIUrl: string

  constructor() {
    this.chatAPIUrl = process.env.CHAT_API_URL || 'http://localhost:8000'
  }

  async sendMessage(message: string, modelId?: string): Promise<ChatResponse> {
    // Resolve model
    let targetModel
    if (modelId) {
      const models = await storage.getModels()
      targetModel = models.find(m => m.id === modelId)
    } else {
      targetModel = await storage.getActiveModel()
    }

    if (!targetModel) {
      throw new Error('No active model available. Please train or activate a model first.')
    }

    // Retry loop for transient failures
    let lastError: Error | null = null
    for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
      try {
        const response = await axios.post(`${this.chatAPIUrl}/chat`, {
          message,
          model_path: targetModel.path,
          max_length: targetModel.config.maxLength
        }, {
          timeout: 60_000
        })

        return {
          response: response.data.response,
          modelId: targetModel.id
        }
      } catch (error) {
        lastError = error as Error

        if (axios.isAxiosError(error)) {
          // Don't retry on client errors (4xx)
          if (error.response && error.response.status >= 400 && error.response.status < 500) {
            break
          }
        }

        if (attempt < MAX_RETRIES) {
          logger.warn(`Chat request failed (attempt ${attempt + 1}/${MAX_RETRIES + 1}), retrying...`, {
            error: (error as Error).message
          })
          await new Promise(r => setTimeout(r, RETRY_DELAY_MS * (attempt + 1)))
        }
      }
    }

    // All retries exhausted
    logger.error('Chat service error after retries', { error: lastError?.message })

    if (axios.isAxiosError(lastError)) {
      if (lastError.code === 'ECONNREFUSED') {
        throw new Error('Chat service is not running. Please start the Python service (python start_chat_api.py).')
      }
      if (lastError.code === 'ETIMEDOUT' || lastError.code === 'ECONNABORTED') {
        throw new Error('Chat service timed out. The model may be loading — please try again.')
      }
      if (lastError.response?.status === 404) {
        throw new Error('Model not found by the chat service. It may have been moved or deleted.')
      }
    }

    throw new Error('Failed to get a response from the chat service.')
  }

  async getActiveModel() {
    return await storage.getActiveModel()
  }

  async healthCheck(): Promise<boolean> {
    try {
      const response = await axios.get(`${this.chatAPIUrl}/health`, { timeout: 5000 })
      return response.status === 200
    } catch {
      return false
    }
  }
}

export default new ChatService()
