const nodemailer = require('nodemailer');

const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS
    }
});

const sendOTP = async (email, otp) => {
    const mailOptions = {
        from: `"UniPlacements Portal" <${process.env.EMAIL_USER}>`,
        to: email,
        subject: 'Email Verification – UniPlacements Portal',
        html: `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: auto; padding: 20px; border: 1px solid #e2e8f0; border-radius: 12px;">
                <h2 style="color: #2563eb; text-align: center;">UniPlacements Portal</h2>
                <hr style="border: 0; border-top: 1px solid #e2e8f0; margin: 20px 0;">
                <p>Hello,</p>
                <p>Your OTP for account verification is:</p>
                <div style="background: #f1f5f9; padding: 15px; text-align: center; border-radius: 8px; margin: 20px 0;">
                    <span style="font-size: 32px; font-weight: 800; letter-spacing: 5px; color: #0f172a;">${otp}</span>
                </div>
                <p>This OTP will expire in <strong>5 minutes</strong>.</p>
                <p style="color: #64748b; font-size: 14px;">If you did not request this code, please ignore this email.</p>
                <hr style="border: 0; border-top: 1px solid #e2e8f0; margin: 20px 0;">
                <p style="text-align: center; color: #475569; font-size: 12px;">&copy; 2026 UniPlacements Portal. All rights reserved.</p>
            </div>
        `
    };

    try {
        const info = await transporter.sendMail(mailOptions);
        console.log(`Email sent successfully to ${email}`);
        return {
            sent: true,
            messageId: info?.messageId || null
        };
    } catch (error) {
        console.error('SMTP Connection Blocked:', error.message);
        return {
            sent: false,
            error: error.message || 'Unable to send OTP email'
        };
    }
};

const sendRecruiterConfirmationEmail = async (email, recruiterName) => {
    const mailOptions = {
        from: `"UniPlacements Portal" <${process.env.EMAIL_USER}>`,
        to: email,
        subject: 'Account Verification Complete – Welcome to UniPlacements Portal',
        html: `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: auto; padding: 20px; border: 1px solid #e2e8f0; border-radius: 12px;">
                <h2 style="color: #2563eb; text-align: center;">UniPlacements Portal</h2>
                <hr style="border: 0; border-top: 1px solid #e2e8f0; margin: 20px 0;">
                <p>Hello <strong>${recruiterName || 'Recruiter'}</strong>,</p>
                <p>Great news! Your recruiter account has been successfully verified and approved by our admin team.</p>
                
                <div style="background: #ecfdf5; border-left: 4px solid #10b981; padding: 15px; border-radius: 8px; margin: 20px 0;">
                    <p style="color: #065f46; margin: 0;"><strong>✓ Verification Complete</strong></p>
                    <p style="color: #047857; margin: 10px 0 0 0;">Your account is now active and ready to use.</p>
                </div>

                <p><strong>What you can do now:</strong></p>
                <ul style="color: #475569; line-height: 1.8;">
                    <li>Log in to your recruiter dashboard</li>
                    <li>Post job openings</li>
                    <li>Manage applications from candidates</li>
                    <li>Schedule interviews and placements</li>
                </ul>

                <p style="margin-top: 20px;">
                    <a href="https://university-placement-portal-seven.vercel.app/login" style="display: inline-block; background: #2563eb; color: white; padding: 12px 30px; text-decoration: none; border-radius: 6px; font-weight: bold;">Log In Now</a>
                </p>

                <hr style="border: 0; border-top: 1px solid #e2e8f0; margin: 20px 0;">
                
                <p style="color: #475569; font-size: 14px;">Thank you for being part of the UniPlacements Portal community. We look forward to connecting you with excellent candidates!</p>
                
                <p style="color: #64748b; font-size: 12px; margin-top: 15px;">If you have any questions, feel free to reach out to our support team.</p>
                
                <p style="text-align: center; color: #475569; font-size: 12px; margin-top: 20px;">&copy; 2026 UniPlacements Portal. All rights reserved.</p>
            </div>
        `
    };

    try {
        const info = await transporter.sendMail(mailOptions);
        console.log(`Confirmation email sent successfully to ${email}`);
        return {
            sent: true,
            messageId: info?.messageId || null
        };
    } catch (error) {
        console.error('Error sending confirmation email:', error.message);
        return {
            sent: false,
            error: error.message || 'Unable to send confirmation email'
        };
    }
};

module.exports = { sendOTP, sendRecruiterConfirmationEmail };
