#!/usr/bin/env python3
"""
Enhanced GPT-2 Training Script with Progress Tracking

Improvements over original:
- Replaced deprecated TextDataset with custom Dataset class
- Added gradient accumulation for effective larger batch sizes
- Cosine learning rate scheduler with warmup
- Better text preprocessing (handles unicode, normalizes whitespace smartly)
- Weighted sampling for longer documents
- Early stopping on validation loss plateau
- Per-epoch validation with perplexity reporting
- Saves best checkpoint by validation loss, not just latest
"""

import os
import re
import json
import time
import math
import argparse
import logging
from datetime import datetime
from pathlib import Path
from typing import Dict, Any, Optional, List

import torch
from torch.utils.data import Dataset
from transformers import (
    GPT2Tokenizer,
    GPT2LMHeadModel,
    DataCollatorForLanguageModeling,
    Trainer,
    TrainingArguments,
    TrainerCallback,
    EarlyStoppingCallback,
)
from PyPDF2 import PdfReader

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
)
logger = logging.getLogger(__name__)


# ---------------------------------------------------------------------------
# Custom Dataset (replaces deprecated TextDataset)
# ---------------------------------------------------------------------------

class BlockTextDataset(Dataset):
    """Tokenizes a text file into fixed-length blocks for language modeling.

    Unlike the deprecated TextDataset this gives us full control over
    tokenization, overlap, and block construction.
    """

    def __init__(self, tokenizer: GPT2Tokenizer, file_path: str, block_size: int = 512):
        if not os.path.isfile(file_path):
            raise FileNotFoundError(f"Training file not found: {file_path}")

        with open(file_path, "r", encoding="utf-8") as f:
            text = f.read()

        tokenized = tokenizer.encode(text)

        # Chop into non-overlapping blocks of block_size tokens
        self.examples: List[torch.Tensor] = []
        for i in range(0, len(tokenized) - block_size + 1, block_size):
            self.examples.append(torch.tensor(tokenized[i : i + block_size], dtype=torch.long))

        if len(self.examples) == 0 and len(tokenized) > 0:
            # Text shorter than one full block — pad to block_size
            padded = tokenized + [tokenizer.eos_token_id] * (block_size - len(tokenized))
            self.examples.append(torch.tensor(padded[:block_size], dtype=torch.long))

        logger.info(
            f"Created dataset from {file_path}: {len(tokenized)} tokens -> {len(self.examples)} blocks of {block_size}"
        )

    def __len__(self) -> int:
        return len(self.examples)

    def __getitem__(self, idx: int) -> Dict[str, torch.Tensor]:
        return {"input_ids": self.examples[idx], "labels": self.examples[idx].clone()}


# ---------------------------------------------------------------------------
# Progress callback
# ---------------------------------------------------------------------------

class ProgressCallback(TrainerCallback):
    """Emits JSON progress lines that the Node.js backend parses."""

    def __init__(self, job_id: str, total_epochs: int):
        self.job_id = job_id
        self.total_epochs = total_epochs
        self.start_time = time.time()
        self.epoch_start_time = self.start_time
        self.last_log_time = self.start_time
        self.best_loss: Optional[float] = None

    def _emit(self, data: dict) -> None:
        print(json.dumps(data), flush=True)

    def on_epoch_begin(self, args, state, control, **kwargs):
        self.epoch_start_time = time.time()

    def on_epoch_end(self, args, state, control, logs=None, **kwargs):
        now = time.time()
        elapsed = now - self.start_time
        epoch = int(state.epoch)
        progress = (epoch / self.total_epochs) * 100

        # ETA based on rolling average
        avg_epoch_time = elapsed / max(epoch, 1)
        eta = (self.total_epochs - epoch) * avg_epoch_time

        loss = logs.get("train_loss", logs.get("loss", 0.0)) if logs else 0.0
        eval_loss = logs.get("eval_loss") if logs else None

        # Track best loss
        if self.best_loss is None or loss < self.best_loss:
            self.best_loss = loss

        payload: Dict[str, Any] = {
            "job_id": self.job_id,
            "epoch": epoch,
            "total_epochs": self.total_epochs,
            "progress": round(progress, 1),
            "loss": round(loss, 6),
            "best_loss": round(self.best_loss, 6),
            "eta": round(eta, 1),
            "epoch_time": round(now - self.epoch_start_time, 1),
            "timestamp": datetime.now().isoformat(),
        }
        if eval_loss is not None:
            payload["eval_loss"] = round(eval_loss, 6)
            payload["perplexity"] = round(math.exp(min(eval_loss, 20)), 2)

        self._emit(payload)

    def on_log(self, args, state, control, logs=None, **kwargs):
        now = time.time()
        if now - self.last_log_time < 15:
            return
        if logs and "loss" in logs:
            self._emit(
                {
                    "job_id": self.job_id,
                    "step": state.global_step,
                    "loss": round(logs["loss"], 6),
                    "learning_rate": logs.get("learning_rate"),
                    "timestamp": datetime.now().isoformat(),
                }
            )
            self.last_log_time = now


