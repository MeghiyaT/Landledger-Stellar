import {
  sendRegistrationSubmittedEmail,
  sendRegistrationUnderReviewEmail,
  sendRegistrationApprovedEmail,
  sendRegistrationRejectedEmail,
} from '../services/email'

/**
 * Send email for registration submitted
 */
export const notifyRegistrationSubmitted = async (registration, _userId) => {
  try {
    // Send email notification
    console.log('📧 Sending email to:', registration.owner_email)
    const emailResult = await sendRegistrationSubmittedEmail({
      email: registration.owner_email,
      ownerName: registration.owner_name,
      propertyAddress: registration.property_address,
      registrationId: registration.id,
    })
    
    if (emailResult.error) {
      console.error('❌ Failed to send email:', emailResult.error)
    } else if (emailResult.success) {
      console.log('✅ Email sent successfully')
    }
  } catch (error) {
    console.error('❌ Error sending email:', error)
  }
}

/**
 * Send email for registration under review
 */
export const notifyRegistrationUnderReview = async (registration, _userId) => {
  // Send email notification
  await sendRegistrationUnderReviewEmail({
    email: registration.owner_email,
    ownerName: registration.owner_name,
    propertyAddress: registration.property_address,
    registrationId: registration.id,
  })
}

/**
 * Send email for registration approved
 */
export const notifyRegistrationApproved = async (registration, _userId) => {
  // Send email notification
  await sendRegistrationApprovedEmail({
    email: registration.owner_email,
    ownerName: registration.owner_name,
    propertyAddress: registration.property_address,
    registrationId: registration.id,
    reviewNotes: registration.review_notes,
  })
}

/**
 * Send email for registration rejected
 */
export const notifyRegistrationRejected = async (registration, _userId) => {
  // Send email notification
  await sendRegistrationRejectedEmail({
    email: registration.owner_email,
    ownerName: registration.owner_name,
    propertyAddress: registration.property_address,
    registrationId: registration.id,
    reviewNotes: registration.review_notes,
  })
}

/**
 * Create a notification for registration status change
 * @param {Object} registration - The registration object
 * @param {string} status - The new status
 * @param {string} userId - The user ID to notify
 * @param {string} [adminNote] - Optional admin note
 * @returns {Promise<{data: Object|null, error: Error|null}>}
 */
export const notifyRegistrationStatusChange = async (registration, status, userId, adminNote = '') => {
  try {
    console.log('📋 notifyRegistrationStatusChange called:', {
      registrationId: registration?.id,
      status,
      userId,
      propertyAddress: registration?.property_address
    })
    
    let title = 'Registration Status Updated';
    let message = `Your registration for ${registration.property_address} has been updated to: ${status}`;
    let notificationType = `registration_${status.toLowerCase().replace(' ', '_')}`;
    
    if (adminNote) {
      message += `\n\nAdmin Note: ${adminNote}`;
    }

    // Add more specific messages based on status
    switch (status.toLowerCase()) {
      case 'in_review':
        title = 'Registration Under Review';
        message = `Your registration for ${registration.property_address} is now under review.`;
        notificationType = 'registration_in_review';
        break;
      case 'approved':
        title = 'Registration Approved!';
        message = `Congratulations! Your registration for ${registration.property_address} has been approved.`;
        notificationType = 'registration_approved';
        break;
      case 'rejected':
        title = 'Registration Requires Changes';
        message = `Your registration for ${registration.property_address} requires changes.`;
        notificationType = 'registration_rejected';
        if (adminNote) {
          message += `\n\nReason: ${adminNote}`;
        }
        break;
    }

    console.log('🔔 Creating notification:', {
      userId,
      type: notificationType,
      title,
      message: message.substring(0, 50) + '...'
    })

    // Import the notification service
    const { createNotification } = await import('../services/notifications');

    // Create the notification
    const result = await createNotification(
      userId,
      notificationType,
      title,
      message,
      `/dashboard?tab=registrations` // Link to registrations tab in dashboard
    );
    
    if (result?.error) {
      console.error('❌ Notification creation returned error:', result.error)
    } else {
      console.log('✅ Notification created successfully:', result?.data?.id)
    }
    
    return result;
  } catch (error) {
    console.error('❌ Exception creating status change notification:', error);
    return { error };
  }
};

