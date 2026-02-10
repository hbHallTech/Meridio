import nodemailer from "nodemailer";

const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST,
  port: Number(process.env.SMTP_PORT) || 587,
  secure: false,
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASSWORD,
  },
});

interface SendEmailOptions {
  to: string;
  subject: string;
  html: string;
}

export async function sendEmail({ to, subject, html }: SendEmailOptions) {
  await transporter.sendMail({
    from: process.env.SMTP_FROM,
    to,
    subject,
    html,
  });
}

export async function sendLeaveRequestNotification(
  managerEmail: string,
  employeeName: string,
  leaveType: string,
  startDate: string,
  endDate: string
) {
  await sendEmail({
    to: managerEmail,
    subject: `Nouvelle demande de congé - ${employeeName}`,
    html: `
      <h2>Nouvelle demande de congé</h2>
      <p><strong>${employeeName}</strong> a soumis une demande de congé.</p>
      <ul>
        <li><strong>Type :</strong> ${leaveType}</li>
        <li><strong>Du :</strong> ${startDate}</li>
        <li><strong>Au :</strong> ${endDate}</li>
      </ul>
      <p>Connectez-vous à Meridio pour approuver ou refuser cette demande.</p>
    `,
  });
}
