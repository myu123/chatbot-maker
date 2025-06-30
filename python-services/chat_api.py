#!/usr/bin/env python3
"""
FastAPI service for chatbot inference
Provides REST API for chat interactions with trained GPT-2 models
"""

import os
import json
import logging
from pathlib import Path
from typing import Dict, Optional
from datetime import datetime

import torch
from fastapi import FastAPI, HTTPException, BackgroundTasks
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field
from transformers import GPT2Tokenizer, GPT2LMHeadModel
import uvicorn

# Set up logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Models cache
model_cache: Dict[str, Dict] = {}

app = FastAPI(
    title="Chatbot Maker Chat API",
    description="FastAPI service for chatbot inference using trained GPT-2 models",
    version="1.0.0"
)

# CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # In production, specify exact origins
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

class ChatRequest(BaseModel):
    message: str = Field(..., min_length=1, max_length=1000, description="User message")
    model_path: str = Field(..., description="Path to the trained model")
    max_length: int = Field(default=150, ge=50, le=1000, description="Maximum response length")
    temperature: float = Field(default=0.7, ge=0.1, le=2.0, description="Sampling temperature")
    top_p: float = Field(default=0.9, ge=0.1, le=1.0, description="Nucleus sampling parameter")
    do_sample: bool = Field(default=True, description="Whether to use sampling")

class ChatResponse(BaseModel):
    response: str
    model_path: str
    timestamp: str
    generation_time: float

class HealthResponse(BaseModel):
    status: str
    timestamp: str
    loaded_models: int
    memory_usage: Optional[str] = None

def load_model(model_path: str) -> Dict:
    """Load model and tokenizer into cache"""
    try:
        if not os.path.exists(model_path):
            raise FileNotFoundError(f"Model path does not exist: {model_path}")
        
        # Check if model files exist
        if not os.path.exists(os.path.join(model_path, "pytorch_model.bin")) and \
           not os.path.exists(os.path.join(model_path, "model.safetensors")):
            raise FileNotFoundError(f"No model files found in: {model_path}")
        
        logger.info(f"Loading model from {model_path}")
        
        # Load tokenizer and model
        tokenizer = GPT2Tokenizer.from_pretrained(model_path)
        model = GPT2LMHeadModel.from_pretrained(model_path)
        
        # Ensure pad token is set
        if tokenizer.pad_token is None:
            tokenizer.pad_token = tokenizer.eos_token
        
        # Move to GPU if available
        device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
        model = model.to(device)
        model.eval()
        
        # Load training config if available
        config_path = os.path.join(model_path, "training_config.json")
        training_config = {}
        if os.path.exists(config_path):
            with open(config_path, 'r') as f:
                training_config = json.load(f)
        
        model_info = {
            'tokenizer': tokenizer,
            'model': model,
            'device': device,
            'loaded_at': datetime.now(),
            'config': training_config
        }
        
        model_cache[model_path] = model_info
        logger.info(f"Model loaded successfully on {device}")
        
        return model_info
        
    except Exception as e:
        logger.error(f"Failed to load model from {model_path}: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to load model: {str(e)}")

def get_model(model_path: str) -> Dict:
    """Get model from cache or load it"""
    if model_path not in model_cache:
        return load_model(model_path)
    return model_cache[model_path]

def generate_response(model_info: Dict, message: str, max_length: int, 
                     temperature: float, top_p: float, do_sample: bool) -> str:
    """Generate response using the loaded model"""
    try:
        tokenizer = model_info['tokenizer']
        model = model_info['model']
        device = model_info['device']
        
        # Encode input
        input_ids = tokenizer.encode(message, return_tensors="pt").to(device)
        attention_mask = torch.ones_like(input_ids).to(device)
        
        # Generate response
        with torch.no_grad():
            output = model.generate(
                input_ids,
                attention_mask=attention_mask,
                max_length=min(input_ids.shape[1] + max_length, 1024),  # Prevent too long sequences
                temperature=temperature,
                top_p=top_p,
                do_sample=do_sample,
                pad_token_id=tokenizer.eos_token_id,
                num_return_sequences=1,
                no_repeat_ngram_size=2,  # Prevent repetitive text
                early_stopping=True
            )
        
        # Decode response
        full_response = tokenizer.decode(output[0], skip_special_tokens=True)
        
        # Extract only the new part (response after the input)
        response = full_response[len(message):].strip()
        
        # Clean up response
        if not response:
            response = "I'm not sure how to respond to that."
        
        # Ensure response ends properly
        if response and response[-1] not in '.!?':
            # Find the last complete sentence
            for i, char in enumerate(reversed(response)):
                if char in '.!?':
                    response = response[:len(response) - i]
                    break
            else:
                # No sentence ending found, add period
                response += '.'
        
        return response
        
    except Exception as e:
        logger.error(f"Error generating response: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to generate response: {str(e)}")