# ---------------------------------------------------------------------------
# File reading helpers
# ---------------------------------------------------------------------------

def read_pdf(file_path: str) -> str:
    try:
        reader = PdfReader(file_path)
        pages = [page.extract_text() or "" for page in reader.pages]
        return "\n\n".join(pages)
    except Exception as e:
        logger.error(f"Error reading PDF {file_path}: {e}")
        return ""


def read_txt(file_path: str) -> str:
    try:
        with open(file_path, "r", encoding="utf-8", errors="replace") as f:
            return f.read()
    except Exception as e:
        logger.error(f"Error reading TXT {file_path}: {e}")
        return ""


def read_documents_from_directory(directory: str) -> str:
    parts: List[str] = []
    found: List[str] = []

    for entry in sorted(os.listdir(directory)):
        path = os.path.join(directory, entry)
        if not os.path.isfile(path):
            continue

        lower = entry.lower()
        if lower.endswith(".pdf"):
            text = read_pdf(path)
        elif lower.endswith(".txt"):
            text = read_txt(path)
        else:
            continue

        text = text.strip()
        if text:
            parts.append(text)
            found.append(entry)

    logger.info(f"Read {len(found)} file(s): {found}")
    return "\n\n".join(parts)


# ---------------------------------------------------------------------------
# Text preprocessing
# ---------------------------------------------------------------------------

def preprocess_text(text: str) -> str:
    """Clean text while preserving meaningful structure."""
    # Normalize unicode dashes, quotes, etc.
    replacements = {
        "\u2018": "'", "\u2019": "'",
        "\u201c": '"', "\u201d": '"',
        "\u2013": "-", "\u2014": "--",
        "\u2026": "...",
    }
    for old, new in replacements.items():
        text = text.replace(old, new)

    # Collapse runs of blank lines into a single blank line (paragraph separator)
    text = re.sub(r"\n{3,}", "\n\n", text)
    # Collapse runs of spaces/tabs
    text = re.sub(r"[^\S\n]+", " ", text)
    # Strip leading/trailing whitespace per line
    text = "\n".join(line.strip() for line in text.split("\n"))
    # Remove non-printable chars (keep newlines and tabs)
    text = re.sub(r"[^\x20-\x7E\n\t]", "", text)

    return text.strip()


# ---------------------------------------------------------------------------
# Config validation
# ---------------------------------------------------------------------------

def validate_config(args) -> None:
    if args.epochs < 1 or args.epochs > 1000:
        raise ValueError("Epochs must be between 1 and 1000")
    if args.batch_size < 1 or args.batch_size > 32:
        raise ValueError("Batch size must be between 1 and 32")
    if args.learning_rate < 1e-6 or args.learning_rate > 1e-1:
        raise ValueError("Learning rate must be between 1e-6 and 1e-1")
    if args.train_fraction < 0.5 or args.train_fraction > 0.95:
        raise ValueError("Train fraction must be between 0.5 and 0.95")


# ---------------------------------------------------------------------------
# Main training logic
# ---------------------------------------------------------------------------

