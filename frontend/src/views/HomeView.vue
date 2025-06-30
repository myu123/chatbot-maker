<template>
  <div class="space-y-8">
    <!-- Hero Section -->
    <div class="text-center">
      <h1 class="text-4xl font-bold text-gray-900 mb-4">
        Welcome to Chatbot Maker
      </h1>
      <p class="text-xl text-gray-600 max-w-2xl mx-auto">
        Train your own AI chatbot using GPT-2 with your custom documents. 
        Upload files, configure training parameters, and chat with your personalized AI.
      </p>
    </div>

    <!-- Quick Stats -->
    <div class="grid grid-cols-1 md:grid-cols-4 gap-6">
      <div class="bg-white rounded-lg shadow p-6 text-center">
        <DocumentIcon class="w-8 h-8 text-blue-600 mx-auto mb-2" />
        <div class="text-2xl font-bold text-gray-900">{{ store.totalFiles }}</div>
        <div class="text-sm text-gray-600">Training Files</div>
      </div>
      
      <div class="bg-white rounded-lg shadow p-6 text-center">
        <CubeIcon class="w-8 h-8 text-green-600 mx-auto mb-2" />
        <div class="text-2xl font-bold text-gray-900">{{ store.models.length }}</div>
        <div class="text-sm text-gray-600">Trained Models</div>
      </div>
      
      <div class="bg-white rounded-lg shadow p-6 text-center">
        <CloudArrowUpIcon class="w-8 h-8 text-purple-600 mx-auto mb-2" />
        <div class="text-2xl font-bold text-gray-900">{{ formatFileSize(store.totalFileSize) }}</div>
        <div class="text-sm text-gray-600">Total Data</div>
      </div>
      
      <div class="bg-white rounded-lg shadow p-6 text-center">
        <ChatBubbleLeftRightIcon class="w-8 h-8 text-orange-600 mx-auto mb-2" />
        <div class="text-2xl font-bold text-gray-900">{{ store.hasActiveModel ? 'Ready' : 'None' }}</div>
        <div class="text-sm text-gray-600">Active Model</div>
      </div>
    </div>

    <!-- Quick Actions -->
    <div class="bg-white rounded-lg shadow">
      <div class="px-6 py-4 border-b border-gray-200">
        <h2 class="text-lg font-medium text-gray-900">Quick Actions</h2>
      </div>
      <div class="p-6">
        <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
          <router-link 
            to="/training" 
            class="flex items-center p-4 border-2 border-dashed border-gray-300 rounded-lg hover:border-blue-500 hover:bg-blue-50 transition-colors group"
          >
            <CogIcon class="w-8 h-8 text-gray-400 group-hover:text-blue-600 mr-3" />
            <div>
              <div class="font-medium text-gray-900 group-hover:text-blue-600">
                Start Training
              </div>
              <div class="text-sm text-gray-500">
                Upload files and train a new model
              </div>
            </div>
          </router-link>

          <router-link 
            to="/chat" 
            class="flex items-center p-4 border-2 border-dashed border-gray-300 rounded-lg hover:border-green-500 hover:bg-green-50 transition-colors group"
            :class="!store.hasActiveModel && 'opacity-50 cursor-not-allowed'"
          >
            <ChatBubbleLeftRightIcon class="w-8 h-8 text-gray-400 group-hover:text-green-600 mr-3" />
            <div>
              <div class="font-medium text-gray-900 group-hover:text-green-600">
                Chat with Bot
              </div>
              <div class="text-sm text-gray-500">
                {{ store.hasActiveModel ? 'Start a conversation' : 'No model active' }}
              </div>
            </div>
          </router-link>

          <router-link 
            to="/models" 
            class="flex items-center p-4 border-2 border-dashed border-gray-300 rounded-lg hover:border-purple-500 hover:bg-purple-50 transition-colors group"
          >
            <CubeIcon class="w-8 h-8 text-gray-400 group-hover:text-purple-600 mr-3" />
            <div>
              <div class="font-medium text-gray-900 group-hover:text-purple-600">
                Manage Models
              </div>
              <div class="text-sm text-gray-500">
                View and manage your trained models
              </div>
            </div>
          </router-link>
        </div>
      </div>
    </div>

    <!-- Training Status -->
    <div v-if="store.trainingStatus.isTraining" class="bg-blue-50 border border-blue-200 rounded-lg p-6">
      <div class="flex items-center mb-4">
        <CogIcon class="w-6 h-6 text-blue-600 mr-2 animate-spin" />
        <h3 class="text-lg font-medium text-blue-900">Training in Progress</h3>
      </div>
      <div class="space-y-3">
        <div class="flex justify-between text-sm text-blue-700">
          <span>Epoch {{ store.trainingStatus.currentEpoch }} of {{ store.trainingStatus.totalEpochs }}</span>
          <span>{{ Math.round(store.trainingStatus.progress) }}%</span>
        </div>
        <div class="w-full bg-blue-200 rounded-full h-2">
          <div 
            class="bg-blue-600 h-2 rounded-full transition-all duration-300"
            :style="{ width: `${store.trainingStatus.progress}%` }"
          ></div>
        </div>
        <div v-if="store.trainingStatus.estimatedTimeRemaining" class="text-sm text-blue-600">
          Estimated time remaining: {{ formatTime(store.trainingStatus.estimatedTimeRemaining) }}
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { useAppStore } from '@/stores/app'
import { 
  DocumentIcon,
  CubeIcon,
  CloudArrowUpIcon,
  ChatBubbleLeftRightIcon,
  CogIcon
} from '@heroicons/vue/24/outline'

const store = useAppStore()

const formatFileSize = (bytes: number): string => {
  if (bytes === 0) return '0 B'
  const k = 1024
  const sizes = ['B', 'KB', 'MB', 'GB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i]
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