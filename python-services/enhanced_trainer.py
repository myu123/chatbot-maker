#!/usr/bin/env python3
"""
Enhanced GPT-2 Training Script with Progress Tracking
Supports real-time progress updates via JSON output
"""

import os
import re
import json
import time
import argparse
import logging
from datetime import datetime
from pathlib import Path
from typing import Dict, Any, Optional

import torch
from transformers import (
    GPT2Tokenizer, 
    GPT2LMHeadModel, 
    TextDataset, 
    DataCollatorForLanguageModeling,
    Trainer, 
    TrainingArguments,
    TrainerCallback
)
from PyPDF2 import PdfReader

# Set up logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

class ProgressCallback(TrainerCallback):
    """Custom callback for tracking training progress"""
    
    def __init__(self, job_id: str, total_epochs: int):
        self.job_id = job_id
        self.total_epochs = total_epochs
        self.start_time = time.time()
        self.last_log_time = time.time()
        
    def on_epoch_begin(self, args, state, control, **kwargs):
        """Called at the beginning of each epoch"""
        self.epoch_start_time = time.time()
        
    def on_epoch_end(self, args, state, control, logs=None, **kwargs):
        """Called at the end of each epoch"""
        current_time = time.time()
        epoch_time = current_time - self.epoch_start_time
        elapsed_time = current_time - self.start_time
        
        # Calculate progress
        progress = (state.epoch / self.total_epochs) * 100
        
        # Estimate time remaining
        if state.epoch > 0:
            avg_epoch_time = elapsed_time / state.epoch
            remaining_epochs = self.total_epochs - state.epoch
            eta = remaining_epochs * avg_epoch_time
        else:
            eta = 0
            
        # Extract loss from logs
        loss = logs.get('train_loss', 0.0) if logs else 0.0
        
        # Output progress as JSON
        progress_data = {
            'job_id': self.job_id,
            'epoch': int(state.epoch),
            'total_epochs': self.total_epochs,
            'progress': progress,
            'loss': loss,
            'eta': eta,
            'timestamp': datetime.now().isoformat()
        }
        
        print(json.dumps(progress_data), flush=True)
        
    def on_log(self, args, state, control, logs=None, **kwargs):
        """Called when logging"""
        current_time = time.time()
        
        # Throttle log output to every 30 seconds
        if current_time - self.last_log_time > 30:
            if logs and 'loss' in logs:
                progress_data = {
                    'job_id': self.job_id,
                    'step': state.global_step,
                    'loss': logs['loss'],
                    'timestamp': datetime.now().isoformat()
                }
                print(json.dumps(progress_data), flush=True)
                self.last_log_time = current_time

def read_pdf(file_path: str) -> str:
    """Extract text from PDF file"""
    try:
        with open(file_path, "rb") as file:
            pdf_reader = PdfReader(file)
            text = ""
            for page in pdf_reader.pages:
                text += page.extract_text() + "\n"
        return text
    except Exception as e:
        logger.error(f"Error reading PDF {file_path}: {e}")
        return ""

def read_txt(file_path: str) -> str:
    """Read text from TXT file"""
    try:
        with open(file_path, "r", encoding="utf-8") as file:
            return file.read()
    except Exception as e:
        logger.error(f"Error reading TXT {file_path}: {e}")
        return ""

def read_documents_from_directory(directory: str) -> str:
    """Read all supported documents from directory"""
    combined_text = ""
    supported_files = []
    
    for filename in os.listdir(directory):
        file_path = os.path.join(directory, filename)
        
        if filename.lower().endswith(".pdf"):
            text = read_pdf(file_path)
            if text.strip():
                combined_text += text + "\n"
                supported_files.append(filename)
        elif filename.lower().endswith(".txt"):
            text = read_txt(file_path)
            if text.strip():
                combined_text += text + "\n"
                supported_files.append(filename)
    
    logger.info(f"Successfully read {len(supported_files)} files: {supported_files}")
    return combined_text

def preprocess_text(text: str) -> str:
    """Clean and preprocess text"""
    # Remove excessive whitespace
    text = re.sub(r'\n+', '\n', text)
    text = re.sub(r' +', ' ', text)
    
    # Remove non-printable characters except common ones
    text = re.sub(r'[^\x20-\x7E\n\t]', '', text)
    
    # Ensure text ends with proper punctuation
    text = text.strip()
    if text and text[-1] not in '.!?':
        text += '.'
    
    return text

def validate_config(args) -> None:
    """Validate training configuration"""
    if args.epochs < 1 or args.epochs > 1000:
        raise ValueError("Epochs must be between 1 and 1000")
    
    if args.batch_size < 1 or args.batch_size > 32:
        raise ValueError("Batch size must be between 1 and 32")
    
    if args.learning_rate < 1e-6 or args.learning_rate > 1e-1:
        raise ValueError("Learning rate must be between 1e-6 and 1e-1")
    
    if args.train_fraction < 0.5 or args.train_fraction > 0.95:
        raise ValueError("Train fraction must be between 0.5 and 0.95")

