import nodemailer from "nodemailer";

type SendCodeInput = {
  email: string;
  code: string;
  purpose: "SIGNUP" | "NEW_DEVICE";
};

export async function sendVerificationCodeEmail({
  email,
  code,
  purpose,
}: SendCodeInput) {
  const server = process.env.EMAIL_SERVER;
  const from = process.env.EMAIL_FROM;
  if (!server || !from) {
    throw new Error("Email server is not configured");
  }

  const transporter = nodemailer.createTransport(server);
  const subject =
    purpose === "SIGNUP"
      ? "Verify your Smokeify account"
      : "New device verification";

  const lines = [
    "Your verification code:",
    code,
    "",
    "This code expires in 10 minutes.",
  ];

  await transporter.sendMail({
    to: email,
    from,
    subject,
    text: lines.join("\n"),
    html: `
      <div style="font-family: Arial, sans-serif; line-height: 1.5;">
        <p>Your verification code:</p>
        <p style="font-size: 24px; font-weight: bold; letter-spacing: 4px;">${code}</p>
        <p>This code expires in 10 minutes.</p>
      </div>
    `,
  });
}
