const nodemailer = require('nodemailer');

// Create transporter - you can use Gmail, SendGrid, or other providers
const createTransporter = () => {
  // Option 1: Gmail (requires app password)
  if (process.env.EMAIL_PROVIDER === 'gmail') {
    return nodemailer.createTransport({
      service: 'gmail',
      auth: {
        user: process.env.GMAIL_USER,
        pass: process.env.GMAIL_APP_PASSWORD // Use app password, not regular password
      }
    });
  }
  
  // Option 2: SendGrid
  if (process.env.EMAIL_PROVIDER === 'sendgrid') {
    return nodemailer.createTransport({
      service: 'SendGrid',
      auth: {
        user: 'apikey',
        pass: process.env.SENDGRID_API_KEY
      }
    });
  }
  
  // Option 3: Custom SMTP (works with most providers)
  return nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: process.env.SMTP_PORT || 587,
    secure: process.env.SMTP_SECURE === 'true', // true for 465, false for other ports
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS
    }
  });
};

const sendInvitationEmail = async (inviterName, inviterEmail, recipientEmail) => {
  try {
    const transporter = createTransporter();
    
    const mailOptions = {
      from: process.env.FROM_EMAIL || inviterEmail,
      to: recipientEmail,
      subject: `${inviterName} has invited you to join FairEnough!`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <div style="background-color: #f8f9fa; padding: 20px; border-radius: 8px;">
            <h2 style="color: #2c3e50; margin: 0 0 20px 0;">You're Invited to FairEnough!</h2>
            
            <p style="font-size: 16px; line-height: 1.5; color: #34495e;">
              <strong>${inviterName}</strong> (${inviterEmail}) has invited you to join 
              <strong>FairEnough</strong>, the dispute resolution app that helps people 
              resolve conflicts fairly and efficiently.
            </p>
            
            <div style="background-color: white; padding: 20px; border-radius: 6px; margin: 20px 0; border-left: 4px solid #3498db;">
              <h3 style="color: #2c3e50; margin: 0 0 10px 0;">What is FairEnough?</h3>
              <p style="margin: 0; color: #34495e;">
                FairEnough is a platform that helps people resolve disputes through structured dialogue and fair mediation.
                Once you join, ${inviterName} will be able to add you to disputes and collaborate on finding resolutions.
              </p>
            </div>
            
            <div style="text-align: center; margin: 30px 0;">
              <div style="margin-bottom: 15px;">
                <a href="${process.env.WEB_APP_URL || 'https://fairenough.netlify.app'}" 
                   style="background-color: #3498db; color: white; padding: 12px 30px; text-decoration: none; border-radius: 6px; font-weight: bold; display: inline-block; margin-right: 10px;">
                  Open Web App
                </a>
              </div>
              <div>
                <a href="${process.env.ANDROID_APP_URL || '#'}" 
                   style="background-color: #27ae60; color: white; padding: 12px 30px; text-decoration: none; border-radius: 6px; font-weight: bold; display: inline-block;">
                  Download Android App
                </a>
              </div>
              <p style="font-size: 12px; color: #7f8c8d; margin-top: 15px;">
                Choose the option that works best for your device
              </p>
            </div>
            
            <p style="font-size: 14px; color: #7f8c8d; margin-top: 30px;">
              If you have any questions, feel free to reply to this email or contact ${inviterName} directly.
            </p>
            
            <hr style="border: none; border-top: 1px solid #ecf0f1; margin: 20px 0;">
            
            <p style="font-size: 12px; color: #95a5a6; text-align: center;">
              This invitation was sent by ${inviterName} through FairEnough. 
              If you didn't expect this invitation, you can safely ignore this email.
            </p>
          </div>
        </div>
      `,
      text: `
        ${inviterName} has invited you to join FairEnough!
        
        ${inviterName} (${inviterEmail}) has invited you to join FairEnough, the dispute resolution app that helps people resolve conflicts fairly and efficiently.
        
        What is FairEnough?
        FairEnough is a platform that helps people resolve disputes through structured dialogue and fair mediation. Once you join, ${inviterName} will be able to add you to disputes and collaborate on finding resolutions.
        
        Join FairEnough:
        Web App: ${process.env.WEB_APP_URL || 'https://fairenough.netlify.app'}
        Android App: ${process.env.ANDROID_APP_URL || 'Available on request'}
        
        Choose the option that works best for your device.
        
        If you have any questions, feel free to reply to this email or contact ${inviterName} directly.
        
        This invitation was sent by ${inviterName} through FairEnough. If you didn't expect this invitation, you can safely ignore this email.
      `
    };

    const result = await transporter.sendMail(mailOptions);
    console.log('✅ Invitation email sent:', result.messageId);
    return { success: true, messageId: result.messageId };
    
  } catch (error) {
    console.error('❌ Error sending invitation email:', error);
    throw error;
  }
};

module.exports = {
  sendInvitationEmail
};