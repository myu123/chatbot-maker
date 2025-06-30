#!/usr/bin/env python3
"""
Startup script for the Chat API service
"""

import os
import sys
import subprocess
import signal
import time
from pathlib import Path

def check_requirements():
    """Check if required packages are installed"""
    try:
        import torch
        import transformers
        import fastapi
        import uvicorn
        print("✓ All required packages are installed")
        return True
    except ImportError as e:
        print(f"✗ Missing required package: {e}")
        print("Please run: pip install -r requirements.txt")
        return False

def start_server(host="0.0.0.0", port=8000, reload=False):
    """Start the FastAPI server"""
    if not check_requirements():
        sys.exit(1)
    
    print(f"Starting Chatbot Maker Chat API...")
    print(f"Server will be available at: http://{host}:{port}")
    print(f"API documentation at: http://{host}:{port}/docs")
    print("Press Ctrl+C to stop the server")
    
    try:
        # Start the server
        cmd = [
            sys.executable, "-m", "uvicorn",
            "chat_api:app",
            "--host", host,
            "--port", str(port),
            "--log-level", "info"
        ]
        
        if reload:
            cmd.append("--reload")
        
        process = subprocess.Popen(cmd, cwd=Path(__file__).parent)
        
        # Handle graceful shutdown
        def signal_handler(signum, frame):
            print("\nShutting down server...")
            process.terminate()
            process.wait()
            sys.exit(0)
        
        signal.signal(signal.SIGINT, signal_handler)
        signal.signal(signal.SIGTERM, signal_handler)
        
        # Wait for process to complete
        process.wait()
        
    except KeyboardInterrupt:
        print("\nServer stopped by user")
    except Exception as e:
        print(f"Error starting server: {e}")
        sys.exit(1)

if __name__ == "__main__":
    import argparse
    
    parser = argparse.ArgumentParser(description="Start Chatbot Maker Chat API")
    parser.add_argument("--host", default="0.0.0.0", help="Host to bind to")
    parser.add_argument("--port", type=int, default=8000, help="Port to bind to")
    parser.add_argument("--reload", action="store_true", help="Enable auto-reload for development")
    
    args = parser.parse_args()
    
    start_server(args.host, args.port, args.reload)