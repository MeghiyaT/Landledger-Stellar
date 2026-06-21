/**
 * SigningProgressModal
 *
 * A polished modal shown before + during every Freighter signing popup.
 * Replaces the plain toast messages with a rich, step-aware UI that tells
 * users exactly what they're signing and why.
 *
 * Props:
 *  isOpen       – boolean
 *  onClose      – () => void  (only allowed when not actively signing)
 *  onConfirm    – () => void  (called when user clicks the CTA button)
 *  step         – 'preview' | 'signing' | 'confirming' | 'success' | 'error'
 *  title        – modal heading
 *  description  – paragraph shown in the preview step
 *  actions      – array of { icon, label, detail } – bullet list of what will happen on-chain
 *  stepLabel    – e.g. "Step 2 of 4 · Seller"
 *  successTitle – heading shown on success
 *  successMsg   – body text shown on success
 *  txHash       – optional tx hash to show on success
 *  errorMsg     – error text shown on failure
 *  confirmText  – CTA button label (default "Sign in Freighter")
 */

const STEP_ICONS = {
  preview: (
    <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8}
        d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
    </svg>
  ),
  signing: (
    <svg className="w-8 h-8 animate-pulse" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8}
        d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
    </svg>
  ),
}

const Spinner = () => (
  <div className="relative w-16 h-16 mx-auto mb-6">
    {/* Outer ring */}
    <div className="absolute inset-0 rounded-full border-4 border-indigo-100" />
    {/* Spinning arc */}
    <div className="absolute inset-0 rounded-full border-4 border-transparent border-t-indigo-600 animate-spin" />
    {/* Inner pulse dot */}
    <div className="absolute inset-0 flex items-center justify-center">
      <div className="w-4 h-4 bg-indigo-600 rounded-full animate-ping opacity-60" />
    </div>
  </div>
)

const ActionBullet = ({ icon, label, detail }) => (
  <div className="flex items-start gap-3 py-2.5 border-b border-gray-100 last:border-0">
    <div className="w-7 h-7 rounded-full bg-indigo-50 flex items-center justify-center flex-shrink-0 mt-0.5 text-indigo-600">
      {icon}
    </div>
    <div>
      <p className="text-sm font-semibold text-gray-800">{label}</p>
      {detail && <p className="text-xs text-gray-500 mt-0.5">{detail}</p>}
    </div>
  </div>
)

