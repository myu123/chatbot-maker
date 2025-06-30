# Chatbot Maker

A comprehensive full-stack application for training and chatting with custom GPT-2 chatbots using your own documents. Built with Vue.js, TypeScript, Node.js, and Python.
![home_page](https://github.com/user-attachments/assets/9bad6641-ee2d-46d5-8b89-7f7d2efd3679)
![train_page](https://github.com/user-attachments/assets/e29eb687-32cc-46d1-a6bc-5dcc9781f4e8)

## Features

### AI Training
- **Multiple GPT-2 Models**: Support for GPT-2, GPT-2 Medium, GPT-2 Large, and GPT-2 XL
- **Document Support**: Upload and train on .txt and .pdf files
- **Real-time Progress**: Live training progress with WebSocket updates
- **Advanced Configuration**: Customizable epochs, batch size, learning rate, and more

### Smart Interface
- **Modern Web UI**: Clean, responsive Vue.js interface with TypeScript
- **Drag & Drop Upload**: Easy file management with visual feedback
- **Model Management**: Save, load, and switch between trained models
- **Real-time Chat**: Instant messaging with your trained chatbots

### High Performance
- **FastAPI Backend**: High-performance Python API for model inference
- **WebSocket Support**: Real-time updates for training and chat
- **Model Caching**: Efficient model loading and memory management
- **Progress Tracking**: Detailed training metrics and time estimates

## Architecture

```
chatbot-maker/
├── frontend/          # Vue.js + TypeScript web interface
├── backend/           # Node.js + Express API server
├── python-services/   # Python training and inference services
├── uploads/           # Training files storage
├── models/            # Trained models storage
└── logs/              # Application logs
```

## Quick Start

### Prerequisites
- Node.js (v18 or higher)
- Python (3.8 or higher)
- Git

### Installation

1. **Clone and install dependencies:**
   ```bash
   git clone <repository-url>
   cd chatbot-maker
   
   # Install Python dependencies
   cd python-services
   pip install -r requirements.txt
   
   # Install backend dependencies
   cd ../backend
   npm install
   
   # Install frontend dependencies
   cd ../frontend
   npm install
   
   # Setup environment variables
   cd ../backend
   cp .env.example .env
   ```

2. **Start all services:**
   ```bash
   # Terminal 1: Start the chat API (Python)
   cd python-services
   python start_chat_api.py

   # Terminal 2: Start the backend (Node.js)
   cd backend
   npm run dev

   # Terminal 3: Start the frontend (Vue.js)
   cd frontend
   npm run dev
   ```

3. **Access the application:**
   - Frontend: http://localhost:3000
   - Backend API: http://localhost:5000
   - Chat API: http://localhost:8000
   - API Documentation: http://localhost:8000/docs

## Usage Guide

### 1. Upload Training Files
- Navigate to the "Training" page
- Drag and drop or select .txt/.pdf files
- Files are automatically validated and stored

### 2. Configure Training
- Select model size based on your computational resources:
  - **GPT-2**: 117M params - Fast, good for testing
  - **GPT-2 Medium**: 345M params - Balanced performance
  - **GPT-2 Large**: 774M params - Better quality
  - **GPT-2 XL**: 1.5B params - Best quality, requires more resources
- Adjust training parameters:
  - **Epochs**: Number of training iterations (1-1000)
  - **Batch Size**: Training batch size (1-32)
  - **Learning Rate**: Learning rate (0.00001-0.1)
  - **Max Length**: Maximum response length (50-1000)

### 3. Train Your Model
- Click "Start Training" to begin
- Monitor real-time progress with loss metrics
- Training can be stopped at any time
- Completed models are automatically saved

### 4. Chat with Your Bot
- Go to the "Chat" page
- Select an active model from "Models" page if needed
- Start chatting with your trained AI assistant
- Clear chat history anytime

### 5. Manage Models
- View all trained models in the "Models" page
- Activate/deactivate models
- Delete unused models to save space
- See model configuration and creation details

## Technical Details

### Frontend (Vue.js + TypeScript)
- **Framework**: Vue 3 with Composition API
- **Styling**: Tailwind CSS for responsive design
- **State Management**: Pinia for reactive state
- **Real-time**: Socket.IO for live updates
- **API Client**: Axios for HTTP requests

### Backend (Node.js + Express)
- **API Server**: Express.js with TypeScript
- **File Upload**: Multer for multipart file handling
- **Real-time**: Socket.IO for WebSocket communication
- **Process Management**: Child process spawning for Python training
- **Storage**: JSON-based data persistence

### Python Services
- **Training**: Enhanced GPT-2 fine-tuning with progress tracking
- **Inference**: FastAPI service for model inference
- **Libraries**: Transformers, PyTorch, FastAPI, Uvicorn
- **Models**: GPT-2 family support with custom tokenization

### Data Flow
1. **File Upload**: Frontend → Backend → File System
2. **Training Start**: Frontend → Backend → Python Trainer
3. **Progress Updates**: Python → Backend → Frontend (WebSocket)
4. **Model Storage**: Python → File System → Backend Database
5. **Chat Request**: Frontend → Backend → Python API → Response

## Development

### Project Structure
```
frontend/
├── src/
│   ├── components/     # Reusable Vue components
│   ├── views/          # Page components
│   ├── stores/         # Pinia state management
│   ├── services/       # API and socket services
│   └── types/          # TypeScript type definitions

backend/
├── src/
│   ├── routes/         # Express route handlers
│   ├── services/       # Business logic services
│   ├── middleware/     # Express middleware
│   ├── utils/          # Utility functions
│   └── types/          # TypeScript type definitions

python-services/
├── enhanced_trainer.py     # Advanced training script
├── chat_api.py            # FastAPI inference service
├── train_chatbot.py       # Original training script
└── test_chatbot.py        # Original test script
```

### Environment Variables
- **Backend**: Copy `backend/.env.example` to `backend/.env`
- **Frontend**: Proxy configuration in `vite.config.ts`
- **Python**: Set PYTHONUNBUFFERED=1 for real-time output

### Testing
```bash
# Frontend
cd frontend && npm run lint

# Backend
cd backend && npm run lint

# Python
cd python-services && python -m pytest
```

## Performance Tips

### For Training
- Use smaller models (GPT-2, GPT-2 Medium) for faster iteration
- Reduce batch size if you encounter memory issues
- Monitor GPU usage if available
- Use fewer epochs for initial testing

### For Inference
- Keep frequently used models loaded in memory
- Use GPU acceleration when available
- Monitor memory usage for multiple models
- Consider model quantization for production

## Troubleshooting

### Common Issues

**Training fails to start:**
- Check Python dependencies: `pip install -r python-services/requirements.txt`
- Verify file uploads completed successfully
- Check disk space for model output

**Chat API not responding:**
- Ensure Python service is running on port 8000
- Check model files exist in the models directory
- Verify CORS settings for cross-origin requests

**Frontend connection issues:**
- Confirm backend is running on port 5000
- Check proxy configuration in `vite.config.ts`
- Verify WebSocket connection in browser dev tools

**Memory issues:**
- Use smaller model sizes
- Reduce batch size
- Clear model cache periodically
- Monitor system resources

### Logs
- **Backend**: Check `logs/combined.log` and `logs/error.log`
- **Python**: Training outputs to console and logs
- **Frontend**: Browser developer console

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests if applicable
5. Submit a pull request

## License

This project is open source and available under the MIT License.

## Support

For issues and questions:
- Check the troubleshooting section above
- Review logs for error details
- Open an issue on the repository

---

Built using TypeScript, Python, Vue.js, and Node.js. Special thanks to the developers of these amazing tools. 
