
const Skeleton = ({
  width = 'w-full',
  height = 'h-4',
  className = '',
  rounded = true,
}) => {
  return (
    <div
      className={`
        bg-gray-100 animate-pulse
        ${width} ${height}
        ${rounded ? 'rounded' : ''}
        ${className}
      `}
    />
  )
}

export default Skeleton

