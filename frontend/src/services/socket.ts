import { io, Socket } from 'socket.io-client'
import type { TrainingStatus } from '@/types'

class SocketService {
  private socket: Socket | null = null

  connect() {
    if (!this.socket) {
      this.socket = io('/', {
        transports: ['websocket', 'polling']
      })
    }
    return this.socket
  }

  disconnect() {
    if (this.socket) {
      this.socket.disconnect()
      this.socket = null
    }
  }

  onTrainingProgress(callback: (status: TrainingStatus) => void) {
    if (this.socket) {
      this.socket.on('training-progress', callback)
    }
  }

  onTrainingComplete(callback: (result: any) => void) {
    if (this.socket) {
      this.socket.on('training-complete', callback)
    }
  }

  onTrainingError(callback: (error: string) => void) {
    if (this.socket) {
      this.socket.on('training-error', callback)
    }
  }

  subscribeToTraining(jobId: string) {
    if (this.socket) {
      this.socket.emit('subscribe-training', jobId)
    }
  }

  unsubscribeFromTraining(jobId: string) {
    if (this.socket) {
      this.socket.emit('unsubscribe-training', jobId)
    }
  }
}

export const socketService = new SocketService()
export default socketService