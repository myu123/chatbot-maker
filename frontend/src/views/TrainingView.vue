<template>
  <div class="space-y-8">
    <div class="text-center">
      <h1 class="text-3xl font-bold text-gray-900 mb-4">Train Your Chatbot</h1>
      <p class="text-lg text-gray-600">Upload training files and configure your model</p>
    </div>

    <!-- File Upload Section -->
    <div class="bg-white rounded-lg shadow">
      <div class="px-6 py-4 border-b border-gray-200">
        <h2 class="text-lg font-medium text-gray-900">Training Files</h2>
      </div>
      <div class="p-6">
        <!-- File Upload Area -->
        <div 
          class="border-2 border-dashed border-gray-300 rounded-lg p-8 text-center hover:border-blue-500 transition-colors"
          @drop="handleDrop"
          @dragover="handleDragOver"
          @dragenter="handleDragEnter"
          @dragleave="handleDragLeave"
          :class="{ 'border-blue-500 bg-blue-50': isDragging }"
        >
          <CloudArrowUpIcon class="w-12 h-12 text-gray-400 mx-auto mb-4" />
          <p class="text-lg font-medium text-gray-900 mb-2">
            Drop files here or click to upload
          </p>
          <p class="text-sm text-gray-500 mb-4">
            Supports .txt and .pdf files
          </p>
          <input
            ref="fileInput"
            type="file"
            multiple
            accept=".txt,.pdf"
            @change="handleFileSelect"
            class="hidden"
          >
          <button
            @click="$refs.fileInput.click()"
            class="bg-blue-600 text-white px-6 py-2 rounded-md hover:bg-blue-700 transition-colors"
          >
            Choose Files
          </button>
        </div>

        <!-- File List -->
        <div v-if="store.files.length > 0" class="mt-6">
          <h3 class="text-md font-medium text-gray-900 mb-3">Uploaded Files</h3>
          <div class="space-y-2">
            <div 
              v-for="file in store.files" 
              :key="file.id"
              class="flex items-center justify-between p-3 bg-gray-50 rounded-lg"
            >
              <div class="flex items-center">
                <DocumentIcon class="w-5 h-5 text-gray-400 mr-3" />
                <div>
                  <div class="font-medium text-gray-900">{{ file.name }}</div>
                  <div class="text-sm text-gray-500">
                    {{ formatFileSize(file.size) }} • {{ formatDate(file.uploadedAt) }}
                  </div>
                </div>
              </div>
              <button
                @click="deleteFile(file.id)"
                class="text-red-600 hover:text-red-800 p-1"
              >
                <TrashIcon class="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- Training Configuration -->
    <div class="bg-white rounded-lg shadow">
      <div class="px-6 py-4 border-b border-gray-200">
        <h2 class="text-lg font-medium text-gray-900">Training Configuration</h2>
      </div>
      <div class="p-6">
        <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <label class="block text-sm font-medium text-gray-700 mb-2">
              Model Size
            </label>
            <select 
              v-model="config.modelSize"
              class="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="gpt2">GPT-2 (117M params - Fast)</option>
              <option value="gpt2-medium">GPT-2 Medium (345M params)</option>
              <option value="gpt2-large">GPT-2 Large (774M params)</option>
              <option value="gpt2-xl">GPT-2 XL (1.5B params - Slow)</option>
            </select>
          </div>

          <div>
            <label class="block text-sm font-medium text-gray-700 mb-2">
              Training Epochs
            </label>
            <input 
              v-model.number="config.epochs"
              type="number"
              min="1"
              max="1000"
              class="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
          </div>

          <div>
            <label class="block text-sm font-medium text-gray-700 mb-2">
              Batch Size
            </label>
            <input 
              v-model.number="config.batchSize"
              type="number"
              min="1"
              max="32"
              class="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
          </div>

          <div>
            <label class="block text-sm font-medium text-gray-700 mb-2">
              Learning Rate
            </label>
            <input 
              v-model.number="config.learningRate"
              type="number"
              step="0.00001"
              min="0.00001"
              max="0.1"
              class="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
          </div>

          <div>
            <label class="block text-sm font-medium text-gray-700 mb-2">
              Max Response Length
            </label>
            <input 
              v-model.number="config.maxLength"
              type="number"
              min="50"
              max="1000"
              class="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
          </div>

          <div>
            <label class="block text-sm font-medium text-gray-700 mb-2">
              Train/Validation Split
            </label>
            <input 
              v-model.number="config.trainFraction"
              type="number"
              step="0.01"
              min="0.5"
              max="0.95"
              class="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
            <p class="text-xs text-gray-500 mt-1">
              {{ Math.round(config.trainFraction * 100) }}% for training, 
              {{ Math.round((1 - config.trainFraction) * 100) }}% for validation
            </p>
          </div>
        </div>
      </div>
    </div>

    <!-- Training Progress -->
    <div v-if="store.trainingStatus.isTraining" class="bg-blue-50 border border-blue-200 rounded-lg p-6">
      <div class="flex items-center justify-between mb-4">
        <div class="flex items-center">
          <CogIcon class="w-6 h-6 text-blue-600 mr-2 animate-spin" />
          <h3 class="text-lg font-medium text-blue-900">Training in Progress</h3>
        </div>
        <button
          @click="stopTraining"
          class="bg-red-600 text-white px-4 py-2 rounded-md hover:bg-red-700 transition-colors"
        >
          Stop Training
        </button>
      </div>
      
      <div class="space-y-3">
        <div class="flex justify-between text-sm text-blue-700">
          <span>Epoch {{ store.trainingStatus.currentEpoch }} of {{ store.trainingStatus.totalEpochs }}</span>
          <span>{{ Math.round(store.trainingStatus.progress) }}%</span>
        </div>
        <div class="w-full bg-blue-200 rounded-full h-3">
          <div 
            class="bg-blue-600 h-3 rounded-full transition-all duration-300"
            :style="{ width: `${store.trainingStatus.progress}%` }"
          ></div>
        </div>
        <div class="grid grid-cols-2 gap-4 text-sm text-blue-700">
          <div v-if="store.trainingStatus.loss">
            Loss: {{ store.trainingStatus.loss.toFixed(4) }}
          </div>
          <div v-if="store.trainingStatus.estimatedTimeRemaining">
            Time remaining: {{ formatTime(store.trainingStatus.estimatedTimeRemaining) }}
          </div>
        </div>
      </div>
    </div>

    <!-- Start Training Button -->
    <div class="text-center">
      <button
        @click="startTraining"
        :disabled="!store.canStartTraining"
        class="bg-green-600 text-white px-8 py-3 rounded-lg font-medium hover:bg-green-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
      >
        <CogIcon v-if="store.trainingStatus.isTraining" class="w-5 h-5 mr-2 animate-spin inline" />
        {{ store.trainingStatus.isTraining ? 'Training...' : 'Start Training' }}
      </button>
      <p v-if="!store.hasFiles" class="text-sm text-gray-500 mt-2">
        Upload at least one file to start training
      </p>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive } from 'vue'
