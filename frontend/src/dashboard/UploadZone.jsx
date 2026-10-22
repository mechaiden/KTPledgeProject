import { useState } from 'react'

const ACCEPTED_TYPES = ['image/jpeg', 'image/png', 'application/pdf']

export default function UploadZone({ inputRef, onFiles, large = false }) {
  const [dragging, setDragging] = useState(false)

  function handleFiles(fileList) {
    const files = [...fileList].filter((f) => ACCEPTED_TYPES.includes(f.type))
    if (files.length) onFiles(files)
  }

  function openPicker() {
    inputRef.current?.click()
  }

  return (
    <>
      {/* Kept outside the clickable box so its click doesn't bubble up and reopen the picker */}
      <input
        ref={inputRef}
        type="file"
        accept={ACCEPTED_TYPES.join(',')}
        multiple
        hidden
        onChange={(e) => {
          handleFiles(e.target.files)
          e.target.value = '' // lets you pick the same file again
        }}
      />
      <div
        className={`upload-zone${dragging ? ' dragging' : ''}${large ? ' large' : ''}`}
        role="button"
        tabIndex={0}
        onClick={openPicker}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault()
            openPicker()
          }
        }}
        onDragOver={(e) => {
          e.preventDefault()
          setDragging(true)
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={(e) => {
          e.preventDefault()
          setDragging(false)
          handleFiles(e.dataTransfer.files)
        }}
      >
        <span className="upload-icon">⬆</span>
        <p><strong>Drop a receipt here</strong> or click to upload</p>
        <p className="hint">JPG, PNG or PDF</p>
      </div>
    </>
  )
}
