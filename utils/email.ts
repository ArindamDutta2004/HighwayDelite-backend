import nodemailer from "nodemailer";

export const sendOTPEmail = async (email: string, otp: string): Promise<void> => {
  try {
    // 1. Create transporter for Gmail
    const transporter = nodemailer.createTransport({
      service: "gmail",
      auth: {
        user: process.env.EMAIL_USER,          // your Gmail address
        pass: process.env.EMAIL_PASS,  // your app password
      },
    });

    // 2. Send email
    const info = await transporter.sendMail({
      from: '"Notes App" <no-reply@notesapp.com>',
      to: email,
      subject: "Your OTP for Notes App",
      html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #3B82F6;">Notes App - Verification Code</h2>
        <p>Your OTP code is:</p>
        <div style="background: #f3f4f6; padding: 20px; text-align: center; border-radius: 8px; margin: 20px 0;">
          <h1 style="color: #1E40AF; font-size: 32px; margin: 0; letter-spacing: 4px;">${otp}</h1>
        </div>
        <p>This code will expire in 5 minutes.</p>
        <p style="color: #6B7280; font-size: 14px;">If you didn't request this code, please ignore this email.</p>
      </div>
    `,
    });

    console.log("Message sent: %s", info.messageId);
  } catch (err) {
    console.error("Email send error:", err);
  }
};
