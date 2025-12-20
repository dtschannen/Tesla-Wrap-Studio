import { X } from 'lucide-react'
import { createPortal } from 'react-dom'

interface UnsavedChangesDialogProps {
  isOpen: boolean
  onSave: () => void
  onDiscard: () => void
  onCancel: () => void
}

export function UnsavedChangesDialog({
  isOpen,
  onSave,
  onDiscard,
  onCancel,
}: UnsavedChangesDialogProps) {
  if (!isOpen) return null

  return createPortal(
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/80 backdrop-blur-sm">
      <div className="bg-[#1c1c1e] border border-white/10 rounded-2xl shadow-2xl w-full max-w-md mx-4 overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-white/10">
          <h2 className="text-xl font-bold text-white">Unsaved Changes</h2>
          <button
            onClick={onCancel}
            className="p-2 hover:bg-white/5 rounded-lg transition-colors"
          >
            <X className="w-5 h-5 text-white/60" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6">
          <p className="text-white/70 mb-6">
            You have unsaved changes. What would you like to do?
          </p>

          {/* Actions */}
          <div className="flex flex-col gap-3">
            <button
              onClick={onSave}
              className="w-full px-4 py-3 bg-tesla-red hover:bg-tesla-red/80 text-white font-medium rounded-xl transition-colors"
            >
              Save Changes
            </button>
            <button
              onClick={onDiscard}
              className="w-full px-4 py-3 bg-white/5 hover:bg-white/10 text-white font-medium rounded-xl transition-colors border border-white/10"
            >
              Discard Changes
            </button>
            <button
              onClick={onCancel}
              className="w-full px-4 py-3 text-white/60 hover:text-white font-medium rounded-xl transition-colors"
            >
              Cancel
            </button>
          </div>
        </div>
      </div>
    </div>,
    document.body
  )
}

