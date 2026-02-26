import { io, Socket } from 'socket.io-client'

class SocketService {
  private socket: Socket | null = null

  connect(): Socket {
    if (!this.socket) {
      this.socket = io('/', {
        transports: ['websocket', 'polling'],
        reconnection: true,
        reconnectionAttempts: 10,
        reconnectionDelay: 1000,
        reconnectionDelayMax: 5000
      })

      this.socket.on('connect', () => {
        console.debug('[socket] connected:', this.socket?.id)
      })

      this.socket.on('disconnect', (reason) => {
        console.debug('[socket] disconnected:', reason)
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

  onTrainingProgress(callback: (data: Record<string, unknown>) => void) {
    this.socket?.on('training-progress', callback)
  }

  onTrainingComplete(callback: (result: Record<string, unknown>) => void) {
    this.socket?.on('training-complete', callback)
  }

  onTrainingError(callback: (error: Record<string, unknown> | string) => void) {
    this.socket?.on('training-error', callback)
  }

  subscribeToTraining(jobId: string) {
    this.socket?.emit('subscribe-training', jobId)
  }

  unsubscribeFromTraining(jobId: string) {
    this.socket?.emit('unsubscribe-training', jobId)
  }
}

export const socketService = new SocketService()
export default socketService
