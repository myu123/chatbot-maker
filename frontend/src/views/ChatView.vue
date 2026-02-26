<template>
  <div class="h-[calc(100vh-8rem)] flex flex-col">
    <!-- Header -->
    <div class="bg-white rounded-t-xl shadow-sm border border-slate-200 border-b-0 px-5 py-3">
      <div class="flex items-center justify-between">
        <div class="flex items-center space-x-3">
          <div class="w-9 h-9 rounded-full bg-indigo-100 flex items-center justify-center">
            <ChatBubbleLeftRightIcon class="w-5 h-5 text-indigo-600" />
          </div>
          <div>
            <h1 class="text-base font-semibold text-slate-900">Chat</h1>
            <div v-if="store.activeModel" class="text-xs text-slate-500">
              {{ store.activeModel.name }}
            </div>
          </div>
        </div>
        <div class="flex items-center space-x-2">
          <span
            v-if="store.activeModel"
            class="text-xs px-2 py-0.5 rounded-full font-medium"
            :class="chatServiceHealthy ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'"
          >
            {{ chatServiceHealthy ? 'Online' : 'Checking...' }}
          </span>
          <button
            @click="store.clearChat"
            class="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-md transition-colors"
            title="Clear conversation"
          >
            <TrashIcon class="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>

    <!-- No model -->
    <div v-if="!store.hasActiveModel" class="flex-1 flex items-center justify-center bg-white border border-slate-200 border-t-0 rounded-b-xl">
      <div class="text-center px-6">
        <CubeIcon class="w-14 h-14 text-slate-300 mx-auto mb-4" />
        <h2 class="text-lg font-semibold text-slate-900 mb-2">No Active Model</h2>
        <p class="text-slate-500 mb-6 max-w-sm mx-auto">
          Train a model or activate an existing one to start chatting.
        </p>
        <div class="flex justify-center gap-3">
          <router-link to="/training" class="btn-primary">Train Model</router-link>
          <router-link to="/models" class="btn-secondary">Select Model</router-link>
        </div>
      </div>
    </div>

    <!-- Chat interface -->
    <div v-else class="flex flex-col flex-1 bg-white border border-slate-200 border-t-0 rounded-b-xl overflow-hidden">
      <!-- Messages -->
      <div ref="messagesContainer" class="flex-1 overflow-y-auto p-4 space-y-3 chat-messages">
        <!-- Empty state -->
        <div v-if="store.chatMessages.length === 0" class="flex flex-col items-center justify-center h-full text-center">
          <div class="w-16 h-16 rounded-full bg-indigo-50 flex items-center justify-center mb-4">
            <SparklesIcon class="w-8 h-8 text-indigo-400" />
          </div>
          <p class="text-slate-500 font-medium">Start a conversation</p>
          <p class="text-sm text-slate-400 mt-1">Type a message below to chat with your trained model.</p>
        </div>

        <!-- Message bubbles -->
        <div
          v-for="message in store.chatMessages"
          :key="message.id"
          class="flex"
          :class="message.isUser ? 'justify-end' : 'justify-start'"
        >
          <!-- Bot avatar -->
          <div
            v-if="!message.isUser"
            class="flex-shrink-0 w-7 h-7 rounded-full bg-slate-200 flex items-center justify-center mr-2 mt-1"
          >
            <CpuChipIcon class="w-4 h-4 text-slate-600" />
          </div>

          <div
            class="max-w-[75%] px-4 py-2.5 rounded-2xl text-sm leading-relaxed"
            :class="message.isUser
              ? 'bg-indigo-600 text-white rounded-br-md'
              : 'bg-slate-100 text-slate-900 rounded-bl-md'"
          >
            <div class="whitespace-pre-wrap break-words">{{ message.content }}</div>
            <div
              class="text-[10px] mt-1 opacity-60"
              :class="message.isUser ? 'text-right' : 'text-left'"
            >
              {{ formatTime(message.timestamp) }}
            </div>
          </div>

          <!-- User avatar -->
          <div
            v-if="message.isUser"
            class="flex-shrink-0 w-7 h-7 rounded-full bg-indigo-600 flex items-center justify-center ml-2 mt-1"
          >
            <UserIcon class="w-4 h-4 text-white" />
          </div>
        </div>

        <!-- Typing indicator -->
        <div v-if="isTyping" class="flex justify-start">
          <div class="flex-shrink-0 w-7 h-7 rounded-full bg-slate-200 flex items-center justify-center mr-2">
            <CpuChipIcon class="w-4 h-4 text-slate-600" />
          </div>
          <div class="bg-slate-100 px-4 py-3 rounded-2xl rounded-bl-md">
            <div class="flex space-x-1.5">
              <span class="w-2 h-2 bg-slate-400 rounded-full animate-bounce" style="animation-delay: 0ms"></span>
              <span class="w-2 h-2 bg-slate-400 rounded-full animate-bounce" style="animation-delay: 150ms"></span>
              <span class="w-2 h-2 bg-slate-400 rounded-full animate-bounce" style="animation-delay: 300ms"></span>
            </div>
          </div>
        </div>
      </div>

      <!-- Input -->
      <div class="border-t border-slate-200 p-3 bg-slate-50">
        <form @submit.prevent="sendMessage" class="flex items-end gap-2">
          <div class="flex-1 relative">
            <textarea
              ref="messageInput"
              v-model="newMessage"
              @keydown.enter.exact.prevent="sendMessage"
              placeholder="Type a message..."
              rows="1"
              class="w-full resize-none border border-slate-300 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent disabled:bg-slate-100 disabled:text-slate-400"
              :disabled="isTyping"
              style="max-height: 120px"
              @input="autoResize"
            ></textarea>
          </div>
          <button
            type="submit"
            :disabled="!newMessage.trim() || isTyping"
            class="flex-shrink-0 w-10 h-10 rounded-xl bg-indigo-600 text-white flex items-center justify-center hover:bg-indigo-700 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
          >
            <PaperAirplaneIcon class="w-4 h-4" />
          </button>
        </form>
        <div class="text-[10px] text-slate-400 mt-1 text-center">
          Enter to send &middot; Responses are AI-generated and may not be accurate
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, nextTick, watch, onMounted } from 'vue'
import { useAppStore } from '@/stores/app'
import { useToast } from 'vue-toastification'
import { chatApi } from '@/services/api'
import {
  ChatBubbleLeftRightIcon,
  CubeIcon,
  TrashIcon,
  PaperAirplaneIcon,
  SparklesIcon,
  CpuChipIcon,
  UserIcon
} from '@heroicons/vue/24/outline'

