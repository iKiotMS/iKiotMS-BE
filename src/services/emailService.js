const nodemailer = require("nodemailer");

let transporter = null;

function getTransporter() {
  if (!transporter) {
    transporter = nodemailer.createTransport({
      host: process.env.MAIL_HOST,
      port: Number(process.env.MAIL_PORT) || 587,
      secure: process.env.MAIL_PORT === "465",
      auth: {
        user: process.env.MAIL_USER,
        pass: process.env.MAIL_PASS,
      },
    });
  }
  return transporter;
}

async function sendSubscriptionReminder(to, { tenantName, planName, daysLeft, endDate }) {
  if (!process.env.MAIL_HOST || !process.env.MAIL_USER) {
    console.warn("[EmailService] Chưa cấu hình MAIL_HOST/MAIL_USER, bỏ qua email");
    return;
  }

  const formattedDate = new Date(endDate).toLocaleDateString("vi-VN", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    timeZone: "Asia/Ho_Chi_Minh",
  });

  const subject =
    daysLeft === 1
      ? `[iKiot] Gói ${planName} của bạn sẽ hết hạn vào NGÀY MAI`
      : `[iKiot] Gói ${planName} của bạn sẽ hết hạn sau ${daysLeft} ngày`;

  await getTransporter().sendMail({
    from: `"iKiot" <${process.env.MAIL_FROM || process.env.MAIL_USER}>`,
    to,
    subject,
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 560px; margin: 0 auto;">
        <h2 style="color: #1a1a1a;">Nhắc nhở gia hạn dịch vụ</h2>
        <p>Xin chào <strong>${tenantName}</strong>,</p>
        <p>
          Gói dịch vụ <strong>${planName}</strong> của bạn sẽ hết hạn vào ngày
          <strong>${formattedDate}</strong>
          ${daysLeft === 1 ? "(ngày mai)" : `(còn ${daysLeft} ngày)`}.
        </p>
        <p>
          Vui lòng đăng nhập vào hệ thống và gia hạn để tiếp tục sử dụng
          đầy đủ tính năng mà không bị gián đoạn.
        </p>
        <p style="color: #666; font-size: 13px;">
          Nếu bạn đã gia hạn, vui lòng bỏ qua email này.
        </p>
        <hr style="border: none; border-top: 1px solid #eee; margin: 24px 0;" />
        <p style="color: #999; font-size: 12px;">
          Trân trọng,<br/>Đội ngũ iKiot
        </p>
      </div>
    `,
  });
}

module.exports = { sendSubscriptionReminder };
