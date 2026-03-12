import { Resend } from "resend";

const resend = new Resend(process.env.RESEND_API_KEY);

export const sendOTPEmail = async (email, otp) => {
  try {
   const response= await resend.emails.send({
 from: "onboarding@resend.dev",
      to: email,
      subject: "Password Reset OTP",
      html: `
        <h2>Password Reset</h2>
        <p>Your OTP is:</p>
        <h1>${otp}</h1>
        <p>This OTP will expire in 10 minutes.</p>
      `,
    });
    console.log("EMAIL RESPONSE:", response);
  } catch (error) {
    console.error("Email Error:", error);
    throw new Error("Failed to send OTP email");
  }
};
