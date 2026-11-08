import { useEffect, useRef, useState } from 'react'
import { Upload, X } from 'lucide-react'

const ICON = { size: 16, strokeWidth: 2, 'aria-hidden': true }
const ACCEPT = 'image/*,.pdf'

// Add receipts: drop files, take a photo (phones open the camera), or choose files
export default function AddSheet({ onFiles, onClose }) {
  const [over, setOver] = useState(false)
  const cameraRef = useRef(null)
  const filesRef = useRef(null)
  const closeRef = useRef(null)

  useEffect(() => {
    closeRef.current?.focus()
    const onKey = (e) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  const pick = (e) => {
    // Copy first: clearing the input empties its live FileList
    if (e.target.files?.length) onFiles([...e.target.files])
    e.target.value = ''
  }

  return (
    <div className="scrim" onPointerDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="sheet" role="dialog" aria-modal="true" aria-labelledby="add-h">
        <div className="sheet-head">
          <h2 id="add-h">Add receipts</h2>
          <button ref={closeRef} type="button" className="icon-button sheet-close" onClick={onClose} aria-label="Close">
            <X {...ICON} />
          </button>
        </div>
        <button
          type="button"
          className={`drop-target${over ? ' is-over' : ''}`}
          onClick={() => filesRef.current?.click()}
          onDragOver={(e) => {
            if (!e.dataTransfer.types.includes('Files')) return
            e.preventDefault()
            setOver(true)
          }}
          onDragLeave={() => setOver(false)}
          onDrop={(e) => {
            e.preventDefault()
            setOver(false)
            if (e.dataTransfer.files.length) onFiles(e.dataTransfer.files)
          }}
        >
          <Upload size={22} strokeWidth={2} aria-hidden="true" />
          <span className="drop-title">Drop photos or PDFs here</span>
          <span className="drop-sub">JPG, PNG or PDF, up to 10 MB each</span>
        </button>
        <div className="sheet-actions">
          <button type="button" className="button primary" onClick={() => cameraRef.current?.click()}>Take a photo</button>
          <button type="button" className="button" onClick={() => filesRef.current?.click()}>Choose files</button>
        </div>
        <p className="sheet-note">Shoebox reads each receipt on its own server and only asks you about the ones it isn’t sure of.</p>
        <input ref={cameraRef} type="file" accept="image/*" capture="environment" hidden onChange={pick} />
        <input ref={filesRef} type="file" accept={ACCEPT} multiple hidden onChange={pick} />
      </div>
    </div>
  )
}