import { useAppStore } from '@/stores/app'
import { useToast } from 'vue-toastification'
import { trainingApi } from '@/services/api'
import socketService from '@/services/socket'
import type { TrainingConfig } from '@/types'
import {
  CloudArrowUpIcon,
  DocumentIcon,
  TrashIcon,
  CogIcon
} from '@heroicons/vue/24/outline'

const store = useAppStore()
const toast = useToast()

const isDragging = ref(false)
const currentJobId = ref<string | null>(null)

const config = reactive<TrainingConfig>({
  modelSize: 'gpt2',
  epochs: 3,
  batchSize: 4,
  learningRate: 0.00005,
  maxLength: 150,
  trainFraction: 0.8
})

const handleDragOver = (e: DragEvent) => {
  e.preventDefault()
}

const handleDragEnter = (e: DragEvent) => {
  e.preventDefault()
  isDragging.value = true
}

const handleDragLeave = (e: DragEvent) => {
  e.preventDefault()
  isDragging.value = false
}

const handleDrop = async (e: DragEvent) => {
  e.preventDefault()
  isDragging.value = false
  
  const files = Array.from(e.dataTransfer?.files || [])
  await uploadFiles(files)
}

const handleFileSelect = async (e: Event) => {
  const target = e.target as HTMLInputElement
  if (target.files) {
    const files = Array.from(target.files)
    await uploadFiles(files)
  }
}

const uploadFiles = async (files: File[]) => {
  const validFiles = files.filter(file => 
    file.type === 'text/plain' || file.type === 'application/pdf'
  )
  
  if (validFiles.length !== files.length) {
    toast.warning('Some files were skipped. Only .txt and .pdf files are supported.')
  }
  
  if (validFiles.length === 0) {
    toast.error('No valid files selected.')
    return
  }

  try {
    await store.uploadFiles(validFiles)
    toast.success(`Successfully uploaded ${validFiles.length} file(s)`)
  } catch (error) {
    toast.error('Failed to upload files')
  }
}

const deleteFile = async (fileId: string) => {
  try {
    await store.deleteFile(fileId)
    toast.success('File deleted successfully')
  } catch (error) {
    toast.error('Failed to delete file')
  }
}

const startTraining = async () => {
  try {
    currentJobId.value = await trainingApi.startTraining(config)
    socketService.subscribeToTraining(currentJobId.value)
    toast.success('Training started successfully')
  } catch (error) {
    toast.error('Failed to start training')
  }
}

const stopTraining = async () => {
  if (currentJobId.value) {
    try {
      await trainingApi.stopTraining(currentJobId.value)
      socketService.unsubscribeFromTraining(currentJobId.value)
      toast.info('Training stopped')
    } catch (error) {
      toast.error('Failed to stop training')
    }
  }
}

const formatFileSize = (bytes: number): string => {
  if (bytes === 0) return '0 B'
  const k = 1024
  const sizes = ['B', 'KB', 'MB', 'GB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i]
}

const formatDate = (date: Date): string => {
  return new Date(date).toLocaleDateString()
}

const formatTime = (seconds: number): string => {
  const hours = Math.floor(seconds / 3600)
  const minutes = Math.floor((seconds % 3600) / 60)
  const secs = Math.floor(seconds % 60)
  
  if (hours > 0) {
    return `${hours}h ${minutes}m ${secs}s`
  } else if (minutes > 0) {
    return `${minutes}m ${secs}s`
  } else {
    return `${secs}s`
  }
}
</script>