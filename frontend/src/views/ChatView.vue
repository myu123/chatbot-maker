<template>
  <div class="h-[calc(100vh-12rem)] flex flex-col">
    <!-- Header -->
    <div class="bg-white rounded-t-lg shadow border-b p-4">
      <div class="flex items-center justify-between">
        <div class="flex items-center">
          <ChatBubbleLeftRightIcon class="w-6 h-6 text-blue-600 mr-2" />
          <h1 class="text-xl font-semibold text-gray-900">
            Chat with Your Bot
          </h1>
        </div>
        <div class="flex items-center space-x-4">
          <div v-if="store.activeModel" class="text-sm text-gray-600">
            Active: {{ store.activeModel.name }}
          </div>
          <button
            @click="store.clearChat"
            class="text-gray-600 hover:text-gray-800 p-2"
            title="Clear chat"
          >
            <TrashIcon class="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>

    <!-- No Active Model Message -->
    <div v-if="!store.hasActiveModel" class="flex-1 flex items-center justify-center bg-white rounded-b-lg shadow">
      <div class="text-center">
        <CubeIcon class="w-16 h-16 text-gray-400 mx-auto mb-4" />
        <h2 class="text-xl font-medium text-gray-900 mb-2">No Active Model</h2>
        <p class="text-gray-600 mb-4">
          You need to train a model or select an existing one to start chatting.
        </p>
        <div class="space-x-4">
          <router-link
            to="/training"
            class="bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700 transition-colors"
          >
            Train New Model
          </router-link>
          <router-link
            to="/models"
            class="bg-gray-600 text-white px-4 py-2 rounded-md hover:bg-gray-700 transition-colors"
          >
            Select Model
          </router-link>
        </div>
      </div>
    </div>

    <!-- Chat Interface -->
    <div v-else class="flex flex-col flex-1 bg-white rounded-b-lg shadow">
      <!-- Messages Container -->
      <div ref="messagesContainer" class="flex-1 overflow-y-auto p-4 space-y-4">
        <div v-if="store.chatMessages.length === 0" class="text-center text-gray-500 mt-8">
          Start a conversation with your chatbot!
        </div>
        
        <div
          v-for="message in store.chatMessages"
          :key="message.id"
          class="flex"
          :class="message.isUser ? 'justify-end' : 'justify-start'"
        >
          <div
            class="max-w-xs lg:max-w-md px-4 py-2 rounded-lg"
            :class="message.isUser 
              ? 'bg-blue-600 text-white' 
              : 'bg-gray-200 text-gray-900'"
          >
            <div class="whitespace-pre-wrap">{{ message.content }}</div>
            <div 
              class="text-xs mt-1 opacity-75"
              :class="message.isUser ? 'text-blue-100' : 'text-gray-500'"
            >
              {{ formatTime(message.timestamp) }}
            </div>
          </div>
        </div>

        <!-- Typing indicator -->
        <div v-if="isTyping" class="flex justify-start">
          <div class="bg-gray-200 text-gray-900 px-4 py-2 rounded-lg">
            <div class="flex space-x-1">
              <div class="w-2 h-2 bg-gray-400 rounded-full animate-bounce"></div>
              <div class="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style="animation-delay: 0.1s"></div>
              <div class="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style="animation-delay: 0.2s"></div>
            </div>
          </div>
        </div>
      </div>

      <!-- Input Area -->
      <div class="border-t p-4">
        <form @submit.prevent="sendMessage" class="flex space-x-2">
          <input
            v-model="newMessage"
            type="text"
            placeholder="Type your message..."
            class="flex-1 border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
            :disabled="isTyping"
          >
          <button
            type="submit"
            :disabled="!newMessage.trim() || isTyping"
            class="bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <PaperAirplaneIcon class="w-4 h-4" />
          </button>
        </form>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, nextTick, watch } from 'vue'
import { useAppStore } from '@/stores/app'
import { useToast } from 'vue-toastification'
import {
  ChatBubbleLeftRightIcon,
  CubeIcon,
  TrashIcon,
  PaperAirplaneIcon
} from '@heroicons/vue/24/outline'

const store = useAppStore()
const toast = useToast()

const newMessage = ref('')
const isTyping = ref(false)
const messagesContainer = ref<HTMLElement>()

const sendMessage = async () => {
  if (!newMessage.value.trim()) return

  const message = newMessage.value.trim()
  newMessage.value = ''
  isTyping.value = true

  try {
    await store.sendChatMessage(message)
    scrollToBottom()
  } catch (error) {
    toast.error('Failed to send message')
  } finally {
    isTyping.value = false
  }
}

const scrollToBottom = async () => {
  await nextTick()
  if (messagesContainer.value) {
    messagesContainer.value.scrollTop = messagesContainer.value.scrollHeight
  }
}

const formatTime = (date: Date): string => {
  return new Date(date).toLocaleTimeString([], { 
    hour: '2-digit', 
    minute: '2-digit' 
  })
}

// Auto-scroll when new messages arrive
watch(() => store.chatMessages.length, () => {
  scrollToBottom()
})
</script>