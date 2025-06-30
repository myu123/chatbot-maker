import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import type { TrainingFile, ChatbotModel, TrainingStatus, ChatMessage } from '@/types'
import { fileApi, modelApi, chatApi } from '@/services/api'
import socketService from '@/services/socket'

export const useAppStore = defineStore('app', () => {
  // State
  const files = ref<TrainingFile[]>([])
  const models = ref<ChatbotModel[]>([])
  const activeModel = ref<ChatbotModel | null>(null)
  const trainingStatus = ref<TrainingStatus>({
    isTraining: false,
    progress: 0,
    currentEpoch: 0,
    totalEpochs: 0,
    status: 'idle'
  })
  const chatMessages = ref<ChatMessage[]>([])
  const isLoading = ref(false)

  // Getters
  const totalFiles = computed(() => files.value.length)
  const totalFileSize = computed(() => 
    files.value.reduce((sum, file) => sum + file.size, 0)
  )
  const hasFiles = computed(() => files.value.length > 0)
  const hasActiveModel = computed(() => activeModel.value !== null)
  const canStartTraining = computed(() => hasFiles.value && !trainingStatus.value.isTraining)

  // Actions
  const loadFiles = async () => {
    try {
      isLoading.value = true
      files.value = await fileApi.getFiles()
    } catch (error) {
      console.error('Failed to load files:', error)
      throw error
    } finally {
      isLoading.value = false
    }
  }

  const uploadFiles = async (newFiles: File[]) => {
    try {
      isLoading.value = true
      const uploadedFiles = await fileApi.uploadFiles(newFiles)
      files.value.push(...uploadedFiles)
      return uploadedFiles
    } catch (error) {
      console.error('Failed to upload files:', error)
      throw error
    } finally {
      isLoading.value = false
    }
  }

  const deleteFile = async (fileId: string) => {
    try {
      await fileApi.deleteFile(fileId)
      files.value = files.value.filter(f => f.id !== fileId)
    } catch (error) {
      console.error('Failed to delete file:', error)
      throw error
    }
  }

  const loadModels = async () => {
    try {
      isLoading.value = true
      models.value = await modelApi.getModels()
    } catch (error) {
      console.error('Failed to load models:', error)
      throw error
    } finally {
      isLoading.value = false
    }
  }

  const deleteModel = async (modelId: string) => {
    try {
      await modelApi.deleteModel(modelId)
      models.value = models.value.filter(m => m.id !== modelId)
      if (activeModel.value?.id === modelId) {
        activeModel.value = null
      }
    } catch (error) {
      console.error('Failed to delete model:', error)
      throw error
    }
  }

  const setActiveModel = async (modelId: string) => {
    try {
      await modelApi.setActiveModel(modelId)
      activeModel.value = models.value.find(m => m.id === modelId) || null
    } catch (error) {
      console.error('Failed to set active model:', error)
      throw error
    }
  }

  const loadActiveModel = async () => {
    try {
      activeModel.value = await chatApi.getActiveModel()
    } catch (error) {
      console.error('Failed to load active model:', error)
    }
  }

  const sendChatMessage = async (content: string) => {
    if (!activeModel.value) {
      throw new Error('No active model selected')
    }

    const userMessage: ChatMessage = {
      id: Date.now().toString(),
      content,
      isUser: true,
      timestamp: new Date()
    }
    chatMessages.value.push(userMessage)

    try {
      const response = await chatApi.sendMessage(content, activeModel.value.id)
      const botMessage: ChatMessage = {
        id: (Date.now() + 1).toString(),
        content: response,
        isUser: false,
        timestamp: new Date()
      }
      chatMessages.value.push(botMessage)
    } catch (error) {
      console.error('Failed to send message:', error)
      const errorMessage: ChatMessage = {
        id: (Date.now() + 1).toString(),
        content: 'Sorry, I encountered an error processing your message.',
        isUser: false,
        timestamp: new Date()
      }
      chatMessages.value.push(errorMessage)
      throw error
    }
  }

  const clearChat = () => {
    chatMessages.value = []
  }

  const initializeSocket = () => {
    const socket = socketService.connect()
    
    socketService.onTrainingProgress((status: TrainingStatus) => {
      trainingStatus.value = status
    })

    socketService.onTrainingComplete((result) => {
      trainingStatus.value = {
        isTraining: false,
        progress: 100,
        currentEpoch: result.epochs,
        totalEpochs: result.epochs,
        status: 'completed'
      }
      loadModels() // Refresh models list
    })

    socketService.onTrainingError((error) => {
      trainingStatus.value = {
        isTraining: false,
        progress: 0,
        currentEpoch: 0,
        totalEpochs: 0,
        status: 'error',
        error
      }
    })
  }

  const cleanup = () => {
    socketService.disconnect()
  }

  return {
    // State
    files,
    models,
    activeModel,
    trainingStatus,
    chatMessages,
    isLoading,
    
    // Getters
    totalFiles,
    totalFileSize,
    hasFiles,
    hasActiveModel,
    canStartTraining,
    
    // Actions
    loadFiles,
    uploadFiles,
    deleteFile,
    loadModels,
    deleteModel,
    setActiveModel,
    loadActiveModel,
    sendChatMessage,
    clearChat,
    initializeSocket,
    cleanup
  }
})