const store = useAppStore()
const toast = useToast()

const newMessage = ref('')
const isTyping = ref(false)
const messagesContainer = ref<HTMLElement>()
const messageInput = ref<HTMLTextAreaElement>()
const chatServiceHealthy = ref(false)

onMounted(async () => {
  try {
    const model = await chatApi.getActiveModel()
    chatServiceHealthy.value = model !== null
  } catch {
    chatServiceHealthy.value = false
  }
})

const autoResize = (e: Event) => {
  const el = e.target as HTMLTextAreaElement
  el.style.height = 'auto'
  el.style.height = Math.min(el.scrollHeight, 120) + 'px'
}

const sendMessage = async () => {
  const text = newMessage.value.trim()
  if (!text) return

  newMessage.value = ''
  isTyping.value = true

  // Reset textarea height
  if (messageInput.value) {
    messageInput.value.style.height = 'auto'
  }

  try {
    await store.sendChatMessage(text)
  } catch {
    toast.error('Failed to get a response. Is the chat service running?')
  } finally {
    isTyping.value = false
    await nextTick()
    messageInput.value?.focus()
  }
}

const scrollToBottom = async () => {
  await nextTick()
  if (messagesContainer.value) {
    messagesContainer.value.scrollTo({
      top: messagesContainer.value.scrollHeight,
      behavior: 'smooth'
    })
  }
}

const formatTime = (date: Date): string => {
  return new Date(date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
}

watch(() => store.chatMessages.length, scrollToBottom)
</script>

<style scoped>
.btn-primary {
  @apply bg-indigo-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-indigo-700 transition-colors;
}
.btn-secondary {
  @apply bg-white text-slate-700 px-4 py-2 rounded-lg text-sm font-medium border border-slate-300 hover:bg-slate-50 transition-colors;
}
</style>
