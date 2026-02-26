<template>
  <div id="app" class="min-h-screen bg-slate-50">
    <!-- Navigation -->
    <nav class="bg-white shadow-sm border-b border-slate-200 sticky top-0 z-40">
      <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div class="flex justify-between h-16">
          <!-- Logo -->
          <div class="flex">
            <router-link
              to="/"
              class="flex items-center px-2 text-lg font-bold text-slate-900 hover:text-indigo-600 transition-colors"
            >
              <CpuChipIcon class="w-6 h-6 mr-2 text-indigo-600" />
              Chatbot Maker
            </router-link>
          </div>

          <!-- Nav links -->
          <div class="hidden sm:flex space-x-1">
            <router-link
              v-for="route in routes"
              :key="route.path"
              :to="route.path"
              class="inline-flex items-center px-3 py-2 text-sm font-medium rounded-md transition-colors"
              :class="
                $route.path === route.path
                  ? 'bg-indigo-50 text-indigo-700'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
              "
            >
              <component :is="route.icon" class="w-4 h-4 mr-1.5" />
              {{ route.name }}
            </router-link>
          </div>

          <!-- Mobile nav -->
          <div class="sm:hidden flex items-center">
            <button
              @click="mobileMenuOpen = !mobileMenuOpen"
              class="p-2 rounded-md text-slate-600 hover:text-slate-900 hover:bg-slate-100"
            >
              <Bars3Icon v-if="!mobileMenuOpen" class="w-6 h-6" />
              <XMarkIcon v-else class="w-6 h-6" />
            </button>
          </div>
        </div>
      </div>

      <!-- Mobile menu -->
      <div v-if="mobileMenuOpen" class="sm:hidden border-t border-slate-200 bg-white">
        <div class="px-2 pt-2 pb-3 space-y-1">
          <router-link
            v-for="route in routes"
            :key="route.path"
            :to="route.path"
            @click="mobileMenuOpen = false"
            class="flex items-center px-3 py-2 text-sm font-medium rounded-md"
            :class="
              $route.path === route.path
                ? 'bg-indigo-50 text-indigo-700'
                : 'text-slate-600 hover:bg-slate-100'
            "
          >
            <component :is="route.icon" class="w-4 h-4 mr-2" />
            {{ route.name }}
          </router-link>
        </div>
      </div>
    </nav>

    <!-- Page content -->
    <main class="max-w-7xl mx-auto py-6 px-4 sm:px-6 lg:px-8">
      <router-view v-slot="{ Component }">
        <transition name="fade" mode="out-in">
          <component :is="Component" />
        </transition>
      </router-view>
    </main>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, onUnmounted } from 'vue'
import { useAppStore } from '@/stores/app'
import {
  HomeIcon,
  CogIcon,
  ChatBubbleLeftRightIcon,
  CubeIcon,
  CpuChipIcon,
  Bars3Icon,
  XMarkIcon
} from '@heroicons/vue/24/outline'

const store = useAppStore()
const mobileMenuOpen = ref(false)

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
