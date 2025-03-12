import React from 'react'
import { Dropzone } from '@mantine/dropzone'
import { Text, Progress, Paper, Stack, Group } from '@mantine/core'
import { Upload, CheckCircle, AlertCircle } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'

export interface FileUploadProps {
  onUpload: (file: File) => Promise<void>
  isProcessing: boolean
  accept: string
  maxSize: number
}

export const FileUpload: React.FC<FileUploadProps> = ({ onUpload, isProcessing, accept, maxSize }) => {
  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault()
    const file = e.dataTransfer.files[0]
    if (file) onUpload(file)
  }

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) onUpload(file)
  }

  return (
    <div 
      className="upload-zone"
      onDrop={handleDrop}
      onDragOver={(e) => e.preventDefault()}
    >
      <input
        type="file"
        onChange={handleChange}
        accept={accept}
        disabled={isProcessing}
        style={{ display: 'none' }}
        id="file-input"
      />
      <label htmlFor="file-input" style={{ cursor: 'pointer' }}>
        {isProcessing ? (
          <div>Processing...</div>
        ) : (
          <>
            <div className="upload-icon">📁</div>
            <div className="upload-text">
              Drag & drop or click to upload
              <div className="upload-info">
                Supported: {accept} (Max {Math.round(maxSize / 1024 / 1024)}MB)
              </div>
            </div>
          </>
        )}
      </label>
    </div>
  )
} 