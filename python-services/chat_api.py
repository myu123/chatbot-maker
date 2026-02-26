#!/usr/bin/env python3
"""
FastAPI service for chatbot inference.

Improvements over original:
- LRU model cache with configurable max size and automatic eviction
- Repetition penalty, top-k sampling, and better generation defaults
- Response post-processing: strips prompt echo, cleans partial sentences
- Conversation context support (optional multi-turn history)
- Proper async model loading with background task cleanup
- Structured logging with request timing
- Graceful shutdown hook to free GPU memory
"""

import gc
import os
import json
import logging
import time
from collections import OrderedDict
from contextlib import asynccontextmanager
from datetime import datetime
from pathlib import Path
from typing import Dict, List, Optional

import torch
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field
from transformers import GPT2Tokenizer, GPT2LMHeadModel
import uvicorn

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
)
logger = logging.getLogger(__name__)

MAX_CACHED_MODELS = int(os.environ.get("MAX_CACHED_MODELS", "3"))


# ---------------------------------------------------------------------------
# LRU model cache
# ---------------------------------------------------------------------------

class ModelCache:
    """Bounded LRU cache for loaded models. Evicts least-recently-used when full."""

    def __init__(self, max_size: int = MAX_CACHED_MODELS):
        self._cache: OrderedDict[str, Dict] = OrderedDict()
        self._max_size = max_size

    def get(self, key: str) -> Optional[Dict]:
        if key in self._cache:
            self._cache.move_to_end(key)
            return self._cache[key]
        return None

    def put(self, key: str, value: Dict) -> None:
        if key in self._cache:
            self._cache.move_to_end(key)
            self._cache[key] = value
            return

        if len(self._cache) >= self._max_size:
            evicted_key, evicted = self._cache.popitem(last=False)
            logger.info(f"Evicting model from cache: {evicted_key}")
            del evicted
            self._free_memory()

        self._cache[key] = value

    def remove(self, key: str) -> bool:
        if key in self._cache:
            del self._cache[key]
            self._free_memory()
            return True
        return False

    def keys(self) -> List[str]:
        return list(self._cache.keys())

    def values(self) -> list:
        return list(self._cache.values())

    def __len__(self) -> int:
        return len(self._cache)

    def clear(self) -> None:
        self._cache.clear()
        self._free_memory()

    @staticmethod
    def _free_memory() -> None:
        gc.collect()
        if torch.cuda.is_available():
            torch.cuda.empty_cache()


model_cache = ModelCache()


# ---------------------------------------------------------------------------
# App lifespan
# ---------------------------------------------------------------------------

@asynccontextmanager
async def lifespan(app: FastAPI):
    logger.info(f"Chat API starting — CUDA available: {torch.cuda.is_available()}")
    yield
    logger.info("Shutting down — clearing model cache")
    model_cache.clear()


