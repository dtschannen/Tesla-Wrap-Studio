import { useState, useEffect } from 'react'
import { useEditorStore } from '../state/useEditorStore'
import { useAuth } from '../../contexts/AuthContext'
import { carModels } from '../../data/carModels'
import { exportPngAsDataUrl, projectToBlob, publishDesign } from '../../utils/publish'
import type { Stage } from 'konva/lib/Stage'

interface PublishDialogProps {
  isOpen: boolean
  onClose: () => void
  stageRef: React.RefObject<Stage | null>
}

export function PublishDialog({ isOpen, onClose, stageRef }: PublishDialogProps) {
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)
  
  const { user, signIn, signUp } = useAuth()
  const { projectName, currentModelId, getSerializedState } = useEditorStore()
  const [isLoginMode, setIsLoginMode] = useState(true)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [authError, setAuthError] = useState<string | null>(null)
  const [authLoading, setAuthLoading] = useState(false)

  // Initialize title and preview when dialog opens
  useEffect(() => {
    if (isOpen) {
      setTitle(projectName)
      setDescription('')
      setError(null)
      setSuccess(null)
      setPreviewUrl(null)
      
      // Generate preview
      if (stageRef.current) {
        exportPngAsDataUrl(stageRef.current).then((dataUrl) => {
          if (dataUrl) {
            setPreviewUrl(dataUrl)
          }
        })
      }
    }
  }, [isOpen, projectName, stageRef])

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault()
    setAuthError(null)
    setAuthLoading(true)

    const { error } = isLoginMode
      ? await signIn(email, password)
      : await signUp(email, password)

    if (error) {
      setAuthError(error.message)
    } else {
      setEmail('')
      setPassword('')
    }

    setAuthLoading(false)
  }

  const handlePublish = async () => {
    if (!user) {
      setError('Please log in first')
      return
    }

    if (!title.trim()) {
      setError('Please enter a title')
      return
    }

    if (!stageRef.current) {
      setError('Canvas not available')
      return
    }

    setUploading(true)
    setError(null)

    try {
      // Export PNG
      const previewDataUrl = await exportPngAsDataUrl(stageRef.current)
      if (!previewDataUrl) {
        throw new Error('Failed to export preview image')
      }

      // Get project data and convert to blob
      const projectData = getSerializedState()
      const projectBlob = await projectToBlob(projectData)

      // Publish to gallery
      const { designId, error: publishError } = await publishDesign(
        title,
        description || null,
        currentModelId,
        previewDataUrl,
        projectBlob,
        user.id
      )

      if (publishError) {
        throw publishError
      }

      // Success!
      const galleryBaseUrl = import.meta.env.VITE_GALLERY_URL || 
        window.location.origin.replace('studio', 'gallery') || 
        'https://gallery.tesla-wrap.com'
      const galleryUrl = `${galleryBaseUrl}/design/${designId}`
      setSuccess(`Design published! View it in the gallery.`)
      
      // Close dialog after a delay
      setTimeout(() => {
        onClose()
        window.open(galleryUrl, '_blank')
      }, 2000)
    } catch (err: any) {
      setError(err.message || 'Failed to publish design. Please try again.')
      setUploading(false)
    }
  }

  if (!isOpen) return null

  // Show login/signup if not authenticated
  if (!user) {
    return (
      <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-[200] flex items-center justify-center p-4">
        <div className="bg-gradient-to-br from-tesla-black via-[#2a2b2c] to-tesla-black border border-tesla-dark rounded-xl p-6 max-w-md w-full shadow-2xl">
          <h2 className="text-2xl font-bold text-white mb-4">
            {isLoginMode ? 'Login to Publish' : 'Sign Up to Publish'}
          </h2>

          <form onSubmit={handleAuth} className="space-y-4">
            {authError && (
              <div className="p-3 bg-red-500/20 border border-red-500/50 rounded text-red-200 text-sm">
                {authError}
              </div>
            )}

            <div>
              <label htmlFor="email" className="block text-sm font-medium text-tesla-light mb-2">
                Email
              </label>
              <input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className="w-full px-4 py-2 bg-tesla-black/70 border border-tesla-dark rounded text-tesla-light focus:outline-none focus:ring-2 focus:ring-tesla-red"
              />
            </div>

            <div>
              <label htmlFor="password" className="block text-sm font-medium text-tesla-light mb-2">
                Password
              </label>
              <input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                minLength={6}
                className="w-full px-4 py-2 bg-tesla-black/70 border border-tesla-dark rounded text-tesla-light focus:outline-none focus:ring-2 focus:ring-tesla-red"
              />
            </div>

            <button
              type="submit"
              disabled={authLoading}
              className="w-full py-2 bg-tesla-red hover:bg-tesla-red/80 text-white font-semibold rounded transition-colors disabled:opacity-50"
            >
              {authLoading ? (isLoginMode ? 'Logging in...' : 'Signing up...') : (isLoginMode ? 'Login' : 'Sign Up')}
            </button>
          </form>

          <div className="mt-4 text-center">
            <button
              onClick={() => {
                setIsLoginMode(!isLoginMode)
                setAuthError(null)
              }}
              className="text-tesla-red hover:underline text-sm"
            >
              {isLoginMode ? "Don't have an account? Sign up" : 'Already have an account? Login'}
            </button>
          </div>

          <button
            onClick={onClose}
            className="mt-4 w-full py-2 bg-tesla-black/70 hover:bg-tesla-black text-tesla-light rounded transition-colors"
          >
            Cancel
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-[200] flex items-center justify-center p-4">
      <div className="bg-gradient-to-br from-tesla-black via-[#2a2b2c] to-tesla-black border border-tesla-dark rounded-xl p-6 max-w-2xl w-full shadow-2xl max-h-[90vh] overflow-y-auto">
        <h2 className="text-2xl font-bold text-white mb-4">Publish to Gallery</h2>

        {error && (
          <div className="mb-4 p-3 bg-red-500/20 border border-red-500/50 rounded text-red-200 text-sm">
            {error}
          </div>
        )}

        {success && (
          <div className="mb-4 p-3 bg-green-500/20 border border-green-500/50 rounded text-green-200 text-sm">
            {success}
          </div>
        )}

        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-tesla-light mb-2">
              Title *
            </label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              required
              className="w-full px-4 py-2 bg-tesla-black/70 border border-tesla-dark rounded text-tesla-light focus:outline-none focus:ring-2 focus:ring-tesla-red"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-tesla-light mb-2">
              Description
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
              className="w-full px-4 py-2 bg-tesla-black/70 border border-tesla-dark rounded text-tesla-light focus:outline-none focus:ring-2 focus:ring-tesla-red resize-none"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-tesla-light mb-2">
              Model
            </label>
            <div className="px-4 py-2 bg-tesla-black/70 border border-tesla-dark rounded text-tesla-light">
              {carModels.find(m => m.id === currentModelId)?.name || currentModelId}
            </div>
          </div>

          {previewUrl && (
            <div>
              <label className="block text-sm font-medium text-tesla-light mb-2">
                Preview
              </label>
              <div className="relative w-full aspect-square max-w-md bg-tesla-black rounded overflow-hidden border border-tesla-dark">
                <img src={previewUrl} alt="Preview" className="w-full h-full object-cover" />
              </div>
            </div>
          )}

          <div className="flex gap-3 pt-4">
            <button
              onClick={handlePublish}
              disabled={uploading || !title.trim()}
              className="flex-1 py-2 bg-tesla-red hover:bg-tesla-red/80 text-white font-semibold rounded transition-colors disabled:opacity-50"
            >
              {uploading ? 'Publishing...' : 'Publish'}
            </button>
            <button
              onClick={onClose}
              disabled={uploading}
              className="px-6 py-2 bg-tesla-black/70 hover:bg-tesla-black text-tesla-light rounded transition-colors disabled:opacity-50"
            >
              Cancel
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

