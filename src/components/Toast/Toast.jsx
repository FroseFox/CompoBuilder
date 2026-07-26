import { motion } from 'framer-motion'
import './Toast.css'

export default function Toast({ message, tone = 'default' }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 16, scale: 0.96 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: 8 }}
      transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
      className={`toast toast--${tone}`}
      role="status"
    >
      {message}
    </motion.div>
  )
}
