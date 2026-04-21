import { useId } from 'react'
const Select = ({
  label,
  error,
  helperText,
  options = [],
  placeholder = 'Select an option',
  className = '',
  id,
  ...props
}) => {
  const generatedId = useId()
  const selectId = id || generatedId

  return (
    <div className="w-full">
      {label && (
        <label htmlFor={selectId} className="block text-sm font-medium text-gray-900 mb-2">
          {label}
        </label>
      )}
      <select
        id={selectId}
        className={`
          w-full px-4 py-2 h-11
          border rounded
          text-base
          bg-white
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
      >
        {placeholder && (
          <option value="" disabled>
            {placeholder}
          </option>
        )}
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
      {error && (
        <p className="mt-2 text-sm text-error">{error}</p>
      )}
      {helperText && !error && (
        <p className="mt-2 text-sm text-gray-700">{helperText}</p>
      )}
    </div>
  )
}

export default Select

