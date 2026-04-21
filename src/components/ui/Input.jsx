import { useId } from 'react'
const Input = ({
  label,
  error,
  helperText,
  type = 'text',
  className = '',
  id,
  ...props
}) => {
  const generatedId = useId()
  const inputId = id || generatedId

  return (
    <div className="w-full">
      {label && (
        <label htmlFor={inputId} className="block text-sm font-medium text-gray-900 mb-2">
          {label}
        </label>
      )}
      <input
        id={inputId}
        type={type}
        className={`
          w-full px-4 py-2 h-11
          border rounded
          text-base
          transition-colors duration-200
          focus:outline-none focus:ring-2 focus:ring-offset-0
          disabled:bg-gray-100 disabled:cursor-not-allowed
          ${error 
            ? 'border-error focus:ring-error' 
            : 'border-gray-400 focus:border-primary focus:ring-primary'
          }
          ${className}
        `}
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

export default Input

