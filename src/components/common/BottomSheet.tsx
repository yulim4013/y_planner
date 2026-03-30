import { useEffect, useRef, useCallback, type ReactNode } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import './BottomSheet.css'

interface BottomSheetProps {
  isOpen: boolean
  onClose: () => void
  children: ReactNode
  title?: string
  fullScreen?: boolean
}

export default function BottomSheet({ isOpen, onClose, children, title, fullScreen }: BottomSheetProps) {
  const contentRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden'
    } else {
      document.body.style.overflow = ''
    }
    return () => {
      document.body.style.overflow = ''
    }
  }, [isOpen])

  const handleAnimationComplete = useCallback(() => {
    if (contentRef.current) {
      contentRef.current.scrollTop = 0
    }
  }, [])

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          <motion.div
            className="bottom-sheet-overlay"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            onClick={onClose}
          />
          <motion.div
            className={`bottom-sheet ${fullScreen ? 'bottom-sheet-full' : 'glass-strong'}`}
            initial={{ y: '100%' }}
            animate={{ y: 0 }}
            exit={{ y: '100%' }}
            transition={{ type: 'spring', damping: 30, stiffness: 300 }}
            onAnimationComplete={handleAnimationComplete}
          >
            {fullScreen ? (
              <div className="bs-topbar">
                <button className="bs-close-btn" onClick={onClose} type="button">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <line x1="18" y1="6" x2="6" y2="18" />
                    <line x1="6" y1="6" x2="18" y2="18" />
                  </svg>
                </button>
                {title && <span className="bs-topbar-title">{title}</span>}
                <div className="bs-topbar-spacer" />
              </div>
            ) : (
              <>
                <div className="bottom-sheet-handle" />
                {title && <h2 className="bottom-sheet-title">{title}</h2>}
              </>
            )}
            <div className="bottom-sheet-content" ref={contentRef}>
              {children}
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  )
}
