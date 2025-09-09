const nodemailer = require('nodemailer');

// Create transporter - you can use Gmail, SendGrid, or other providers
const createTransporter = () => {
  console.log('📧 Creating email transporter...');
  
  // Option 1: Gmail (requires app password)
  if (process.env.EMAIL_PROVIDER === 'gmail') {
    console.log('📧 Using Gmail provider');
    return nodemailer.createTransporter({
      service: 'gmail',
      auth: {
        user: process.env.GMAIL_USER,
        pass: process.env.GMAIL_APP_PASSWORD // Use app password, not regular password
      }
    });
  }
  
  // Option 2: SendGrid
  if (process.env.EMAIL_PROVIDER === 'sendgrid') {
    console.log('📧 Using SendGrid provider');
    return nodemailer.createTransporter({
      service: 'SendGrid',
      auth: {
        user: 'apikey',
        pass: process.env.SENDGRID_API_KEY
      }
    });
  }
  
  // Option 3: Custom SMTP (works with most providers)
  console.log('📧 Using custom SMTP provider');
  return nodemailer.createTransporter({
    host: process.env.SMTP_HOST,
    port: process.env.SMTP_PORT || 587,
    secure: process.env.SMTP_SECURE === 'true', // true for 465, false for other ports
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS
    }
  });
};

// SendGrid HTTP API method (recommended for hosting platforms)
const sendEmailWithSendGrid = async (inviterName, inviterEmail, recipientEmail) => {
  console.log('📨 Using SendGrid HTTP API...');
  
  const sgMail = require('@sendgrid/mail');
  sgMail.setApiKey(process.env.SENDGRID_API_KEY);

  const msg = {
    to: recipientEmail,
    from: process.env.FROM_EMAIL || 'fairenoughapp@gmail.com',
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

  const result = await sgMail.send(msg);
  console.log('✅ SendGrid email sent successfully:', result[0].statusCode);
  return { success: true, messageId: result[0].headers['x-message-id'] };
};

const sendInvitationEmail = async (inviterName, inviterEmail, recipientEmail) => {
  console.log('🚀 Starting email invitation process...');
  console.log(`📤 Sending invitation from ${inviterName} (${inviterEmail}) to ${recipientEmail}`);
  
  console.log('🔍 Debug - Email credentials:');
  console.log('EMAIL_PROVIDER:', process.env.EMAIL_PROVIDER);
  console.log('SENDGRID_API_KEY exists:', !!process.env.SENDGRID_API_KEY);
  console.log('GMAIL_USER:', process.env.GMAIL_USER);
  console.log('GMAIL_APP_PASSWORD length:', process.env.GMAIL_APP_PASSWORD ? process.env.GMAIL_APP_PASSWORD.length : 'undefined');
  console.log('FROM_EMAIL:', process.env.FROM_EMAIL);

  try {
    // If SendGrid is configured, use HTTP API (more reliable on hosting platforms)
    if (process.env.EMAIL_PROVIDER === 'sendgrid' && process.env.SENDGRID_API_KEY) {
      console.log('🌐 Using SendGrid HTTP API (recommended for hosting platforms)...');
      const result = await sendEmailWithSendGrid(inviterName, inviterEmail, recipientEmail);
      console.log('🎉 EMAIL SENT SUCCESSFULLY via SendGrid!');
      return result;
    }
    
    // Fallback to SMTP
    console.log('⚙️ Using SMTP method...');
    console.log('⚙️ Creating email transporter...');
    const transporter = createTransporter();
    console.log('✅ Email transporter created successfully');

    console.log('📝 Preparing email content...');
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

    console.log('📧 Email content prepared:');
    console.log(`   From: ${mailOptions.from}`);
    console.log(`   To: ${mailOptions.to}`);
    console.log(`   Subject: ${mailOptions.subject}`);
    
    console.log('📨 Attempting to send email via SMTP...');
    const startTime = Date.now();
    
    const result = await transporter.sendMail(mailOptions);
    
    const endTime = Date.now();
    const duration = endTime - startTime;
    
    console.log('🎉 EMAIL SENT SUCCESSFULLY via SMTP!');
    console.log(`   ✅ Message ID: ${result.messageId}`);
    console.log(`   ⏱️  Send duration: ${duration}ms`);
    console.log(`   📧 From: ${inviterEmail} (${inviterName})`);
    console.log(`   📧 To: ${recipientEmail}`);
    
    return { success: true, messageId: result.messageId };
    
  } catch (error) {
    console.log('❌ EMAIL SEND FAILED!');
    console.error(`   💥 Error: ${error.message}`);
    console.error(`   📧 Failed to send to: ${recipientEmail}`);
    console.error(`   📧 Attempted from: ${inviterEmail} (${inviterName})`);
    
    // Log more details about the error if available
    if (error.code) {
      console.error(`   🔍 Error code: ${error.code}`);
    }
    if (error.response) {
      console.error(`   🔍 SMTP response: ${error.response}`);
    }
    if (error.responseCode) {
      console.error(`   🔍 Response code: ${error.responseCode}`);
    }
    
    console.error('   📋 Full error details:', error);
    throw error;
  }
};

module.exports = {
  sendInvitationEmail
};