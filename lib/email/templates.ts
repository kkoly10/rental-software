/**
 * Shared email layout wrapper.
 * Inlines all styles for maximum email client compatibility.
 */
function layout(businessName: string, body: string, footer?: string): string {
  return `<!DOCTYPE html>
<html lang="en">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
<body style="margin:0;padding:0;background:#f4f7fb;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Arial,sans-serif;color:#10233f;line-height:1.6;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f4f7fb;padding:32px 16px;">
    <tr><td align="center">
      <table role="presentation" width="580" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:16px;border:1px solid #dbe6f4;box-shadow:0 4px 12px rgba(16,35,63,0.06);overflow:hidden;">
        <!-- Header -->
        <tr>
          <td style="background:linear-gradient(135deg,#1e5dcf,#2d77f2);padding:24px 32px;">
            <span style="color:#ffffff;font-size:18px;font-weight:800;letter-spacing:0.01em;">${businessName}</span>
          </td>
        </tr>
        <!-- Body -->
        <tr>
          <td style="padding:32px;">
            ${body}
          </td>
        </tr>
        <!-- Footer -->
        <tr>
          <td style="padding:20px 32px;border-top:1px solid #dbe6f4;color:#55708f;font-size:13px;">
            ${footer ?? `<p style="margin:0;">Sent by ${businessName} via <span style="color:#1e5dcf;font-weight:600;">Korent</span></p>`}
          </td>
        </tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;
}

function button(text: string, url: string): string {
  return `<a href="${url}" style="display:inline-block;padding:14px 28px;background:#1e5dcf;color:#ffffff;border-radius:999px;font-weight:600;font-size:14px;text-decoration:none;margin:16px 0;">
    ${text}
  </a>`;
}

function detailRow(label: string, value: string): string {
  return `<tr>
    <td style="padding:8px 0;color:#55708f;font-size:14px;width:140px;vertical-align:top;">${label}</td>
    <td style="padding:8px 0;font-size:14px;font-weight:500;">${value}</td>
  </tr>`;
}

function detailTable(rows: [string, string][]): string {
  return `<table role="presentation" cellpadding="0" cellspacing="0" style="width:100%;margin:16px 0;">
    ${rows.map(([label, value]) => detailRow(label, value)).join("")}
  </table>`;
}

// ─── ORDER CONFIRMATION (customer-facing, from website checkout) ────────────

export type OrderConfirmationData = {
  businessName: string;
  customerFirstName: string;
  orderNumber: string;
  productName: string;
  eventDate: string;
  subtotal: string;
  deliveryFee: string;
  total: string;
  depositDue: string;
  supportEmail: string;
  siteUrl: string;
};

export function orderConfirmationEmail(data: OrderConfirmationData): string {
  return layout(
    data.businessName,
    `
    <h1 style="margin:0 0 8px;font-size:24px;">Booking received!</h1>
    <p style="color:#55708f;margin:0 0 20px;">
      Hi ${data.customerFirstName}, thanks for your reservation. Here are your details:
    </p>

    ${detailTable([
      ["Order", `#${data.orderNumber}`],
      ["Item", data.productName],
      ["Event date", data.eventDate],
      ["Subtotal", data.subtotal],
      ["Delivery fee", data.deliveryFee],
      ["Total", data.total],
    ])}

    <div style="background:#fff4e5;border:1px solid #fde2a7;border-radius:12px;padding:16px;margin:20px 0;">
      <strong style="color:#a86a08;">Deposit required: ${data.depositDue}</strong>
      <p style="margin:8px 0 0;font-size:14px;color:#a86a08;">
        Please submit your deposit to confirm this booking. We'll reach out with payment instructions.
      </p>
    </div>

    <p style="font-size:14px;color:#55708f;">
      Questions? Reply to this email or contact us at ${data.supportEmail}.
    </p>
    `
  );
}

// ─── NEW ORDER ALERT (operator-facing) ─────────────────────────────────────

export type NewOrderAlertData = {
  businessName: string;
  customerName: string;
  customerEmail: string;
  orderNumber: string;
  productName: string;
  eventDate: string;
  total: string;
  source: "website" | "dashboard";
  dashboardUrl: string;
};

export function newOrderAlertEmail(data: NewOrderAlertData): string {
  return layout(
    data.businessName,
    `
    <h1 style="margin:0 0 8px;font-size:24px;">New order received</h1>
    <p style="color:#55708f;margin:0 0 20px;">
      A new booking came in from your ${data.source === "website" ? "website" : "dashboard"}.
    </p>

    ${detailTable([
      ["Order", `#${data.orderNumber}`],
      ["Customer", data.customerName],
      ["Email", data.customerEmail],
      ["Item", data.productName],
      ["Event date", data.eventDate],
      ["Total", data.total],
    ])}

    ${button("View Order", data.dashboardUrl)}
    `
  );
}

// ─── PAYMENT RECEIVED ───────────────────────────────────────────────────────

export type PaymentReceivedData = {
  businessName: string;
  customerFirstName: string;
  orderNumber: string;
  amount: string;
  paymentType: string;
  paymentMethod: string;
  newBalance: string;
  supportEmail: string;
};

export function paymentReceivedEmail(data: PaymentReceivedData): string {
  const isFullyPaid = data.newBalance === "$0.00";

  return layout(
    data.businessName,
    `
    <h1 style="margin:0 0 8px;font-size:24px;">Payment received</h1>
    <p style="color:#55708f;margin:0 0 20px;">
      Hi ${data.customerFirstName}, we received your ${data.paymentType} payment.
    </p>

    ${detailTable([
      ["Order", `#${data.orderNumber}`],
      ["Amount", data.amount],
      ["Method", data.paymentMethod],
      ["Balance remaining", data.newBalance],
    ])}

    ${isFullyPaid
      ? `<div style="background:#eaf9f4;border:1px solid #b6e8d3;border-radius:12px;padding:16px;margin:20px 0;">
          <strong style="color:#188862;">Your booking is fully paid and confirmed!</strong>
          <p style="margin:8px 0 0;font-size:14px;color:#188862;">
            We'll be in touch with delivery details before your event.
          </p>
        </div>`
      : `<p style="font-size:14px;color:#55708f;">
          Your remaining balance of ${data.newBalance} is due before the event date.
        </p>`
    }

    <p style="font-size:14px;color:#55708f;">
      Questions? Contact us at ${data.supportEmail}.
    </p>
    `
  );
}

// ─── REFUND PROCESSED ───────────────────────────────────────────────────────

export type RefundProcessedData = {
  businessName: string;
  customerFirstName: string;
  orderNumber: string;
  amount: string;
  supportEmail: string;
};

export function refundProcessedEmail(data: RefundProcessedData): string {
  return layout(
    data.businessName,
    `
    <h1 style="margin:0 0 8px;font-size:24px;">Refund processed</h1>
    <p style="color:#55708f;margin:0 0 20px;">
      Hi ${data.customerFirstName}, a refund has been issued for your order.
    </p>

    ${detailTable([
      ["Order", `#${data.orderNumber}`],
      ["Refund amount", data.amount],
    ])}

    <p style="font-size:14px;color:#55708f;">
      The refund may take 5-10 business days to appear on your statement.
      Contact us at ${data.supportEmail} with any questions.
    </p>
    `
  );
}

// ─── ORDER STATUS UPDATE ────────────────────────────────────────────────────

export type OrderStatusUpdateData = {
  businessName: string;
  customerFirstName: string;
  orderNumber: string;
  newStatus: string;
  eventDate: string;
  supportEmail: string;
};

const statusMessages: Record<string, { heading: string; body: string }> = {
  confirmed: {
    heading: "Your booking is confirmed!",
    body: "Your event is locked in. We'll send delivery details as the date approaches.",
  },
  scheduled: {
    heading: "Delivery scheduled",
    body: "Your delivery has been scheduled. Our crew will arrive on the day of your event for setup.",
  },
  out_for_delivery: {
    heading: "We're on our way!",
    body: "Our delivery team is headed to your location. Please ensure the setup area is accessible.",
  },
  delivered: {
    heading: "Setup complete!",
    body: "Your rental equipment has been set up and is ready to go. Enjoy your event!",
  },
  completed: {
    heading: "Thanks for renting with us!",
    body: "Your rental is complete. We hope your event was a success! We'd love to have you back.",
  },
  cancelled: {
    heading: "Order cancelled",
    body: "Your order has been cancelled. If you have any questions about refunds, please contact us.",
  },
};

export function orderStatusUpdateEmail(data: OrderStatusUpdateData): string {
  const msg = statusMessages[data.newStatus] ?? {
    heading: `Order updated to ${data.newStatus}`,
    body: "Your order status has been updated.",
  };

  return layout(
    data.businessName,
    `
    <h1 style="margin:0 0 8px;font-size:24px;">${msg.heading}</h1>
    <p style="color:#55708f;margin:0 0 20px;">
      Hi ${data.customerFirstName}, here's an update on your booking:
    </p>

    ${detailTable([
      ["Order", `#${data.orderNumber}`],
      ["Status", data.newStatus.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase())],
      ["Event date", data.eventDate],
    ])}

    <p style="font-size:14px;margin:16px 0;">${msg.body}</p>

    <p style="font-size:14px;color:#55708f;">
      Questions? Contact us at ${data.supportEmail}.
    </p>
    `
  );
}

// ─── DOCUMENTS READY ────────────────────────────────────────────────────────

export type DocumentsReadyData = {
  businessName: string;
  customerFirstName: string;
  orderNumber: string;
  documentTypes: string[];
  supportEmail: string;
};

export function documentsReadyEmail(data: DocumentsReadyData): string {
  const docList = data.documentTypes
    .map((t) => t.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase()))
    .join(" and ");

  return layout(
    data.businessName,
    `
    <h1 style="margin:0 0 8px;font-size:24px;">Documents ready to sign</h1>
    <p style="color:#55708f;margin:0 0 20px;">
      Hi ${data.customerFirstName}, your ${docList} for order #${data.orderNumber}
      ${data.documentTypes.length > 1 ? "are" : "is"} ready for review.
    </p>

    <p style="font-size:14px;">
      Our team will send you the documents for signing. If you have questions,
      contact us at ${data.supportEmail}.
    </p>
    `
  );
}
