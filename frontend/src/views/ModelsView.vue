<template>
  <div class="space-y-6">
    <div class="text-center">
      <h1 class="text-3xl font-bold text-slate-900 mb-2">Your Models</h1>
      <p class="text-slate-600">Manage, activate, and delete your trained models</p>
    </div>

    <!-- Models list -->
    <div v-if="store.models.length > 0" class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
      <div
        v-for="model in store.models"
        :key="model.id"
        class="bg-white rounded-xl shadow-sm border transition-all"
        :class="isActive(model.id)
          ? 'border-indigo-300 ring-2 ring-indigo-200'
          : 'border-slate-200 hover:shadow-md'"
      >
        <div class="p-5">
          <!-- Header -->
          <div class="flex items-start justify-between mb-3">
            <div class="flex items-center min-w-0">
              <div
                class="w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0 mr-3"
                :class="isActive(model.id) ? 'bg-indigo-100' : 'bg-slate-100'"
              >
                <CubeIcon class="w-5 h-5" :class="isActive(model.id) ? 'text-indigo-600' : 'text-slate-500'" />
              </div>
              <div class="min-w-0">
                <h3 class="text-sm font-semibold text-slate-900 truncate">{{ model.name }}</h3>
                <div class="text-xs text-slate-500">{{ formatDate(model.createdAt) }}</div>
              </div>
            </div>
            <span
              class="flex-shrink-0 text-[10px] font-semibold uppercase tracking-wide px-2 py-0.5 rounded-full"
              :class="{
                'bg-emerald-100 text-emerald-700': model.status === 'ready',
                'bg-amber-100 text-amber-700': model.status === 'training',
                'bg-red-100 text-red-700': model.status === 'error'
              }"
            >
              {{ model.status }}
            </span>
          </div>

          <!-- Active badge -->
          <div v-if="isActive(model.id)" class="mb-3">
            <span class="inline-flex items-center text-xs font-medium text-indigo-700 bg-indigo-50 px-2 py-0.5 rounded-full">
              <span class="w-1.5 h-1.5 rounded-full bg-indigo-500 mr-1.5"></span>
              Active
            </span>
          </div>

          <!-- Info grid -->
          <div class="grid grid-cols-2 gap-x-4 gap-y-2 text-xs mb-4">
            <div>
              <span class="text-slate-400">Model</span>
              <div class="font-medium text-slate-700">{{ formatModelSize(model.config.modelSize) }}</div>
            </div>
            <div>
              <span class="text-slate-400">Files</span>
              <div class="font-medium text-slate-700">{{ model.fileCount }}</div>
            </div>
            <div>
              <span class="text-slate-400">Epochs</span>
              <div class="font-medium text-slate-700">{{ model.config.epochs }}</div>
            </div>
            <div>
              <span class="text-slate-400">LR</span>
              <div class="font-medium text-slate-700 font-mono">{{ model.config.learningRate }}</div>
            </div>
          </div>

          <!-- Actions -->
          <div class="flex gap-2">
            <button
              v-if="!isActive(model.id) && model.status === 'ready'"
              @click="activateModel(model.id)"
              class="flex-1 bg-indigo-600 text-white py-2 rounded-lg text-xs font-medium hover:bg-indigo-700 transition-colors"
            >
              Activate
            </button>
            <router-link
              v-else-if="isActive(model.id)"
              to="/chat"
              class="flex-1 bg-emerald-600 text-white py-2 rounded-lg text-xs font-medium hover:bg-emerald-700 transition-colors text-center"
            >
              Start Chat
            </router-link>
            <button
              v-else
              disabled
              class="flex-1 bg-slate-100 text-slate-400 py-2 rounded-lg text-xs font-medium cursor-not-allowed"
            >
              {{ model.status === 'training' ? 'Training...' : 'Unavailable' }}
            </button>

            <button
              @click="deleteModel(model.id)"
              class="px-3 py-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
              title="Delete model"
            >
              <TrashIcon class="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>
    </div>

    <!-- Empty state -->
    <div v-else class="text-center py-16">
      <div class="w-16 h-16 rounded-full bg-slate-100 flex items-center justify-center mx-auto mb-5">
        <CubeIcon class="w-8 h-8 text-slate-400" />
      </div>
      <h2 class="text-lg font-semibold text-slate-900 mb-2">No Models Yet</h2>
      <p class="text-slate-500 mb-6 max-w-sm mx-auto">
        Upload some training files and train your first model to get started.
      </p>
      <router-link
        to="/training"
        class="inline-flex items-center bg-indigo-600 text-white px-5 py-2.5 rounded-xl font-medium hover:bg-indigo-700 transition-colors"
      >
        <CogIcon class="w-4 h-4 mr-2" />
        Train Your First Model
      </router-link>
    </div>
  </div>
</template>

<script setup lang="ts">
import { useAppStore } from '@/stores/app'
import { useToast } from 'vue-toastification'
import {
  CubeIcon,
  TrashIcon,
  CogIcon
} from '@heroicons/vue/24/outline'

const store = useAppStore()
const toast = useToast()

const isActive = (modelId: string) => store.activeModel?.id === modelId

const activateModel = async (modelId: string) => {
  try {
    await store.setActiveModel(modelId)
    toast.success('Model activated')
  } catch {
    toast.error('Failed to activate model')
  }
}

const deleteModel = async (modelId: string) => {
  if (!confirm('Delete this model? This cannot be undone.')) return

  try {
    await store.deleteModel(modelId)
    toast.success('Model deleted')
  } catch {
    toast.error('Failed to delete model')
  }
}

const formatModelSize = (size: string): string => {
  const map: Record<string, string> = {
    'gpt2': 'GPT-2 (117M)',
    'gpt2-medium': 'Medium (345M)',
    'gpt2-large': 'Large (774M)',
    'gpt2-xl': 'XL (1.5B)'
  }
  return map[size] || size
}

const formatDate = (date: Date): string => {
  return new Date(date).toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric'
  })
}
</script>
