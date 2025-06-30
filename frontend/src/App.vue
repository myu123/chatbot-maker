<template>
  <div id="app" class="min-h-screen bg-gray-50">
    <nav class="bg-white shadow-sm border-b">
      <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div class="flex justify-between h-16">
          <div class="flex">
            <router-link 
              to="/" 
              class="flex items-center px-4 text-xl font-bold text-gray-900 hover:text-blue-600"
            >
              🤖 Chatbot Maker
            </router-link>
          </div>
          <div class="flex space-x-8">
            <router-link 
              v-for="route in routes" 
              :key="route.path"
              :to="route.path"
              class="inline-flex items-center px-1 pt-1 text-sm font-medium border-b-2 transition-colors"
              :class="$route.path === route.path 
                ? 'border-blue-500 text-gray-900' 
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'"
            >
              <component :is="route.icon" class="w-4 h-4 mr-2" />
              {{ route.name }}
            </router-link>
          </div>
        </div>
      </div>
    </nav>

    <main class="max-w-7xl mx-auto py-6 px-4 sm:px-6 lg:px-8">
      <router-view />
    </main>
  </div>
</template>

<script setup lang="ts">
import { onMounted, onUnmounted } from 'vue'
import { useAppStore } from '@/stores/app'
import { 
  HomeIcon, 
  CogIcon, 
  ChatBubbleLeftRightIcon,
  CubeIcon 
} from '@heroicons/vue/24/outline'

const store = useAppStore()

const routes = [
  { path: '/', name: 'Home', icon: HomeIcon },
  { path: '/training', name: 'Training', icon: CogIcon },
  { path: '/chat', name: 'Chat', icon: ChatBubbleLeftRightIcon },
  { path: '/models', name: 'Models', icon: CubeIcon }
]

onMounted(() => {
  store.initializeSocket()
  store.loadFiles()
  store.loadModels()
  store.loadActiveModel()
})

onUnmounted(() => {
  store.cleanup()
})
</script>