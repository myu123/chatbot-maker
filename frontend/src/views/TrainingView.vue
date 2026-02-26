<template>
  <div class="space-y-6">
    <div class="text-center">
      <h1 class="text-3xl font-bold text-slate-900 mb-2">Train Your Chatbot</h1>
      <p class="text-slate-600">Upload training data and configure your model</p>
    </div>

    <!-- File Upload Section -->
    <div class="bg-white rounded-xl shadow-sm border border-slate-200">
      <div class="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
        <h2 class="text-base font-semibold text-slate-900">Training Files</h2>
        <span v-if="store.files.length > 0" class="text-xs text-slate-500">
          {{ store.files.length }} file{{ store.files.length !== 1 ? 's' : '' }} &middot; {{ formatFileSize(totalSize) }}
        </span>
      </div>
      <div class="p-6">
        <!-- Drop zone -->
        <div
          class="border-2 border-dashed rounded-xl p-8 text-center transition-all cursor-pointer"
          :class="isDragging
            ? 'border-indigo-400 bg-indigo-50'
            : 'border-slate-300 hover:border-indigo-400 hover:bg-indigo-50/30'"
          @drop="handleDrop"
          @dragover.prevent
          @dragenter.prevent="isDragging = true"
          @dragleave.prevent="isDragging = false"
          @click="($refs.fileInput as HTMLInputElement).click()"
        >
          <CloudArrowUpIcon class="w-10 h-10 text-slate-400 mx-auto mb-3" />
          <p class="font-medium text-slate-700 mb-1">
            {{ isDragging ? 'Drop files here' : 'Click or drag files to upload' }}
          </p>
          <p class="text-sm text-slate-500">Supports .txt and .pdf &middot; Up to 50 MB each</p>
          <input
            ref="fileInput"
            type="file"
            multiple
            accept=".txt,.pdf"
            @change="handleFileSelect"
            class="hidden"
          >
        </div>

        <!-- File list -->
        <div v-if="store.files.length > 0" class="mt-4 space-y-2">
          <div
            v-for="file in store.files"
            :key="file.id"
            class="flex items-center justify-between p-3 bg-slate-50 rounded-lg group hover:bg-slate-100 transition-colors"
          >
            <div class="flex items-center min-w-0">
              <DocumentTextIcon class="w-5 h-5 text-slate-400 flex-shrink-0 mr-3" />
              <div class="min-w-0">
                <div class="text-sm font-medium text-slate-900 truncate">{{ file.name }}</div>
                <div class="text-xs text-slate-500">
                  {{ formatFileSize(file.size) }} &middot; {{ formatDate(file.uploadedAt) }}
                </div>
              </div>
            </div>
            <button
              @click.stop="deleteFile(file.id)"
              class="p-1 text-slate-400 hover:text-red-600 opacity-0 group-hover:opacity-100 transition-all"
              title="Remove file"
            >
              <XMarkIcon class="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>
    </div>

    <!-- Training Configuration -->
    <div class="bg-white rounded-xl shadow-sm border border-slate-200">
      <div class="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
        <h2 class="text-base font-semibold text-slate-900">Configuration</h2>
        <!-- Presets -->
        <div class="flex gap-1">
          <button
            v-for="preset in presets"
            :key="preset.label"
            @click="applyPreset(preset)"
            class="text-xs px-2.5 py-1 rounded-md font-medium transition-colors"
            :class="activePreset === preset.label
              ? 'bg-indigo-100 text-indigo-700'
              : 'text-slate-500 hover:bg-slate-100 hover:text-slate-700'"
          >
            {{ preset.label }}
          </button>
        </div>
      </div>
      <div class="p-6">
        <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          <!-- Model Size -->
          <div>
            <label class="block text-sm font-medium text-slate-700 mb-1.5">Model Size</label>
            <select
              v-model="config.modelSize"
              class="input-field"
            >
              <option value="gpt2">GPT-2 Small (117M) - Fast</option>
              <option value="gpt2-medium">GPT-2 Medium (345M)</option>
              <option value="gpt2-large">GPT-2 Large (774M)</option>
              <option value="gpt2-xl">GPT-2 XL (1.5B) - Best quality</option>
            </select>
            <p class="text-xs text-slate-400 mt-1">Larger models need more RAM/VRAM</p>
          </div>

          <!-- Epochs -->
          <div>
            <label class="block text-sm font-medium text-slate-700 mb-1.5">Epochs</label>
            <input
              v-model.number="config.epochs"
              type="number" min="1" max="1000"
              class="input-field"
            >
            <p class="text-xs text-slate-400 mt-1">More epochs = better fit, risk of overfitting</p>
          </div>

          <!-- Batch Size -->
          <div>
            <label class="block text-sm font-medium text-slate-700 mb-1.5">Batch Size</label>
            <input
              v-model.number="config.batchSize"
              type="number" min="1" max="32"
              class="input-field"
            >
            <p class="text-xs text-slate-400 mt-1">Lower if you run out of memory</p>
          </div>

          <!-- Learning Rate -->
          <div>
            <label class="block text-sm font-medium text-slate-700 mb-1.5">Learning Rate</label>
            <input
              v-model.number="config.learningRate"
              type="number" step="0.00001" min="0.00001" max="0.1"
              class="input-field"
            >
            <p class="text-xs text-slate-400 mt-1">5e-5 is a good default for fine-tuning</p>
          </div>

          <!-- Max Length -->
          <div>
            <label class="block text-sm font-medium text-slate-700 mb-1.5">Max Response Length</label>
            <input
              v-model.number="config.maxLength"
              type="number" min="50" max="1000"
              class="input-field"
            >
            <p class="text-xs text-slate-400 mt-1">Max tokens per response (50-1000)</p>
          </div>

          <!-- Train Split -->
          <div>
            <label class="block text-sm font-medium text-slate-700 mb-1.5">
              Train Split: {{ Math.round(config.trainFraction * 100) }}%
            </label>
            <input
              v-model.number="config.trainFraction"
              type="range" step="0.05" min="0.5" max="0.95"
              class="w-full accent-indigo-600"
            >
            <p class="text-xs text-slate-400 mt-1">
              {{ Math.round(config.trainFraction * 100) }}% train / {{ Math.round((1 - config.trainFraction) * 100) }}% validation
            </p>
          </div>
        </div>
      </div>
    </div>

    <!-- Training Progress -->
    <div v-if="store.trainingStatus.isTraining" class="bg-indigo-50 border border-indigo-200 rounded-xl p-6">
      <div class="flex items-center justify-between mb-4">
        <div class="flex items-center">
          <div class="relative w-3 h-3 mr-3">
            <span class="absolute inset-0 rounded-full bg-indigo-500 animate-ping opacity-75"></span>
            <span class="relative block w-3 h-3 rounded-full bg-indigo-600"></span>
          </div>
          <h3 class="text-lg font-semibold text-indigo-900">Training in Progress</h3>
        </div>
        <button
          @click="stopTraining"
          class="text-sm bg-white text-red-600 border border-red-200 px-4 py-1.5 rounded-lg hover:bg-red-50 transition-colors font-medium"
        >
          Stop
        </button>
      </div>

      <div class="space-y-3">
        <div class="flex justify-between text-sm font-medium text-indigo-700">
          <span>Epoch {{ store.trainingStatus.currentEpoch }} / {{ store.trainingStatus.totalEpochs }}</span>
          <span>{{ Math.round(store.trainingStatus.progress) }}%</span>
        </div>
        <div class="w-full bg-indigo-200 rounded-full h-2.5 overflow-hidden">
          <div
            class="bg-indigo-600 h-full rounded-full transition-all duration-500 ease-out"
            :style="{ width: `${store.trainingStatus.progress}%` }"
          ></div>
        </div>
        <div class="grid grid-cols-2 gap-4 text-sm text-indigo-600">
          <div v-if="store.trainingStatus.loss">
            Loss: <span class="font-mono">{{ store.trainingStatus.loss.toFixed(4) }}</span>
          </div>
          <div v-if="store.trainingStatus.estimatedTimeRemaining" class="text-right">
            ETA: {{ formatTime(store.trainingStatus.estimatedTimeRemaining) }}
          </div>
        </div>
      </div>
    </div>

    <!-- Completed / Error banners -->
    <div v-else-if="store.trainingStatus.status === 'completed'" class="bg-emerald-50 border border-emerald-200 rounded-xl p-5 flex items-center">
      <CheckCircleIcon class="w-6 h-6 text-emerald-600 mr-3 flex-shrink-0" />
      <div>
        <div class="font-medium text-emerald-900">Training Complete</div>
        <div class="text-sm text-emerald-700">Your model is ready. Go to Models to activate it, then start chatting.</div>
      </div>
    </div>

    <div v-else-if="store.trainingStatus.status === 'error'" class="bg-red-50 border border-red-200 rounded-xl p-5 flex items-center">
      <ExclamationTriangleIcon class="w-6 h-6 text-red-600 mr-3 flex-shrink-0" />
      <div>
        <div class="font-medium text-red-900">Training Failed</div>
        <div class="text-sm text-red-700">{{ store.trainingStatus.error || 'An unexpected error occurred.' }}</div>
      </div>
    </div>

    <!-- Start button -->
    <div class="text-center pb-4">
      <button
        @click="startTraining"
        :disabled="!store.canStartTraining"
        class="bg-indigo-600 text-white px-8 py-3 rounded-xl font-semibold hover:bg-indigo-700 transition-colors disabled:opacity-40 disabled:cursor-not-allowed shadow-sm"
      >
        {{ store.trainingStatus.isTraining ? 'Training...' : 'Start Training' }}
      </button>
      <p v-if="!store.hasFiles" class="text-sm text-slate-400 mt-2">
        Upload at least one file to get started
      </p>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, computed } from 'vue'
