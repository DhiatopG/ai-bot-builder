// File: src/app/dashboard/upload/[botId]/page.tsx
'use client'

import { useEffect, useState } from 'react'
import { Upload, FileText, Check, X, Calendar } from 'lucide-react'
import { useParams, useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase/browser'
import toast from 'react-hot-toast'

export default function UploadPDFPage() {
  const { botId } = useParams<{ botId: string }>()
  const router = useRouter()
  const [dragActive, setDragActive] = useState(false)
  const [uploadedFile, setUploadedFile] = useState<File | null>(null)
  const [isUploading, setIsUploading] = useState(false)
  const [calendarUrl, setCalendarUrl] = useState<string | null>(null)

  useEffect(() => {
    if (!botId) return
    const fetchCalendar = async () => {
      const { data, error } = await supabase
        .from('bots')
        .select('calendar_url')
        .eq('id', botId)
        .single()

      if (error) {
        console.error('Error fetching calendar:', error)
      } else {
        setCalendarUrl(data?.calendar_url || null)
      }
    }
    fetchCalendar()
  }, [botId])

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true)
    } else if (e.type === 'dragleave') {
      setDragActive(false)
    }
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setDragActive(false)
    const file = e.dataTransfer.files?.[0]
    if (file?.type === 'application/pdf') {
      setUploadedFile(file)
    }
  }

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file?.type === 'application/pdf') {
      setUploadedFile(file)
    }
  }

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 Bytes'
    const k = 1024
    const sizes = ['Bytes', 'KB', 'MB', 'GB']
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
  }

  const handleUpload = async () => {
    if (!uploadedFile || !botId) return

    setIsUploading(true)
    const fileName = `${Date.now()}-${uploadedFile.name}`

    const { error } = await supabase.storage
      .from('pdfs')
      .upload(`${botId}/${fileName}`, uploadedFile)

    setIsUploading(false)

    if (error) {
      toast.error('Upload failed')
    } else {
      toast.success('File uploaded successfully')
      setUploadedFile(null)
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-white relative">
      {/* X Button */}
      <button
        onClick={() => router.back()}
        className="absolute top-4 right-4 z-50 text-gray-600 hover:text-gray-900 cursor-pointer"
      >
        <X className="w-6 h-6" />
      </button>

      {/* Header */}
      <div className="bg-white shadow-sm border-b border-blue-100">
        <div className="max-w-6xl mx-auto px-6 py-8">
          <h1 className="text-3xl font-bold text-blue-900 mb-2">Knowledge Base Management</h1>
          <p className="text-blue-600">Upload PDF documents to train your assistant</p>
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-6 py-12">
        <div className="max-w-2xl mx-auto">
          {/* PDF Upload Card */}
          <div className="bg-white rounded-xl shadow-lg border border-blue-100 overflow-hidden">
            <div className="bg-gradient-to-r from-blue-600 to-blue-700 px-6 py-4">
              <div className="flex items-center gap-3">
                <div className="bg-white/20 p-2 rounded-lg">
                  <FileText className="w-5 h-5 text-white" />
                </div>
                <h2 className="text-xl font-semibold text-white">Upload PDF Documents</h2>
              </div>
            </div>

            <div className="p-6">
              <div
                className={`border-2 border-dashed rounded-xl p-8 text-center transition-all duration-300 ${
                  dragActive
                    ? 'border-blue-500 bg-blue-50'
                    : uploadedFile
                    ? 'border-green-300 bg-green-50'
                    : 'border-blue-200 hover:border-blue-400 hover:bg-blue-50'
                }`}
                onDragEnter={handleDrag}
                onDragLeave={handleDrag}
                onDragOver={handleDrag}
                onDrop={handleDrop}
              >
                {uploadedFile ? (
                  <div className="space-y-4">
                    <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto">
                      <Check className="w-8 h-8 text-green-600" />
                    </div>
                    <div>
                      <h3 className="font-semibold text-green-800 mb-1">{uploadedFile.name}</h3>
                      <p className="text-sm text-green-600">{formatFileSize(uploadedFile.size)}</p>
                    </div>
                    <button
                      onClick={() => setUploadedFile(null)}
                      className="text-sm text-blue-600 hover:text-blue-800 font-medium"
                    >
                      Upload different file
                    </button>
                  </div>
                ) : (
                  <div className="space-y-4">
                    <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mx-auto">
                      <Upload className="w-8 h-8 text-blue-600" />
                    </div>
                    <div>
                      <h3 className="font-semibold text-blue-900 mb-2">
                        Drop your PDF here or click to browse
                      </h3>
                      <p className="text-blue-600 mb-4">
                        Supports PDF files up to 10MB
                      </p>
                      <input
                        type="file"
                        accept=".pdf"
                        onChange={handleFileChange}
                        className="hidden"
                        id="pdf-upload"
                      />
                      <label
                        htmlFor="pdf-upload"
                        className="inline-flex items-center gap-2 bg-blue-600 text-white px-6 py-3 rounded-lg font-medium hover:bg-blue-700 transition-colors cursor-pointer"
                      >
                        <Upload className="w-4 h-4" />
                        Choose File
                      </label>
                    </div>
                  </div>
                )}
              </div>

              {uploadedFile && (
                <div className="mt-6">
                  <button
                    onClick={handleUpload}
                    disabled={isUploading}
                    className="w-full bg-gradient-to-r from-blue-600 to-blue-700 text-white py-3 px-6 rounded-lg font-medium hover:from-blue-700 hover:to-blue-800 transition-all duration-200 shadow-md hover:shadow-lg"
                  >
                    {isUploading ? 'Uploading...' : 'Process Document'}
                  </button>
                </div>
              )}
            </div>
          </div>

          {/* Upload Status */}
          <div className="mt-8 bg-white rounded-xl shadow-lg border border-blue-100 p-6">
            <h3 className="text-lg font-semibold text-blue-900 mb-4">Upload Status</h3>
            <div className="flex items-center gap-3 p-4 bg-blue-50 rounded-lg">
              <div
                className={`w-3 h-3 rounded-full ${uploadedFile ? 'bg-green-500' : 'bg-gray-300'}`}
              ></div>
              <span className="text-blue-800">
                {uploadedFile ? 'PDF Document Ready for Upload' : 'No PDF uploaded'}
              </span>
            </div>
          </div>

          {/* Calendar Section */}
          {calendarUrl && (
            <div className="mt-8 bg-white rounded-xl shadow-lg border border-blue-100 p-6">
              <div className="flex items-center gap-3 mb-4">
                <Calendar className="w-5 h-5 text-blue-600" />
                <h3 className="text-lg font-semibold text-blue-900">Booking Calendar</h3>
              </div>
              {calendarUrl.includes('calendly.com') || calendarUrl.includes('embed') ? (
                <iframe
                  src={calendarUrl}
                  className="w-full h-[600px] border rounded-lg"
                  loading="lazy"
                ></iframe>
              ) : (
                <a
                  href={calendarUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 bg-blue-600 text-white px-6 py-3 rounded-lg font-medium hover:bg-blue-700 transition-colors"
                >
                  <Calendar className="w-4 h-4" />
                  Open Calendar
                </a>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