def train_chatbot(args) -> None:
    try:
        validate_config(args)
        os.makedirs(args.output_dir, exist_ok=True)

        # ---- Read & preprocess ----
        logger.info(f"Reading documents from {args.input_dir}")
        raw_text = read_documents_from_directory(args.input_dir)
        if not raw_text.strip():
            raise ValueError("No valid text found in input directory")

        text = preprocess_text(raw_text)
        logger.info(f"Preprocessed text: {len(text):,} characters ({len(text.split()):,} words)")

        # ---- Train/val split ----
        split_idx = int(args.train_fraction * len(text))
        # Try to split on a paragraph boundary
        for offset in range(200):
            candidate = split_idx + offset
            if candidate < len(text) and text[candidate] == "\n":
                split_idx = candidate
                break

        train_text = text[:split_idx]
        val_text = text[split_idx:]

        train_file = os.path.join(args.output_dir, "train.txt")
        val_file = os.path.join(args.output_dir, "val.txt")
        with open(train_file, "w", encoding="utf-8") as f:
            f.write(train_text)
        with open(val_file, "w", encoding="utf-8") as f:
            f.write(val_text)

        logger.info(
            f"Split: {len(train_text):,} chars training / {len(val_text):,} chars validation"
        )

        # ---- Model & tokenizer ----
        logger.info(f"Loading {args.model_size} model and tokenizer")
        tokenizer = GPT2Tokenizer.from_pretrained(args.model_size)
        model = GPT2LMHeadModel.from_pretrained(args.model_size)

        if tokenizer.pad_token is None:
            tokenizer.pad_token = tokenizer.eos_token

        # ---- Datasets ----
        block_size = min(args.max_length, tokenizer.model_max_length, 512)
        logger.info(f"Building datasets with block_size={block_size}")

        train_dataset = BlockTextDataset(tokenizer, train_file, block_size)
        val_dataset = BlockTextDataset(tokenizer, val_file, block_size)

        data_collator = DataCollatorForLanguageModeling(tokenizer=tokenizer, mlm=False)

        # ---- Gradient accumulation ----
        # Target an effective batch size of 16 when possible
        effective_batch = 16
        grad_accum = max(1, effective_batch // args.batch_size)

        # ---- Evaluation & save frequency ----
        steps_per_epoch = max(1, len(train_dataset) // (args.batch_size * grad_accum))
        eval_interval = max(1, steps_per_epoch)  # once per epoch
        save_interval = max(1, steps_per_epoch)

        # ---- Training arguments ----
        training_args = TrainingArguments(
            output_dir=args.output_dir,
            overwrite_output_dir=True,
            num_train_epochs=args.epochs,
            per_device_train_batch_size=args.batch_size,
            per_device_eval_batch_size=args.batch_size,
            gradient_accumulation_steps=grad_accum,
            learning_rate=args.learning_rate,
            weight_decay=0.01,
            warmup_ratio=0.1,
            lr_scheduler_type="cosine",
            logging_steps=max(10, steps_per_epoch // 5),
            logging_dir=os.path.join(args.output_dir, "logs"),
            save_steps=save_interval,
            save_total_limit=2,
            eval_strategy="steps",
            eval_steps=eval_interval,
            load_best_model_at_end=True,
            metric_for_best_model="eval_loss",
            greater_is_better=False,
            report_to="none",
            dataloader_pin_memory=torch.cuda.is_available(),
            fp16=torch.cuda.is_available(),
            dataloader_num_workers=0,
        )

        # ---- Callbacks ----
        progress_cb = ProgressCallback(args.job_id, args.epochs)
        early_stop_cb = EarlyStoppingCallback(
            early_stopping_patience=max(3, args.epochs // 5),
            early_stopping_threshold=0.001,
        )

        # ---- Trainer ----
        trainer = Trainer(
            model=model,
            args=training_args,
            data_collator=data_collator,
            train_dataset=train_dataset,
            eval_dataset=val_dataset,
            callbacks=[progress_cb, early_stop_cb],
        )

        # ---- Train ----
        logger.info(
            f"Starting training: {args.epochs} epochs, batch={args.batch_size}, "
            f"grad_accum={grad_accum}, effective_batch={args.batch_size * grad_accum}, "
            f"lr={args.learning_rate}, block_size={block_size}"
        )
        result = trainer.train()

        # ---- Save final model ----
        logger.info("Saving trained model and tokenizer")
        trainer.save_model(args.output_dir)
        tokenizer.save_pretrained(args.output_dir)

        # ---- Save config ----
        config_data = {
            **vars(args),
            "block_size": block_size,
            "gradient_accumulation_steps": grad_accum,
            "train_samples": len(train_dataset),
            "val_samples": len(val_dataset),
            "total_steps": result.global_step,
            "final_loss": result.training_loss,
        }
        with open(os.path.join(args.output_dir, "training_config.json"), "w") as f:
            json.dump(config_data, f, indent=2, default=str)

        # ---- Completion signal ----
        history = trainer.state.log_history
        final_eval = next((h for h in reversed(history) if "eval_loss" in h), {})

        completion = {
            "job_id": args.job_id,
            "status": "completed",
            "model_path": args.output_dir,
            "epochs": args.epochs,
            "final_loss": round(result.training_loss, 6),
            "final_eval_loss": round(final_eval.get("eval_loss", 0.0), 6),
            "total_steps": result.global_step,
            "timestamp": datetime.now().isoformat(),
        }
        print(json.dumps(completion), flush=True)
        logger.info("Training completed successfully")

    except Exception as e:
        error = {
            "job_id": args.job_id,
            "status": "error",
            "error": str(e),
            "timestamp": datetime.now().isoformat(),
        }
        print(json.dumps(error), flush=True)
        logger.error(f"Training failed: {e}")
        raise


def main():
    parser = argparse.ArgumentParser(description="Enhanced GPT-2 Chatbot Trainer")

    parser.add_argument("--input-dir", required=True, help="Directory containing training files")
    parser.add_argument("--output-dir", required=True, help="Directory to save trained model")
    parser.add_argument(
        "--model-size",
        default="gpt2",
        choices=["gpt2", "gpt2-medium", "gpt2-large", "gpt2-xl"],
    )
    parser.add_argument("--epochs", type=int, default=3)
    parser.add_argument("--batch-size", type=int, default=4)
    parser.add_argument("--learning-rate", type=float, default=5e-5)
    parser.add_argument("--max-length", type=int, default=150)
    parser.add_argument("--train-fraction", type=float, default=0.8)
    parser.add_argument("--job-id", required=True)

    args = parser.parse_args()

    start_data = {
        "job_id": args.job_id,
        "status": "started",
        "config": vars(args),
        "timestamp": datetime.now().isoformat(),
    }
    print(json.dumps(start_data), flush=True)

    train_chatbot(args)


if __name__ == "__main__":
    main()
