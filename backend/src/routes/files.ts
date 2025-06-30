import { Router, Request, Response, NextFunction } from 'express'
import { upload } from '@/middleware/upload'
import storage from '@/utils/storage'
import logger from '@/utils/logger'

const router = Router()

// Upload files
router.post('/upload', upload.array('files'), async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    if (!req.files || !Array.isArray(req.files) || req.files.length === 0) {
      res.status(400).json({
        error: 'No files provided',
        message: 'Please select at least one file to upload'
      })
      return
    }

    const uploadedFiles = []
    
    for (const file of req.files) {
      const savedFile = await storage.saveFile(file)
      uploadedFiles.push(savedFile)
    }

    logger.info(`Uploaded ${uploadedFiles.length} files`)
    
    res.json(uploadedFiles)
  } catch (error) {
    next(error)
  }
})

// Get all files
router.get('/', async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const files = await storage.getFiles()
    res.json(files)
  } catch (error) {
    next(error)
  }
})

// Delete a file
router.delete('/:fileId', async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { fileId } = req.params
    
    if (!fileId) {
      res.status(400).json({
        error: 'File ID required',
        message: 'Please provide a valid file ID'
      })
      return
    }

    await storage.deleteFile(fileId)
    logger.info(`Deleted file ${fileId}`)
    
    res.json({ message: 'File deleted successfully' })
  } catch (error) {
    if ((error as Error).message === 'File not found') {
      res.status(404).json({
        error: 'File not found',
        message: 'The requested file does not exist'
      })
      return
    }
    next(error)
  }
})

export default router