import { useAppStore } from '@/stores/app'
import { useToast } from 'vue-toastification'
import { trainingApi } from '@/services/api'
import socketService from '@/services/socket'
import type { TrainingConfig } from '@/types'
import {
  CloudArrowUpIcon,
  DocumentTextIcon,
  XMarkIcon,
  CheckCircleIcon,
  ExclamationTriangleIcon
} from '@heroicons/vue/24/outline'

const store = useAppStore()
const toast = useToast()

const isDragging = ref(false)
const currentJobId = ref<string | null>(null)
const activePreset = ref('Default')

const config = reactive<TrainingConfig>({
  modelSize: 'gpt2',
  epochs: 3,
  batchSize: 4,
  learningRate: 0.00005,
  maxLength: 150,
  trainFraction: 0.8
})

const presets = [
  { label: 'Quick', modelSize: 'gpt2' as const, epochs: 1, batchSize: 4, learningRate: 0.0001, maxLength: 100, trainFraction: 0.8 },
  { label: 'Default', modelSize: 'gpt2' as const, epochs: 3, batchSize: 4, learningRate: 0.00005, maxLength: 150, trainFraction: 0.8 },
  { label: 'Quality', modelSize: 'gpt2-medium' as const, epochs: 5, batchSize: 2, learningRate: 0.00003, maxLength: 200, trainFraction: 0.85 },
  { label: 'Best', modelSize: 'gpt2-large' as const, epochs: 8, batchSize: 1, learningRate: 0.00002, maxLength: 256, trainFraction: 0.9 }
]

