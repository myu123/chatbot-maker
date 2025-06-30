import { createRouter, createWebHistory } from 'vue-router'
import HomeView from '@/views/HomeView.vue'
import TrainingView from '@/views/TrainingView.vue'
import ChatView from '@/views/ChatView.vue'
import ModelsView from '@/views/ModelsView.vue'

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes: [
    {
      path: '/',
      name: 'home',
      component: HomeView
    },
    {
      path: '/training',
      name: 'training',
      component: TrainingView
    },
    {
      path: '/chat',
      name: 'chat',
      component: ChatView
    },
    {
      path: '/models',
      name: 'models',
      component: ModelsView
    }
  ]
})

export default router