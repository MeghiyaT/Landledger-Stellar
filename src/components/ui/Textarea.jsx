import { useEffect, useId, useRef } from 'react'
const Textarea = ({
  label,
  error,
  helperText,
  className = '',
  value,
  onChange,
  minRows = 4,
  id,
  ...props
}) => {
  const textareaRef = useRef(null)
  const generatedId = useId()
  const textareaId = id || generatedId

  // Auto-resize function
  const autoResize = () => {
    const textarea = textareaRef.current
    if (textarea) {
      // Reset height to auto to get the correct scrollHeight
      textarea.style.height = 'auto'
      // Set height to scrollHeight to fit content
      textarea.style.height = `${textarea.scrollHeight}px`
    }
  }

  // Auto-resize on value change
  useEffect(() => {
    autoResize()
  }, [value])

  // Auto-resize on mount
  useEffect(() => {
    autoResize()
  }, [])

  const handleChange = (e) => {
    if (onChange) {
      onChange(e)
    }
    // Trigger resize after state update
    setTimeout(autoResize, 0)
  }

  return (
    <div className="w-full">
      {label && (
        <label htmlFor={textareaId} className="block text-sm font-medium text-gray-900 mb-2">
          {label}
        </label>
      )}
      <textarea
        id={textareaId}
        ref={textareaRef}
        className={`
          w-full px-4 py-2
          border rounded
          text-base
          transition-colors duration-200
          focus:outline-none focus:ring-2 focus:ring-offset-0
          disabled:bg-gray-100 disabled:cursor-not-allowed
          resize-none
          ${error 
            ? 'border-error focus:ring-error' 
            : 'border-gray-400 focus:border-primary focus:ring-primary'
          }
          ${className}
        `}
        rows={minRows}
        value={value}
        onChange={handleChange}
        {...props}
      />
      {error && (
        <p className="mt-2 text-sm text-error">{error}</p>
      )}
      {helperText && !error && (
        <p className="mt-2 text-sm text-gray-700">{helperText}</p>
      )}
    </div>
  )
}

export default Textarea


