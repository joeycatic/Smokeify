import nodemailer from "nodemailer";

type SendCodeInput = {
  email: string;
  code: string;
  purpose: "SIGNUP" | "NEW_DEVICE" | "PASSWORD_RESET";
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
      : purpose === "NEW_DEVICE"
      ? "New device verification"
      : "Reset your Smokeify password";

  const lines = [
    purpose === "PASSWORD_RESET"
      ? "Your password reset code:"
      : "Your verification code:",
    code,
    "",
    "This code expires in 10 minutes.",
  ];

  if (purpose === "PASSWORD_RESET") {
    lines.push("If you did not request a password reset, you can ignore this email.");
  }

  await transporter.sendMail({
    to: email,
    from,
    subject,
    text: lines.join("\n"),
    html: `
      <div style="font-family: Arial, sans-serif; line-height: 1.5;">
        <p>${
          purpose === "PASSWORD_RESET"
            ? "Your password reset code:"
            : "Your verification code:"
        }</p>
        <p style="font-size: 24px; font-weight: bold; letter-spacing: 4px;">${code}</p>
        <p>This code expires in 10 minutes.</p>
        ${
          purpose === "PASSWORD_RESET"
            ? "<p>If you did not request a password reset, you can ignore this email.</p>"
            : ""
        }
      </div>
    `,
  });
}