@app.post("/chat", response_model=ChatResponse)
async def chat(request: ChatRequest, background_tasks: BackgroundTasks):
    """Generate chat response"""
    start_time = datetime.now()
    
    try:
        # Get or load model
        model_info = get_model(request.model_path)
        
        # Generate response
        response = generate_response(
            model_info,
            request.message,
            request.max_length,
            request.temperature,
            request.top_p,
            request.do_sample
        )
        
        generation_time = (datetime.now() - start_time).total_seconds()
        
        logger.info(f"Generated response in {generation_time:.2f}s for model {request.model_path}")
        
        return ChatResponse(
            response=response,
            model_path=request.model_path,
            timestamp=datetime.now().isoformat(),
            generation_time=generation_time
        )
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Unexpected error in chat endpoint: {e}")
        raise HTTPException(status_code=500, detail="Internal server error")

@app.post("/preload/{model_path:path}")
async def preload_model(model_path: str):
    """Preload a model into cache"""
    try:
        model_info = load_model(model_path)
        return {
            "message": "Model preloaded successfully",
            "model_path": model_path,
            "device": str(model_info['device']),
            "loaded_at": model_info['loaded_at'].isoformat()
        }
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error preloading model: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.delete("/unload/{model_path:path}")
async def unload_model(model_path: str):
    """Unload a model from cache"""
    if model_path in model_cache:
        del model_cache[model_path]
        # Force garbage collection
        if torch.cuda.is_available():
            torch.cuda.empty_cache()
        logger.info(f"Unloaded model: {model_path}")
        return {"message": "Model unloaded successfully", "model_path": model_path}
    else:
        raise HTTPException(status_code=404, detail="Model not found in cache")

@app.get("/models")
async def list_loaded_models():
    """List all loaded models"""
    models = []
    for path, info in model_cache.items():
        models.append({
            "path": path,
            "device": str(info['device']),
            "loaded_at": info['loaded_at'].isoformat(),
            "config": info.get('config', {})
        })
    return {"loaded_models": models, "count": len(models)}

@app.get("/health", response_model=HealthResponse)
async def health_check():
    """Health check endpoint"""
    memory_info = None
    if torch.cuda.is_available():
        memory_info = f"GPU: {torch.cuda.memory_allocated() / 1024**2:.1f}MB / {torch.cuda.memory_reserved() / 1024**2:.1f}MB"
    
    return HealthResponse(
        status="healthy",
        timestamp=datetime.now().isoformat(),
        loaded_models=len(model_cache),
        memory_usage=memory_info
    )

@app.get("/")
async def root():
    """Root endpoint"""
    return {
        "message": "Chatbot Maker Chat API",
        "version": "1.0.0",
        "docs_url": "/docs",
        "health_url": "/health"
    }

# Error handlers
@app.exception_handler(404)
async def not_found_handler(request, exc):
    return {"error": "Not found", "detail": "The requested resource was not found"}

@app.exception_handler(500)
async def internal_error_handler(request, exc):
    logger.error(f"Internal server error: {exc}")
    return {"error": "Internal server error", "detail": "An unexpected error occurred"}

if __name__ == "__main__":
    import argparse
    
    parser = argparse.ArgumentParser(description="Chatbot Maker Chat API Server")
    parser.add_argument("--host", default="0.0.0.0", help="Host to bind to")
    parser.add_argument("--port", type=int, default=8000, help="Port to bind to")
    parser.add_argument("--reload", action="store_true", help="Enable auto-reload")
    parser.add_argument("--log-level", default="info", help="Log level")
    
    args = parser.parse_args()
    
    logger.info(f"Starting Chatbot Maker Chat API on {args.host}:{args.port}")
    logger.info(f"CUDA Available: {torch.cuda.is_available()}")
    
    uvicorn.run(
        "chat_api:app",
        host=args.host,
        port=args.port,
        reload=args.reload,
        log_level=args.log_level
    )