def train_chatbot(args) -> None:
    """Main training function"""
    try:
        # Validate configuration
        validate_config(args)
        
        # Create output directory
        os.makedirs(args.output_dir, exist_ok=True)
        
        # Read and preprocess documents
        logger.info(f"Reading documents from {args.input_dir}")
        combined_text = read_documents_from_directory(args.input_dir)
        
        if not combined_text.strip():
            raise ValueError("No valid text found in input directory")
        
        combined_text = preprocess_text(combined_text)
        logger.info(f"Total text length: {len(combined_text)} characters")
        
        # Split into training and validation sets
        split_index = int(args.train_fraction * len(combined_text))
        train_text = combined_text[:split_index]
        val_text = combined_text[split_index:]
        
        # Save training data
        train_file = os.path.join(args.output_dir, "train.txt")
        val_file = os.path.join(args.output_dir, "val.txt")
        
        with open(train_file, "w", encoding="utf-8") as f:
            f.write(train_text)
        
        with open(val_file, "w", encoding="utf-8") as f:
            f.write(val_text)
        
        logger.info(f"Training data split: {len(train_text)} / {len(val_text)} characters")
        
        # Initialize tokenizer and model
        logger.info(f"Loading {args.model_size} model and tokenizer")
        tokenizer = GPT2Tokenizer.from_pretrained(args.model_size)
        model = GPT2LMHeadModel.from_pretrained(args.model_size)
        
        # Add pad token if not present
        if tokenizer.pad_token is None:
            tokenizer.pad_token = tokenizer.eos_token
        
        # Prepare datasets
        logger.info("Preparing training datasets")
        train_dataset = TextDataset(
            tokenizer=tokenizer,
            file_path=train_file,
            block_size=min(args.max_length, 512)  # Limit block size for memory
        )
        
        val_dataset = TextDataset(
            tokenizer=tokenizer,
            file_path=val_file,
            block_size=min(args.max_length, 512)
        )
        
        data_collator = DataCollatorForLanguageModeling(
            tokenizer=tokenizer,
            mlm=False
        )
        
        # Set up training arguments
        training_args = TrainingArguments(
            output_dir=args.output_dir,
            overwrite_output_dir=True,
            num_train_epochs=args.epochs,
            per_device_train_batch_size=args.batch_size,
            per_device_eval_batch_size=args.batch_size,
            learning_rate=args.learning_rate,
            warmup_steps=100,
            logging_steps=50,
            logging_dir=os.path.join(args.output_dir, 'logs'),
            save_steps=max(100, len(train_dataset) // (args.batch_size * 4)),
            save_total_limit=2,
            evaluation_strategy="steps",
            eval_steps=max(200, len(train_dataset) // (args.batch_size * 2)),
            load_best_model_at_end=True,
            metric_for_best_model="eval_loss",
            greater_is_better=False,
            report_to=None,  # Disable wandb/tensorboard
            dataloader_pin_memory=False,  # Reduce memory usage
            fp16=torch.cuda.is_available(),  # Use mixed precision if available
        )
        
        # Create progress callback
        progress_callback = ProgressCallback(args.job_id, args.epochs)
        
        # Initialize trainer
        trainer = Trainer(
            model=model,
            args=training_args,
            data_collator=data_collator,
            train_dataset=train_dataset,
            eval_dataset=val_dataset,
            callbacks=[progress_callback]
        )
        
        # Start training
        logger.info("Starting training")
        trainer.train()
        
        # Save final model and tokenizer
        logger.info("Saving trained model")
        trainer.save_model(args.output_dir)
        tokenizer.save_pretrained(args.output_dir)
        
        # Save training configuration
        config_file = os.path.join(args.output_dir, "training_config.json")
        with open(config_file, "w") as f:
            json.dump(vars(args), f, indent=2, default=str)
        
        # Output completion message
        completion_data = {
            'job_id': args.job_id,
            'status': 'completed',
            'model_path': args.output_dir,
            'epochs': args.epochs,
            'final_loss': trainer.state.log_history[-1].get('train_loss', 0.0) if trainer.state.log_history else 0.0,
            'timestamp': datetime.now().isoformat()
        }
        
        print(json.dumps(completion_data), flush=True)
        logger.info("Training completed successfully")
        
    except Exception as e:
        error_data = {
            'job_id': args.job_id,
            'status': 'error',
            'error': str(e),
            'timestamp': datetime.now().isoformat()
        }
        print(json.dumps(error_data), flush=True)
        logger.error(f"Training failed: {e}")
        raise

def main():
    parser = argparse.ArgumentParser(description="Enhanced GPT-2 Chatbot Trainer")
    
    parser.add_argument("--input-dir", required=True, help="Directory containing training files")
    parser.add_argument("--output-dir", required=True, help="Directory to save trained model")
    parser.add_argument("--model-size", default="gpt2", choices=["gpt2", "gpt2-medium", "gpt2-large", "gpt2-xl"])
    parser.add_argument("--epochs", type=int, default=3, help="Number of training epochs")
    parser.add_argument("--batch-size", type=int, default=4, help="Training batch size")
    parser.add_argument("--learning-rate", type=float, default=5e-5, help="Learning rate")
    parser.add_argument("--max-length", type=int, default=150, help="Maximum sequence length")
    parser.add_argument("--train-fraction", type=float, default=0.8, help="Fraction of data for training")
    parser.add_argument("--job-id", required=True, help="Unique job identifier")
    
    args = parser.parse_args()
    
    # Output start message
    start_data = {
        'job_id': args.job_id,
        'status': 'started',
        'config': vars(args),
        'timestamp': datetime.now().isoformat()
    }
    print(json.dumps(start_data), flush=True)
    
    train_chatbot(args)

if __name__ == "__main__":
    main()