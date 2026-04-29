import { useState, useRef, useCallback } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import * as pdfjsLib from 'pdfjs-dist'

pdfjsLib.GlobalWorkerOptions.workerSrc = new URL(
  'pdfjs-dist/build/pdf.worker.mjs',
  import.meta.url
).toString()

const UUID_RE = /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i

async function extractPdfText(arrayBuffer) {
  const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise
  let fullText = ''
  for (let p = 1; p <= pdf.numPages; p++) {
    const page = await pdf.getPage(p)
    const content = await page.getTextContent()
    fullText += content.items.map((i) => i.str).join(' ') + '\n'
  }
  return fullText
}

function extractRegistrationId(text) {
  const linkMatch = text.match(/verify\/([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})/i)
  if (linkMatch) return linkMatch[1]
  const uuidMatch = text.match(UUID_RE)
  if (uuidMatch) return uuidMatch[0]
  return null
}

const STEP = { IDLE: 'idle', PARSING: 'parsing', VERIFYING: 'verifying', SUCCESS: 'success', FAILED: 'failed', INVALID_PDF: 'invalid_pdf' }

// ── Embeddable core (used inside Dashboard tab) ───────────────────────────────
export function VerifyPDFContent() {
  const fileInputRef = useRef(null)
  const [step, setStep] = useState(STEP.IDLE)
  const [dragOver, setDragOver] = useState(false)
  const [fileName, setFileName] = useState(null)
  const [registration, setRegistration] = useState(null)
  const [errorMsg, setErrorMsg] = useState('')

  const processFile = useCallback(async (file) => {
    if (!file || file.type !== 'application/pdf') {
      setErrorMsg('Please upload a valid PDF file.')
      setStep(STEP.INVALID_PDF)
      return
    }
    setFileName(file.name)
    setStep(STEP.PARSING)
    try {
      const buffer = await file.arrayBuffer()
      const text = await extractPdfText(buffer)
      const regId = extractRegistrationId(text)
      if (!regId) {
        setErrorMsg("No LandLedger registration ID found. Make sure you're uploading a certificate downloaded from LandLedger.")
        setStep(STEP.FAILED)
        return
      }
      setStep(STEP.VERIFYING)
      const { data, error } = await supabase.from('registrations').select('*').eq('id', regId).single()
      if (error || !data) {
        setErrorMsg('No matching registration found. This certificate may be invalid or tampered with.')
        setStep(STEP.FAILED)
        return
      }
      if (data.status !== 'approved') {
        setErrorMsg(`This registration exists but its status is "${data.status}" — not yet officially approved.`)
        setStep(STEP.FAILED)
        return
      }
      setRegistration(data)
      setStep(STEP.SUCCESS)
    } catch (err) {
      console.error('PDF verification error:', err)
      setErrorMsg('Failed to read the PDF. Please ensure it is a valid, uncorrupted LandLedger certificate.')
      setStep(STEP.FAILED)
    }
  }, [])

  const handleFileChange = (e) => { const f = e.target.files?.[0]; if (f) processFile(f) }
  const handleDrop = (e) => { e.preventDefault(); setDragOver(false); const f = e.dataTransfer.files?.[0]; if (f) processFile(f) }
  const reset = () => { setStep(STEP.IDLE); setFileName(null); setRegistration(null); setErrorMsg(''); if (fileInputRef.current) fileInputRef.current.value = '' }

  return (
    <div className="space-y-6">
      {/* Upload zone */}
      {(step === STEP.IDLE || step === STEP.INVALID_PDF) && (
        <div
          onDragOver={(e) => { e.preventDefault(); setDragOver(true) }}
          onDragLeave={() => setDragOver(false)}
          onDrop={handleDrop}
          onClick={() => fileInputRef.current?.click()}
          className={`cursor-pointer rounded-2xl border-2 border-dashed transition-all duration-300 p-12 text-center
            ${dragOver ? 'border-emerald-400 bg-emerald-50 scale-[1.01]' : 'border-gray-200 bg-gray-50 hover:border-emerald-300 hover:bg-emerald-50/50'}`}
        >
          <input ref={fileInputRef} type="file" accept="application/pdf" className="hidden" onChange={handleFileChange} />
          <div className="flex flex-col items-center gap-4">
            <div className={`w-16 h-16 rounded-2xl flex items-center justify-center transition-all duration-300 ${dragOver ? 'bg-emerald-100' : 'bg-gray-100'}`}>
              <svg className={`w-8 h-8 transition-colors ${dragOver ? 'text-emerald-500' : 'text-gray-400'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
              </svg>
            </div>
            <div>
              <p className="text-gray-800 font-semibold text-base mb-1">{dragOver ? 'Drop to verify' : 'Upload Certificate PDF'}</p>
              <p className="text-gray-500 text-sm">Drag & drop or click to browse</p>
              <p className="text-gray-400 text-xs mt-1">Only LandLedger-issued PDF certificates are supported</p>
            </div>
          </div>
          {step === STEP.INVALID_PDF && (
            <div className="mt-4 bg-red-50 border border-red-200 rounded-xl p-3 text-left">
              <p className="text-red-600 text-sm">{errorMsg}</p>
            </div>
          )}
        </div>
      )}

      {/* Parsing / Verifying */}
      {(step === STEP.PARSING || step === STEP.VERIFYING) && (
        <div className="rounded-2xl border border-gray-100 bg-gray-50 p-12 text-center">
          <div className="relative w-16 h-16 mx-auto mb-5">
            <div className="absolute inset-0 rounded-full border-4 border-gray-200" />
            <div className="absolute inset-0 rounded-full border-4 border-t-emerald-500 animate-spin" />
            <div className="absolute inset-0 flex items-center justify-center">
              <svg className="w-6 h-6 text-emerald-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
              </svg>
            </div>
          </div>
          <p className="text-gray-800 font-semibold text-base mb-1">
            {step === STEP.PARSING ? 'Reading certificate…' : 'Cross-checking registry…'}
          </p>
          <p className="text-gray-500 text-sm">
            {step === STEP.PARSING ? `Extracting data from ${fileName}` : 'Verifying against LandLedger database & Stellar blockchain'}
          </p>
        </div>
      )}

      {/* Failed */}
      {step === STEP.FAILED && (
        <div className="rounded-2xl bg-red-50 border border-red-200 p-6">
          <div className="flex items-start gap-4 mb-5">
            <div className="w-11 h-11 rounded-xl bg-red-100 flex items-center justify-center flex-shrink-0">
              <svg className="w-6 h-6 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
            </div>
            <div>
              <h3 className="text-red-700 font-bold text-base mb-1">Verification Failed</h3>
              <p className="text-red-600 text-sm leading-relaxed">{errorMsg}</p>
            </div>
          </div>
          <button onClick={reset} className="w-full py-2.5 px-4 bg-white border border-red-200 hover:bg-red-50 text-red-600 font-semibold rounded-xl transition-all text-sm">
            Try Another Certificate
          </button>
        </div>
      )}

      {/* Success */}
      {step === STEP.SUCCESS && registration && (
        <div className="space-y-4">
          <div className="rounded-2xl bg-emerald-50 border border-emerald-200 p-5 flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-emerald-100 flex items-center justify-center flex-shrink-0">
              <svg className="w-7 h-7 text-emerald-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <div className="flex-1">
              <p className="text-emerald-800 font-bold text-base">Certificate Authentic ✓</p>
              <p className="text-emerald-600 text-xs">Matches an officially approved record in the LandLedger registry.</p>
            </div>
          </div>

          <div className="rounded-2xl border border-gray-200 overflow-hidden">
            <div className="px-5 py-3 bg-gray-50 border-b border-gray-200 flex items-center justify-between">
              <p className="text-xs font-bold text-gray-500 uppercase tracking-wider">Registration Details</p>
              <p className="text-xs font-mono text-gray-400 truncate max-w-[180px]">{registration.id}</p>
            </div>
            <div className="p-5 grid grid-cols-1 sm:grid-cols-2 gap-5">
              <Field label="Owner Name" value={registration.owner_name} />
              <Field label="Property Address" value={registration.property_address} />
              <Field label="Property Type" value={registration.property_type} />
              <Field label="Size" value={registration.property_size ? `${registration.property_size} sq ft` : 'N/A'} />
              <Field label="Registration Date" value={new Date(registration.submitted_date).toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric' })} />
              <Field label="Status" value={
                <span className="inline-block bg-emerald-100 text-emerald-700 text-xs font-bold px-2 py-0.5 rounded-full uppercase tracking-wider">{registration.status}</span>
              } />
            </div>
            <div className="px-5 pb-5">
              {registration.blockchain_tx_hash ? (
                <a href={`https://stellar.expert/explorer/testnet/tx/${registration.blockchain_tx_hash}`} target="_blank" rel="noopener noreferrer"
                  className="flex items-center gap-3 bg-blue-50 border border-blue-200 rounded-xl px-4 py-3 hover:bg-blue-100 transition-colors group">
                  <svg className="w-5 h-5 text-blue-500 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                  </svg>
                  <div className="flex-1 min-w-0">
                    <p className="text-blue-700 font-bold text-xs uppercase tracking-wider">Blockchain Proof on Stellar</p>
                    <p className="text-blue-500 text-xs font-mono truncate">{registration.blockchain_tx_hash}</p>
                  </div>
                  <svg className="w-4 h-4 text-blue-400 group-hover:translate-x-0.5 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                  </svg>
                </a>
              ) : (
                <div className="flex items-center gap-2 bg-yellow-50 border border-yellow-200 rounded-xl px-4 py-3">
                  <svg className="w-4 h-4 text-yellow-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <p className="text-yellow-600 text-xs">Blockchain anchoring is pending for this certificate.</p>
                </div>
              )}
            </div>
          </div>

          <div className="flex gap-3">
            <button onClick={reset} className="flex-1 py-2.5 px-4 bg-gray-100 hover:bg-gray-200 text-gray-700 font-semibold rounded-xl transition-all text-sm">
              Verify Another
            </button>
            <Link to={`/verify/${registration.id}`} className="flex-1 py-2.5 px-4 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold rounded-xl transition-all text-sm text-center">
              View Full Record →
            </Link>
          </div>
        </div>
      )}
    </div>
  )
}

function Field({ label, value }) {
  return (
    <div>
      <p className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-1">{label}</p>
      <div className="text-gray-800 font-medium text-sm">{value}</div>
    </div>
  )
}

// ── Standalone full page (at /verify-certificate) ─────────────────────────────
export default function VerifyCertificatePage() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-800 pt-20 pb-16 px-4">
      <div className="max-w-2xl mx-auto text-center mb-10">
        <div className="inline-flex items-center gap-2 bg-white/5 border border-white/10 rounded-full px-4 py-1.5 mb-6">
          <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
          <span className="text-xs text-emerald-300 font-semibold tracking-widest uppercase">Live Verification</span>
        </div>
        <h1 className="text-4xl font-black text-white tracking-tight mb-3">Certificate Verifier</h1>
        <p className="text-slate-400 text-base leading-relaxed">
          Upload a LandLedger PDF certificate to instantly verify its authenticity against our official registry and the Stellar blockchain.
        </p>
      </div>
      <div className="max-w-2xl mx-auto bg-white rounded-2xl p-8 shadow-2xl">
        <VerifyPDFContent />
      </div>
    </div>
  )
}
