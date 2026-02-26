<template>
  <div class="space-y-8">
    <!-- Hero -->
    <div class="text-center py-4">
      <h1 class="text-4xl font-bold text-slate-900 mb-3">
        Train Your Own AI Chatbot
      </h1>
      <p class="text-lg text-slate-600 max-w-2xl mx-auto leading-relaxed">
        Upload your documents, fine-tune a GPT-2 model on your data, and chat with your personalized AI assistant.
      </p>
    </div>

    <!-- Stats cards -->
    <div class="grid grid-cols-2 md:grid-cols-4 gap-4">
      <div class="bg-white rounded-xl shadow-sm border border-slate-200 p-5">
        <div class="flex items-center justify-between mb-3">
          <DocumentIcon class="w-5 h-5 text-indigo-500" />
          <span class="text-xs font-medium text-slate-400 uppercase tracking-wide">Files</span>
        </div>
        <div class="text-2xl font-bold text-slate-900">{{ store.totalFiles }}</div>
        <div class="text-sm text-slate-500 mt-1">{{ formatFileSize(store.totalFileSize) }} total</div>
      </div>

      <div class="bg-white rounded-xl shadow-sm border border-slate-200 p-5">
        <div class="flex items-center justify-between mb-3">
          <CubeIcon class="w-5 h-5 text-emerald-500" />
          <span class="text-xs font-medium text-slate-400 uppercase tracking-wide">Models</span>
        </div>
        <div class="text-2xl font-bold text-slate-900">{{ store.models.length }}</div>
        <div class="text-sm text-slate-500 mt-1">trained models</div>
      </div>

      <div class="bg-white rounded-xl shadow-sm border border-slate-200 p-5">
        <div class="flex items-center justify-between mb-3">
          <BoltIcon class="w-5 h-5 text-amber-500" />
          <span class="text-xs font-medium text-slate-400 uppercase tracking-wide">Status</span>
        </div>
        <div class="text-2xl font-bold text-slate-900">
          {{ store.trainingStatus.isTraining ? 'Training' : 'Idle' }}
        </div>
        <div class="text-sm text-slate-500 mt-1">
          {{ store.trainingStatus.isTraining ? Math.round(store.trainingStatus.progress) + '%' : 'ready to train' }}
        </div>
      </div>

      <div class="bg-white rounded-xl shadow-sm border border-slate-200 p-5">
        <div class="flex items-center justify-between mb-3">
          <ChatBubbleLeftRightIcon class="w-5 h-5 text-sky-500" />
          <span class="text-xs font-medium text-slate-400 uppercase tracking-wide">Chat</span>
        </div>
        <div class="text-2xl font-bold" :class="store.hasActiveModel ? 'text-emerald-600' : 'text-slate-400'">
          {{ store.hasActiveModel ? 'Ready' : 'None' }}
        </div>
        <div class="text-sm text-slate-500 mt-1">
          {{ store.activeModel?.name || 'no active model' }}
        </div>
      </div>
    </div>

    <!-- Getting started / Quick actions -->
    <div class="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
      <div class="px-6 py-4 border-b border-slate-100">
        <h2 class="text-lg font-semibold text-slate-900">
          {{ store.models.length === 0 ? 'Get Started' : 'Quick Actions' }}
        </h2>
      </div>
      <div class="p-6">
        <!-- Step-by-step guide for new users -->
        <div v-if="store.models.length === 0" class="space-y-4 mb-6">
          <div class="flex items-start space-x-4 p-4 rounded-lg bg-indigo-50 border border-indigo-100">
            <div class="flex-shrink-0 w-8 h-8 rounded-full bg-indigo-600 text-white flex items-center justify-center text-sm font-bold">1</div>
            <div>
              <div class="font-medium text-indigo-900">Upload your training documents</div>
              <div class="text-sm text-indigo-700 mt-0.5">Drag & drop .txt or .pdf files on the Training page. More data = better results.</div>
            </div>
          </div>
          <div class="flex items-start space-x-4 p-4 rounded-lg bg-slate-50 border border-slate-200">
            <div class="flex-shrink-0 w-8 h-8 rounded-full bg-slate-400 text-white flex items-center justify-center text-sm font-bold">2</div>
            <div>
              <div class="font-medium text-slate-700">Configure and train</div>
              <div class="text-sm text-slate-500 mt-0.5">Pick a model size, set parameters, and hit Start Training. You'll see live progress.</div>
            </div>
          </div>
          <div class="flex items-start space-x-4 p-4 rounded-lg bg-slate-50 border border-slate-200">
            <div class="flex-shrink-0 w-8 h-8 rounded-full bg-slate-400 text-white flex items-center justify-center text-sm font-bold">3</div>
            <div>
              <div class="font-medium text-slate-700">Chat with your bot</div>
              <div class="text-sm text-slate-500 mt-0.5">Once training completes, activate the model and start chatting!</div>
            </div>
          </div>
        </div>

        <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
          <router-link
            to="/training"
            class="group flex items-center p-4 rounded-xl border-2 border-dashed border-slate-200 hover:border-indigo-400 hover:bg-indigo-50/50 transition-all"
          >
            <CogIcon class="w-8 h-8 text-slate-400 group-hover:text-indigo-600 mr-3 transition-colors" />
            <div>
              <div class="font-medium text-slate-900 group-hover:text-indigo-700">Start Training</div>
              <div class="text-sm text-slate-500">Upload files & train a model</div>
            </div>
          </router-link>

          <router-link
            to="/chat"
            class="group flex items-center p-4 rounded-xl border-2 border-dashed border-slate-200 hover:border-emerald-400 hover:bg-emerald-50/50 transition-all"
            :class="!store.hasActiveModel && 'opacity-50 pointer-events-none'"
          >
            <ChatBubbleLeftRightIcon class="w-8 h-8 text-slate-400 group-hover:text-emerald-600 mr-3 transition-colors" />
            <div>
              <div class="font-medium text-slate-900 group-hover:text-emerald-700">Chat</div>
              <div class="text-sm text-slate-500">
                {{ store.hasActiveModel ? 'Talk to your chatbot' : 'Activate a model first' }}
              </div>
            </div>
          </router-link>

          <router-link
            to="/models"
            class="group flex items-center p-4 rounded-xl border-2 border-dashed border-slate-200 hover:border-violet-400 hover:bg-violet-50/50 transition-all"
          >
            <CubeIcon class="w-8 h-8 text-slate-400 group-hover:text-violet-600 mr-3 transition-colors" />
            <div>
              <div class="font-medium text-slate-900 group-hover:text-violet-700">Models</div>
              <div class="text-sm text-slate-500">Manage trained models</div>
            </div>
          </router-link>
        </div>
      </div>
    </div>

    <!-- Live training banner -->
    <div v-if="store.trainingStatus.isTraining" class="bg-indigo-50 border border-indigo-200 rounded-xl p-6">
      <div class="flex items-center mb-3">
        <div class="relative w-3 h-3 mr-3">
          <span class="absolute inset-0 rounded-full bg-indigo-500 animate-ping opacity-75"></span>
          <span class="relative block w-3 h-3 rounded-full bg-indigo-600"></span>
        </div>
        <h3 class="text-lg font-semibold text-indigo-900">Training in Progress</h3>
      </div>
      <div class="space-y-2">
        <div class="flex justify-between text-sm text-indigo-700">
          <span>Epoch {{ store.trainingStatus.currentEpoch }} / {{ store.trainingStatus.totalEpochs }}</span>
          <span>{{ Math.round(store.trainingStatus.progress) }}%</span>
        </div>
        <div class="w-full bg-indigo-200 rounded-full h-2 overflow-hidden">
          <div
            class="bg-indigo-600 h-full rounded-full transition-all duration-500 ease-out"
            :style="{ width: `${store.trainingStatus.progress}%` }"
          ></div>
        </div>
        <div class="flex justify-between text-xs text-indigo-600">
          <span v-if="store.trainingStatus.loss">Loss: {{ store.trainingStatus.loss.toFixed(4) }}</span>
          <span v-if="store.trainingStatus.estimatedTimeRemaining">
            ETA: {{ formatTime(store.trainingStatus.estimatedTimeRemaining) }}
          </span>
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
  ChatBubbleLeftRightIcon,
  CogIcon,
  BoltIcon
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
  const h = Math.floor(seconds / 3600)
  const m = Math.floor((seconds % 3600) / 60)
  const s = Math.floor(seconds % 60)
  if (h > 0) return `${h}h ${m}m`
  if (m > 0) return `${m}m ${s}s`
  return `${s}s`
}
</script>
