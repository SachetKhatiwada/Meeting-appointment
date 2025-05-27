import nodemailer from "nodemailer";
import { DateTime } from "luxon";

interface ConfirmationEmailProps {
  to: string;
  subject: string;
  appointmentTitle: string;
  appointmentStartUTC: string; // ISO format
  appointmentEndUTC: string; // ISO format
  googleMeetLink: string;
  clientTimezone: string; // e.g., "Asia/Kathmandu"
}

export async function sendConfirmationEmail({
  to,
  subject,
  appointmentTitle,
  appointmentStartUTC,
  appointmentEndUTC,
  googleMeetLink,
  clientTimezone,
}: ConfirmationEmailProps) {
  const transporter = nodemailer.createTransport({
    service: "gmail",
    auth: {
      user: process.env.EMAIL_USER,
      pass: process.env.EMAIL_PASS,
    },
  });

  const startDate = DateTime.fromISO(appointmentStartUTC, {
    zone: "utc",
  }).setZone(clientTimezone);
  const endDate = DateTime.fromISO(appointmentEndUTC, { zone: "utc" }).setZone(
    clientTimezone
  );

  const appointmentDate = startDate.toFormat("cccc, dd LLLL yyyy");
  const startTime = startDate.toFormat("hh:mm a ZZZZ");
  const endTime = endDate.toFormat("hh:mm a ZZZZ");

  const isValidLink =
    googleMeetLink &&
    googleMeetLink !== "Link not created" &&
    googleMeetLink.startsWith("http");

  const mailOptions = {
    from: `"Technova Team" <${process.env.EMAIL_USER}>`,
    to,
    subject,
    html: `
    <div style="font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; color: #333; max-width: 600px; margin: auto;">
      <h2 style="color: #2c3e50; border-bottom: 1px solid #ddd; padding-bottom: 10px;">
        📅 ${appointmentTitle}
      </h2>

      <p style="font-size: 16px;">Hello,</p>
      <p style="font-size: 16px;">
        Your appointment has been <strong>successfully scheduled</strong>. Here are the details:
      </p>

      <table style="width: 100%; font-size: 16px; border-collapse: collapse; margin: 20px 0;">
        <tr>
          <td style="padding: 8px 0;"><strong>📆 Date:</strong></td>
          <td style="padding: 8px 0;">${appointmentDate}</td>
        </tr>
        <tr>
          <td style="padding: 8px 0;"><strong>🕒 Start Time:</strong></td>
          <td style="padding: 8px 0;">${startTime}</td>
        </tr>
        <tr>
          <td style="padding: 8px 0;"><strong>⏰ End Time:</strong></td>
          <td style="padding: 8px 0;">${endTime}</td>
        </tr>
        ${
          isValidLink
            ? `
        <tr>
          <td style="padding: 8px 0;"><strong>🔗 Meet Link:</strong></td>
          <td style="padding: 8px 0;"><a href="${googleMeetLink}" style="color: #1a73e8; text-decoration: none;">Join Google Meet</a></td>
        </tr>`
            : `
        <tr>
          <td colspan="2" style="padding: 8px 0; color: #b00020;">
            ⚠️ Google Meet link could not be created due to a technical issue. We will contact you with further details shortly.
          </td>
        </tr>`
        }
      </table>

      <p style="font-size: 16px;">
        If you have any questions or need to reschedule, please don't hesitate to contact us.
      </p>

      <p style="font-size: 16px; margin-top: 30px;">
        Best regards,<br/>
        <strong style="color: #2c3e50;">Technova Team</strong><br/>
        <em>Empowering Ideas with Technology</em>
      </p>
    </div>
  `,
  };

  await transporter.sendMail(mailOptions);
}