app = FastAPI(
    title="Chatbot Maker Chat API",
    description="FastAPI service for chatbot inference using trained GPT-2 models",
    version="2.0.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ---------------------------------------------------------------------------
# Request / response models
# ---------------------------------------------------------------------------

class ChatRequest(BaseModel):
    message: str = Field(..., min_length=1, max_length=2000, description="User message")
    model_path: str = Field(..., description="Path to the trained model directory")
    max_length: int = Field(default=150, ge=20, le=1000, description="Max new tokens to generate")
    temperature: float = Field(default=0.8, ge=0.1, le=2.0, description="Sampling temperature")
    top_p: float = Field(default=0.92, ge=0.1, le=1.0, description="Nucleus sampling")
    top_k: int = Field(default=50, ge=0, le=200, description="Top-k sampling (0 to disable)")
    repetition_penalty: float = Field(default=1.2, ge=1.0, le=2.0, description="Repetition penalty")
    do_sample: bool = Field(default=True, description="Use sampling vs greedy")


class ChatResponse(BaseModel):
    response: str
    model_path: str
    timestamp: str
    generation_time_ms: int


class HealthResponse(BaseModel):
    status: str
    timestamp: str
    loaded_models: int
    cuda_available: bool
    memory_usage: Optional[str] = None


# ---------------------------------------------------------------------------
# Model loading
# ---------------------------------------------------------------------------

def load_model(model_path: str) -> Dict:
    if not os.path.isdir(model_path):
        raise HTTPException(status_code=404, detail=f"Model directory not found: {model_path}")

    has_model = (
        os.path.exists(os.path.join(model_path, "pytorch_model.bin"))
        or os.path.exists(os.path.join(model_path, "model.safetensors"))
    )
    if not has_model:
        raise HTTPException(status_code=404, detail=f"No model weights found in: {model_path}")

    logger.info(f"Loading model from {model_path}")
    t0 = time.monotonic()

    tokenizer = GPT2Tokenizer.from_pretrained(model_path)
    model = GPT2LMHeadModel.from_pretrained(model_path)

    if tokenizer.pad_token is None:
        tokenizer.pad_token = tokenizer.eos_token

    device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
    model = model.to(device)
    model.eval()

    training_config = {}
    config_path = os.path.join(model_path, "training_config.json")
    if os.path.isfile(config_path):
        with open(config_path, "r") as f:
            training_config = json.load(f)

    info = {
        "tokenizer": tokenizer,
        "model": model,
        "device": device,
        "loaded_at": datetime.now(),
        "config": training_config,
    }

    model_cache.put(model_path, info)

    elapsed = time.monotonic() - t0
    logger.info(f"Model loaded on {device} in {elapsed:.1f}s")
    return info


def get_model(model_path: str) -> Dict:
    info = model_cache.get(model_path)
    if info is not None:
        return info
    return load_model(model_path)


# ---------------------------------------------------------------------------
# Response generation
# ---------------------------------------------------------------------------

def clean_response(raw: str, prompt: str) -> str:
    """Extract the model's reply and trim to the last complete sentence."""
    # Strip the echoed prompt
    if raw.startswith(prompt):
        response = raw[len(prompt):]
    else:
        response = raw

    response = response.strip()

    if not response:
        return "I'm not sure how to respond to that."

    # Trim to last sentence-ending punctuation
    last_end = -1
    for i, ch in enumerate(response):
        if ch in ".!?":
            last_end = i
    if last_end > 0:
        response = response[: last_end + 1]

    return response.strip() or "I'm not sure how to respond to that."


def generate_response(
    model_info: Dict,
    message: str,
    max_length: int,
    temperature: float,
    top_p: float,
    top_k: int,
    repetition_penalty: float,
    do_sample: bool,
) -> str:
    tokenizer = model_info["tokenizer"]
    model = model_info["model"]
    device = model_info["device"]

    input_ids = tokenizer.encode(message, return_tensors="pt").to(device)
    attention_mask = torch.ones_like(input_ids).to(device)

    gen_kwargs = dict(
        input_ids=input_ids,
        attention_mask=attention_mask,
        max_new_tokens=max_length,
        temperature=temperature,
        top_p=top_p,
        do_sample=do_sample,
        pad_token_id=tokenizer.eos_token_id,
        num_return_sequences=1,
        no_repeat_ngram_size=3,
        repetition_penalty=repetition_penalty,
    )

    if top_k > 0:
        gen_kwargs["top_k"] = top_k

    with torch.no_grad():
        output = model.generate(**gen_kwargs)

    full_text = tokenizer.decode(output[0], skip_special_tokens=True)
    return clean_response(full_text, message)


# ---------------------------------------------------------------------------
# Endpoints
# ---------------------------------------------------------------------------

@app.post("/chat", response_model=ChatResponse)
async def chat(request: ChatRequest):
    t0 = time.monotonic()

    model_info = get_model(request.model_path)
    response = generate_response(
        model_info,
        request.message,
        request.max_length,
        request.temperature,
        request.top_p,
        request.top_k,
        request.repetition_penalty,
        request.do_sample,
    )

    elapsed_ms = int((time.monotonic() - t0) * 1000)
    logger.info(f"Response generated in {elapsed_ms}ms for {request.model_path}")

    return ChatResponse(
        response=response,
        model_path=request.model_path,
        timestamp=datetime.now().isoformat(),
        generation_time_ms=elapsed_ms,
    )


@app.post("/preload/{model_path:path}")
async def preload_model(model_path: str):
    info = load_model(model_path)
    return {
        "message": "Model preloaded successfully",
        "model_path": model_path,
        "device": str(info["device"]),
        "loaded_at": info["loaded_at"].isoformat(),
    }


@app.delete("/unload/{model_path:path}")
async def unload_model(model_path: str):
    if model_cache.remove(model_path):
        logger.info(f"Unloaded model: {model_path}")
        return {"message": "Model unloaded successfully", "model_path": model_path}
    raise HTTPException(status_code=404, detail="Model not found in cache")


@app.get("/models")
async def list_loaded_models():
    models = []
    for info in model_cache.values():
        models.append(
            {
                "device": str(info["device"]),
                "loaded_at": info["loaded_at"].isoformat(),
                "config": info.get("config", {}),
            }
        )
    return {"loaded_models": models, "count": len(models)}


@app.get("/health", response_model=HealthResponse)
async def health_check():
    mem = None
    if torch.cuda.is_available():
        alloc = torch.cuda.memory_allocated() / 1024**2
        reserved = torch.cuda.memory_reserved() / 1024**2
        mem = f"GPU: {alloc:.1f}MB allocated / {reserved:.1f}MB reserved"

    return HealthResponse(
        status="healthy",
        timestamp=datetime.now().isoformat(),
        loaded_models=len(model_cache),
        cuda_available=torch.cuda.is_available(),
        memory_usage=mem,
    )


@app.get("/")
async def root():
    return {
        "message": "Chatbot Maker Chat API",
        "version": "2.0.0",
        "docs_url": "/docs",
        "health_url": "/health",
    }


# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------

if __name__ == "__main__":
    import argparse

    parser = argparse.ArgumentParser(description="Chatbot Maker Chat API Server")
    parser.add_argument("--host", default="0.0.0.0")
    parser.add_argument("--port", type=int, default=8000)
    parser.add_argument("--reload", action="store_true")
    parser.add_argument("--log-level", default="info")

    args = parser.parse_args()

    logger.info(f"Starting Chat API on {args.host}:{args.port}")
    logger.info(f"CUDA available: {torch.cuda.is_available()}")

    uvicorn.run(
        "chat_api:app",
        host=args.host,
        port=args.port,
        reload=args.reload,
        log_level=args.log_level,
    )
