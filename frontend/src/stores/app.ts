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
    } finally {
      isLoading.value = false
    }
  }

  const uploadFiles = async (newFiles: File[]) => {
    try {
      isLoading.value = true
      const uploaded = await fileApi.uploadFiles(newFiles)
      files.value.push(...uploaded)
      return uploaded
    } catch (error) {
      console.error('Failed to upload files:', error)
      throw error
    } finally {
      isLoading.value = false
    }
  }

  const deleteFile = async (fileId: string) => {
    await fileApi.deleteFile(fileId)
    files.value = files.value.filter(f => f.id !== fileId)
  }

  const loadModels = async () => {
    try {
      isLoading.value = true
      models.value = await modelApi.getModels()
    } catch (error) {
      console.error('Failed to load models:', error)
    } finally {
      isLoading.value = false
    }
  }

  const deleteModel = async (modelId: string) => {
    await modelApi.deleteModel(modelId)
    models.value = models.value.filter(m => m.id !== modelId)
    if (activeModel.value?.id === modelId) {
      activeModel.value = null
    }
  }

  const setActiveModel = async (modelId: string) => {
    await modelApi.setActiveModel(modelId)
    // Update local state to reflect the change
    models.value.forEach(m => {
      (m as Record<string, unknown>).isActive = m.id === modelId
    })
    activeModel.value = models.value.find(m => m.id === modelId) ?? null
  }

  const loadActiveModel = async () => {
    try {
      activeModel.value = await chatApi.getActiveModel()
    } catch {
      // Chat service may not be running yet — that's fine
      activeModel.value = null
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
      chatMessages.value.push({
        id: (Date.now() + 1).toString(),
        content: response,
        isUser: false,
        timestamp: new Date()
      })
    } catch (error) {
      chatMessages.value.push({
        id: (Date.now() + 1).toString(),
        content: 'Sorry, I could not generate a response. Please check that the chat service is running.',
        isUser: false,
        timestamp: new Date()
      })
      throw error
    }
  }

  const clearChat = () => {
    chatMessages.value = []
  }

  const initializeSocket = () => {
    socketService.connect()

    socketService.onTrainingProgress((status: TrainingStatus) => {
      trainingStatus.value = {
        ...trainingStatus.value,
        isTraining: true,
        status: 'training',
        progress: status.progress ?? trainingStatus.value.progress,
        currentEpoch: status.currentEpoch ?? trainingStatus.value.currentEpoch,
        totalEpochs: status.totalEpochs ?? trainingStatus.value.totalEpochs,
        loss: status.loss ?? trainingStatus.value.loss,
        estimatedTimeRemaining: status.estimatedTimeRemaining ?? trainingStatus.value.estimatedTimeRemaining
      }
    })

    socketService.onTrainingComplete((result) => {
      trainingStatus.value = {
        isTraining: false,
        progress: 100,
        currentEpoch: result.epochs,
        totalEpochs: result.epochs,
        status: 'completed'
      }
      loadModels()
    })

    socketService.onTrainingError((error) => {
      trainingStatus.value = {
        isTraining: false,
        progress: 0,
        currentEpoch: 0,
        totalEpochs: 0,
        status: 'error',
        error: typeof error === 'string' ? error : error?.error || 'Unknown error'
      }
    })
  }

  const cleanup = () => {
    socketService.disconnect()
  }

  return {
    files,
    models,
    activeModel,
    trainingStatus,
    chatMessages,
    isLoading,
    totalFiles,
    totalFileSize,
    hasFiles,
    hasActiveModel,
    canStartTraining,
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
