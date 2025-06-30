<template>
  <div class="space-y-8">
    <div class="text-center">
      <h1 class="text-3xl font-bold text-gray-900 mb-4">Manage Models</h1>
      <p class="text-lg text-gray-600">View and manage your trained chatbot models</p>
    </div>

    <!-- Models Grid -->
    <div v-if="store.models.length > 0" class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
      <div
        v-for="model in store.models"
        :key="model.id"
        class="bg-white rounded-lg shadow-md border hover:shadow-lg transition-shadow"
        :class="store.activeModel?.id === model.id && 'ring-2 ring-blue-500'"
      >
        <div class="p-6">
          <!-- Model Header -->
          <div class="flex items-center justify-between mb-4">
            <div class="flex items-center">
              <CubeIcon class="w-6 h-6 text-blue-600 mr-2" />
              <h3 class="text-lg font-semibold text-gray-900">{{ model.name }}</h3>
            </div>
            <div class="flex items-center space-x-2">
              <span
                class="px-2 py-1 text-xs font-medium rounded-full"
                :class="{
                  'bg-green-100 text-green-800': model.status === 'ready',
                  'bg-yellow-100 text-yellow-800': model.status === 'training',
                  'bg-red-100 text-red-800': model.status === 'error'
                }"
              >
                {{ model.status }}
              </span>
              <div class="relative">
                <button
                  @click="toggleDropdown(model.id)"
                  class="text-gray-400 hover:text-gray-600 p-1"
                >
                  <EllipsisVerticalIcon class="w-4 h-4" />
                </button>
                <div
                  v-if="activeDropdown === model.id"
                  class="absolute right-0 mt-2 w-48 bg-white rounded-md shadow-lg z-10 border"
                >
                  <button
                    v-if="store.activeModel?.id !== model.id"
                    @click="activateModel(model.id)"
                    class="block w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
                  >
                    Set as Active
                  </button>
                  <button
                    @click="deleteModel(model.id)"
                    class="block w-full text-left px-4 py-2 text-sm text-red-600 hover:bg-red-50"
                  >
                    Delete Model
                  </button>
                </div>
              </div>
            </div>
          </div>

          <!-- Active Badge -->
          <div v-if="store.activeModel?.id === model.id" class="mb-4">
            <span class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
              <span class="w-2 h-2 bg-blue-400 rounded-full mr-1"></span>
              Active Model
            </span>
          </div>

          <!-- Model Info -->
          <div class="space-y-3">
            <div class="grid grid-cols-2 gap-3 text-sm">
              <div>
                <span class="text-gray-500">Model Size:</span>
                <div class="font-medium">{{ formatModelSize(model.config.modelSize) }}</div>
              </div>
              <div>
                <span class="text-gray-500">Training Files:</span>
                <div class="font-medium">{{ model.fileCount }}</div>
              </div>
              <div>
                <span class="text-gray-500">Epochs:</span>
                <div class="font-medium">{{ model.config.epochs }}</div>
              </div>
              <div>
                <span class="text-gray-500">Created:</span>
                <div class="font-medium">{{ formatDate(model.createdAt) }}</div>
              </div>
            </div>

            <!-- Configuration Details -->
            <div class="pt-3 border-t">
              <h4 class="text-sm font-medium text-gray-900 mb-2">Configuration</h4>
              <div class="grid grid-cols-2 gap-2 text-xs text-gray-600">
                <div>Batch Size: {{ model.config.batchSize }}</div>
                <div>Learning Rate: {{ model.config.learningRate }}</div>
                <div>Max Length: {{ model.config.maxLength }}</div>
                <div>Train Split: {{ Math.round(model.config.trainFraction * 100) }}%</div>
              </div>
            </div>
          </div>

          <!-- Actions -->
          <div class="mt-6 flex space-x-2">
            <button
              v-if="store.activeModel?.id !== model.id && model.status === 'ready'"
              @click="activateModel(model.id)"
              class="flex-1 bg-blue-600 text-white px-3 py-2 rounded-md text-sm hover:bg-blue-700 transition-colors"
            >
              Activate
            </button>
            <router-link
              v-else-if="store.activeModel?.id === model.id"
              to="/chat"
              class="flex-1 bg-green-600 text-white px-3 py-2 rounded-md text-sm hover:bg-green-700 transition-colors text-center"
            >
              Start Chat
            </router-link>
            <button
              v-else
              disabled
              class="flex-1 bg-gray-300 text-gray-500 px-3 py-2 rounded-md text-sm cursor-not-allowed"
            >
              {{ model.status === 'training' ? 'Training...' : 'Unavailable' }}
            </button>
          </div>
        </div>
      </div>
    </div>

    <!-- Empty State -->
    <div v-else class="text-center py-12">
      <CubeIcon class="w-16 h-16 text-gray-400 mx-auto mb-4" />
      <h2 class="text-xl font-medium text-gray-900 mb-2">No Models Yet</h2>
      <p class="text-gray-600 mb-6">
        You haven't trained any models yet. Start by uploading training files and configuring your first model.
      </p>
      <router-link
        to="/training"
        class="bg-blue-600 text-white px-6 py-3 rounded-lg font-medium hover:bg-blue-700 transition-colors"
      >
        Train Your First Model
      </router-link>
    </div>

    <!-- Click outside to close dropdown -->
    <div
      v-if="activeDropdown"
      @click="activeDropdown = null"
      class="fixed inset-0 z-0"
    ></div>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { useAppStore } from '@/stores/app'
import { useToast } from 'vue-toastification'
import {
  CubeIcon,
  EllipsisVerticalIcon
} from '@heroicons/vue/24/outline'

const store = useAppStore()
const toast = useToast()

const activeDropdown = ref<string | null>(null)

const toggleDropdown = (modelId: string) => {
  activeDropdown.value = activeDropdown.value === modelId ? null : modelId
}

const activateModel = async (modelId: string) => {
  try {
    await store.setActiveModel(modelId)
    toast.success('Model activated successfully')
    activeDropdown.value = null
  } catch (error) {
    toast.error('Failed to activate model')
  }
}

const deleteModel = async (modelId: string) => {
  if (!confirm('Are you sure you want to delete this model? This action cannot be undone.')) {
    return
  }

  try {
    await store.deleteModel(modelId)
    toast.success('Model deleted successfully')
    activeDropdown.value = null
  } catch (error) {
    toast.error('Failed to delete model')
  }
}

const formatModelSize = (size: string): string => {
  const sizeMap: Record<string, string> = {
    'gpt2': 'GPT-2 Small (117M)',
    'gpt2-medium': 'GPT-2 Medium (345M)',
    'gpt2-large': 'GPT-2 Large (774M)',
    'gpt2-xl': 'GPT-2 XL (1.5B)'
  }
  return sizeMap[size] || size
}

const formatDate = (date: Date): string => {
  return new Date(date).toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric'
  })
}
</script>