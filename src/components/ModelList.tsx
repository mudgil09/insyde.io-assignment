import React from 'react'
import { useEffect, useState } from 'react'
import { Paper, Text, Stack, Button, Group } from '@mantine/core'
import { File, Trash2 } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'

interface Model {
  id: string
  name: string
  file: string
  created_at: string
}

export interface ModelListProps {
  designs: Model[]
  viewMode: 'grid' | 'list'
  onModelSelect: (id: string) => void
  onModelDelete: (id: string) => void
}

export const ModelList: React.FC<ModelListProps> = ({
  designs,
  viewMode,
  onModelSelect,
  onModelDelete,
}) => {
  const formatDate = (dateString: string) => {
    const date = new Date(dateString)
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    })
  }

  if (designs.length === 0) {
    return (
      <div className="empty-state">
        <div className="empty-icon">📁</div>
        <h3>No Models Yet</h3>
        <p>Upload your first 3D model to get started</p>
      </div>
    )
  }

  return (
    <div className="model-grid">
      {designs.map((design) => (
        <div key={design.id} className="model-card">
          <div className="model-info">
            <h3>{design.name}</h3>
            <p>{formatDate(design.created_at)}</p>
          </div>
          <div className="model-actions">
            <button
              className="view-button"
              onClick={() => onModelSelect(design.id)}
            >
              View
            </button>
            <button
              className="delete-button"
              onClick={() => onModelDelete(design.id)}
            >
              Delete
            </button>
          </div>
        </div>
      ))}
    </div>
  )
} 