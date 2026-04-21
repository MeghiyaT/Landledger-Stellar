/**
 * PDF Generator Utility
 * 
 * This utility helps generate PDF certificates for registrations.
 * Uses jsPDF library for client-side PDF generation.
 */

import { jsPDF } from 'jspdf'

export const generateRegistrationCertificatePDF = async (registration) => {
  try {
    const doc = new jsPDF({
      orientation: 'landscape',
      unit: 'mm',
      format: 'a4'
    })

    // Certificate styling
    const pageWidth = doc.internal.pageSize.getWidth()
    const pageHeight = doc.internal.pageSize.getHeight()
    const margin = 20

    // Title
    doc.setFontSize(28)
    doc.setFont('helvetica', 'bold')
    doc.text('LAND REGISTRATION CERTIFICATE', pageWidth / 2, 40, { align: 'center' })

    // Certificate Number
    doc.setFontSize(12)
    doc.setFont('helvetica', 'normal')
    doc.text(`Certificate Number: ${registration.id.substring(0, 8).toUpperCase()}`, pageWidth / 2, 55, { align: 'center' })

    // Date
    doc.text(`Date: ${new Date(registration.submitted_date).toLocaleDateString()}`, pageWidth / 2, 62, { align: 'center' })

    // Content
    doc.setFontSize(14)
    doc.text('This is to certify that', pageWidth / 2, 80, { align: 'center' })

    doc.setFontSize(16)
    doc.setFont('helvetica', 'bold')
    doc.text(registration.owner_name, pageWidth / 2, 95, { align: 'center' })

    doc.setFontSize(14)
    doc.setFont('helvetica', 'normal')
    doc.text('has successfully registered the following property:', pageWidth / 2, 105, { align: 'center' })

    // Property Details
    let yPos = 120
    doc.setFontSize(12)
    doc.text(`Property Address: ${registration.property_address}`, margin, yPos)
    yPos += 10
    doc.text(`Property Type: ${registration.property_type}`, margin, yPos)
    yPos += 10
    if (registration.property_size) {
      doc.text(`Property Size: ${registration.property_size} sq ft`, margin, yPos)
      yPos += 10
    }
    doc.text(`Registration Status: ${registration.status.toUpperCase()}`, margin, yPos)

    // Footer
    doc.setFontSize(10)
    doc.text('This is an official certificate issued by LandLedger', pageWidth / 2, pageHeight - 20, { align: 'center' })
    doc.text(`Issued on ${new Date().toLocaleDateString()}`, pageWidth / 2, pageHeight - 15, { align: 'center' })

    // Generate blob
    const pdfBlob = doc.output('blob')
    const url = URL.createObjectURL(pdfBlob)

    return {
      blob: pdfBlob,
      url: url,
      filename: `registration-certificate-${registration.id.substring(0, 8)}.pdf`
    }
  } catch (error) {
    console.error('Error generating PDF:', error)
    return null
  }
}

/**
 * Download PDF certificate
 */
export const downloadRegistrationCertificate = async (registration) => {
  const pdfData = await generateRegistrationCertificatePDF(registration)
  
  if (!pdfData) {
    return { success: false, error: 'Failed to generate PDF' }
  }

  // Create download link
  const link = document.createElement('a')
  link.href = pdfData.url
  link.download = pdfData.filename
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)

  // Clean up
  setTimeout(() => {
    URL.revokeObjectURL(pdfData.url)
  }, 100)

  return { success: true }
}