const SigningProgressModal = ({
  isOpen,
  onClose,
  onConfirm,
  step = 'preview',
  title,
  description,
  actions = [],
  stepLabel,
  successTitle = 'Transaction Confirmed!',
  successMsg = 'The transaction was successfully broadcast to the Stellar network.',
  txHash,
  errorMsg,
  confirmText = 'Sign in Freighter',
}) => {
  if (!isOpen) return null

  const canClose = step !== 'signing' && step !== 'confirming'

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      onClick={canClose ? onClose : undefined}
    >
      {/* Backdrop */}
      <div className="fixed inset-0 bg-black/60 backdrop-blur-sm transition-opacity duration-300" aria-hidden="true" />

      {/* Panel */}
      <div
        className="relative bg-white rounded-2xl shadow-2xl w-full max-w-md transform transition-all duration-300 overflow-hidden"
        onClick={e => e.stopPropagation()}
      >
        {/* Gradient header bar */}
        <div className="h-1.5 w-full bg-gradient-to-r from-indigo-500 via-violet-500 to-purple-500" />

        {/* Close button */}
        {canClose && (
          <button
            onClick={onClose}
            className="absolute top-4 right-4 text-gray-400 hover:text-gray-600 transition-colors focus:outline-none focus:ring-2 focus:ring-indigo-400 rounded-lg p-1"
            aria-label="Close"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        )}

        <div className="p-6">

          {/* ── PREVIEW ── */}
          {step === 'preview' && (
            <>
              {/* Step badge */}
              {stepLabel && (
                <div className="inline-flex items-center gap-1.5 bg-indigo-50 text-indigo-700 text-[11px] font-bold uppercase tracking-widest px-3 py-1 rounded-full mb-4">
                  <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-12a1 1 0 10-2 0v4a1 1 0 00.293.707l2.828 2.829a1 1 0 101.415-1.415L11 9.586V6z" clipRule="evenodd" />
                  </svg>
                  {stepLabel}
                </div>
              )}

              {/* Icon + title */}
              <div className="flex items-center gap-3 mb-3">
                <div className="w-10 h-10 rounded-xl bg-indigo-600 flex items-center justify-center text-white flex-shrink-0">
                  {STEP_ICONS.preview}
                </div>
                <h2 className="text-lg font-bold text-gray-900 leading-snug">{title}</h2>
              </div>

              {description && (
                <p className="text-sm text-gray-500 mb-4 leading-relaxed">{description}</p>
              )}

              {/* What will happen */}
              {actions.length > 0 && (
                <div className="bg-gray-50 rounded-xl px-4 py-1 mb-5">
                  <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest pt-3 pb-1">What gets signed</p>
                  {actions.map((a, i) => (
                    <ActionBullet key={i} icon={a.icon} label={a.label} detail={a.detail} />
                  ))}
                </div>
              )}

              {/* Freighter note */}
              <div className="flex items-center gap-2 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 mb-5">
                <svg className="w-4 h-4 text-amber-500 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                </svg>
                <p className="text-xs text-amber-700 font-medium">Freighter will open — do not close that window until it confirms.</p>
              </div>

              {/* CTA */}
              <button
                id="signing-modal-confirm-btn"
                onClick={onConfirm}
                className="w-full py-3 px-4 bg-indigo-600 hover:bg-indigo-700 active:bg-indigo-800 text-white font-semibold rounded-xl transition-colors duration-150 flex items-center justify-center gap-2 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                </svg>
                {confirmText}
              </button>
            </>
          )}

          {/* ── SIGNING / CONFIRMING ── */}
          {(step === 'signing' || step === 'confirming') && (
            <div className="text-center py-6">
              <Spinner />
              <h3 className="text-lg font-bold text-gray-900 mb-2">
                {step === 'signing' ? 'Waiting for Freighter…' : 'Broadcasting to Stellar…'}
              </h3>
              <p className="text-sm text-gray-500 max-w-xs mx-auto">
                {step === 'signing'
                  ? 'Please approve the transaction in the Freighter window. Do not close or navigate away.'
                  : 'Transaction signed. Waiting for the Stellar network to confirm the block…'}
              </p>
              {step === 'confirming' && (
                <div className="mt-4 flex items-center justify-center gap-1.5 text-xs text-indigo-600 font-medium">
                  <span className="w-2 h-2 bg-indigo-500 rounded-full animate-bounce [animation-delay:0ms]" />
                  <span className="w-2 h-2 bg-indigo-500 rounded-full animate-bounce [animation-delay:150ms]" />
                  <span className="w-2 h-2 bg-indigo-500 rounded-full animate-bounce [animation-delay:300ms]" />
                  <span className="ml-1">Polling ledger</span>
                </div>
              )}
            </div>
          )}

          {/* ── SUCCESS ── */}
          {step === 'success' && (
            <div className="text-center py-4">
              <div className="w-16 h-16 bg-emerald-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <svg className="w-8 h-8 text-emerald-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
              </div>
              <h3 className="text-xl font-bold text-gray-900 mb-2">{successTitle}</h3>
              <p className="text-sm text-gray-500 mb-5 leading-relaxed">{successMsg}</p>

              {txHash && (
                <div className="bg-gray-50 border border-gray-100 rounded-xl p-3 mb-5 text-left">
                  <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1">Transaction Hash</p>
                  <p className="text-xs font-mono text-gray-600 break-all">{txHash}</p>
                  <a
                    href={`https://stellar.expert/explorer/testnet/tx/${txHash}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 text-xs text-indigo-600 hover:text-indigo-800 font-medium mt-2 transition-colors"
                  >
                    View on Stellar Expert
                    <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                    </svg>
                  </a>
                </div>
              )}

              <button
                onClick={onClose}
                className="w-full py-3 px-4 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold rounded-xl transition-colors duration-150 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:ring-offset-2"
              >
                Done
              </button>
            </div>
          )}

          {/* ── ERROR ── */}
          {step === 'error' && (
            <div className="text-center py-4">
              <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <svg className="w-8 h-8 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <h3 className="text-lg font-bold text-gray-900 mb-2">Transaction Failed</h3>
              <p className="text-sm text-gray-500 mb-5 leading-relaxed">{errorMsg || 'Something went wrong. Please try again.'}</p>
              <div className="flex gap-3">
                <button
                  onClick={onClose}
                  className="flex-1 py-2.5 px-4 border border-gray-300 text-gray-700 font-semibold rounded-xl hover:bg-gray-50 transition-colors focus:outline-none focus:ring-2 focus:ring-gray-300"
                >
                  Close
                </button>
                <button
                  onClick={onConfirm}
                  className="flex-1 py-2.5 px-4 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold rounded-xl transition-colors focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2"
                >
                  Try Again
                </button>
              </div>
            </div>
          )}

        </div>
      </div>
    </div>
  )
}

export default SigningProgressModal
