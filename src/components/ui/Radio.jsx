
const Radio = ({
  label,
  name,
  value,
  checked,
  onChange,
  disabled = false,
  className = '',
  ...props
}) => {
  return (
    <label className={`flex items-center cursor-pointer ${disabled ? 'opacity-50 cursor-not-allowed' : ''} ${className}`}>
      <input
        type="radio"
        name={name}
        value={value}
        checked={checked}
        onChange={onChange}
        disabled={disabled}
        className="w-5 h-5 border-gray-400 text-primary focus:ring-2 focus:ring-primary focus:ring-offset-0 cursor-pointer"
        {...props}
      />
      {label && (
        <span className="ml-3 text-base text-gray-900">{label}</span>
      )}
    </label>
  )
}

export default Radio

