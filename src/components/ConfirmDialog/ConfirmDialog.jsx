import { AnimatePresence, motion } from 'framer-motion'
import { playSound } from '../../utils/sound'
import './ConfirmDialog.css'

const panelVariants = {
  hidden: { opacity: 0, y: 16, scale: 0.97 },
  visible: { opacity: 1, y: 0, scale: 1, transition: { type: 'spring', stiffness: 420, damping: 32 } },
  exit: { opacity: 0, y: 10, scale: 0.98, transition: { duration: 0.15, ease: [0.4, 0, 1, 1] } },
}

export default function ConfirmDialog({
  open,
  title,
  description,
  confirmLabel = 'Confirmer',
  cancelLabel = 'Annuler',
  danger = true,
  onConfirm,
  onCancel,
}) {
  const handleConfirm = () => {
    if (danger) playSound('delete')
    onConfirm()
  }

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className="confirm-scrim"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.16 }}
          onClick={onCancel}
        >
          <motion.div
            className="confirm-dialog glass-panel"
            role="alertdialog"
            aria-modal="true"
            aria-labelledby="confirm-title"
            variants={panelVariants}
            initial="hidden"
            animate="visible"
            exit="exit"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 id="confirm-title">{title}</h3>
            <p>{description}</p>
            <div className="confirm-dialog__actions">
              <button className="btn btn-ghost" onClick={onCancel}>
                {cancelLabel}
              </button>
              <button
                className={`btn ${danger ? 'btn-danger' : 'btn-primary'}`}
                onClick={handleConfirm}
                autoFocus
              >
                {confirmLabel}
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
