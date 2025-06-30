import multer from 'multer'
import { Request } from 'express'

const storage = multer.memoryStorage()

const fileFilter = (req: Request, file: Express.Multer.File, cb: multer.FileFilterCallback) => {
  // Accept only .txt and .pdf files
  if (file.mimetype === 'text/plain' || file.mimetype === 'application/pdf') {
    cb(null, true)
  } else {
    cb(new Error('Only .txt and .pdf files are allowed'))
  }
}

export const upload = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: 50 * 1024 * 1024, // 50MB max file size
    files: 10 // Maximum 10 files at once
  }
})