const applyPreset = (preset: typeof presets[number]) => {
  config.modelSize = preset.modelSize
  config.epochs = preset.epochs
  config.batchSize = preset.batchSize
  config.learningRate = preset.learningRate
  config.maxLength = preset.maxLength
  config.trainFraction = preset.trainFraction
  activePreset.value = preset.label
}

const totalSize = computed(() => store.files.reduce((s, f) => s + f.size, 0))

// ---- File handling ----

const handleDrop = async (e: DragEvent) => {
  e.preventDefault()
  isDragging.value = false
  await uploadFiles(Array.from(e.dataTransfer?.files || []))
}

const handleFileSelect = async (e: Event) => {
  const target = e.target as HTMLInputElement
  if (target.files) {
    await uploadFiles(Array.from(target.files))
    target.value = '' // allow re-selecting same file
  }
}

const uploadFiles = async (files: File[]) => {
  const valid = files.filter(f => f.type === 'text/plain' || f.type === 'application/pdf')

  if (valid.length < files.length) {
    toast.warning('Some files were skipped (only .txt and .pdf are supported)')
  }
  if (valid.length === 0) {
    toast.error('No valid files selected')
    return
  }

  try {
    await store.uploadFiles(valid)
    toast.success(`Uploaded ${valid.length} file${valid.length > 1 ? 's' : ''}`)
  } catch {
    toast.error('Upload failed — please try again')
  }
}

const deleteFile = async (fileId: string) => {
  try {
    await store.deleteFile(fileId)
    toast.success('File removed')
  } catch {
    toast.error('Failed to delete file')
  }
}

// ---- Training ----

const startTraining = async () => {
  try {
    currentJobId.value = await trainingApi.startTraining(config)
    socketService.subscribeToTraining(currentJobId.value)
    toast.success('Training started')
  } catch {
    toast.error('Failed to start training')
  }
}

const stopTraining = async () => {
  if (!currentJobId.value) return
  try {
    await trainingApi.stopTraining(currentJobId.value)
    socketService.unsubscribeFromTraining(currentJobId.value)
    toast.info('Training stopped')
  } catch {
    toast.error('Failed to stop training')
  }
}

// ---- Formatting ----

const formatFileSize = (bytes: number): string => {
  if (bytes === 0) return '0 B'
  const k = 1024
  const sizes = ['B', 'KB', 'MB', 'GB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i]
}

const formatDate = (date: Date): string => new Date(date).toLocaleDateString()

const formatTime = (seconds: number): string => {
  const h = Math.floor(seconds / 3600)
  const m = Math.floor((seconds % 3600) / 60)
  const s = Math.floor(seconds % 60)
  if (h > 0) return `${h}h ${m}m`
  if (m > 0) return `${m}m ${s}s`
  return `${s}s`
}
</script>

<style scoped>
.input-field {
  @apply w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent bg-white;
}
</style>
