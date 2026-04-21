import PropTypes from 'prop-types'

const TokenConversionInfo = ({ variant = 'default', className = '' }) => {
  const conversionText = `100 INR = 1 XLM`

  if (variant === 'compact') {
    return (
      <div className={`flex items-center gap-1 text-xs text-gray-500 ${className}`}>
        <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
        <span>{conversionText}</span>
      </div>
    )
  }

  if (variant === 'badge') {
    return (
      <div className={`inline-flex items-center gap-1.5 px-2 py-1 bg-blue-50 border border-blue-200 rounded text-xs text-blue-700 ${className}`}>
        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
        <span className="font-medium">{conversionText}</span>
      </div>
    )
  }

  // Default variant - full info box
  return (
    <div className={`p-3 bg-blue-50 border border-blue-200 rounded-lg ${className}`}>
      <div className="flex items-start gap-2">
        <svg className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
        <div className="flex-1">
          <p className="text-sm font-semibold text-blue-900 mb-1">Token Conversion Rate</p>
          <p className="text-sm text-blue-800">
            <span className="font-medium">{conversionText}</span>
          </p>
          <p className="text-xs text-blue-700 mt-1">
            Payments are processed using XLM tokens via secure blockchain escrow
          </p>
        </div>
      </div>
    </div>
  )
}

TokenConversionInfo.propTypes = {
  variant: PropTypes.oneOf(['default', 'compact', 'badge']),
  className: PropTypes.string,
}

export default TokenConversionInfo
