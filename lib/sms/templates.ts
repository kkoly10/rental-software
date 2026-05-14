export const smsTemplates = {
  orderConfirmation: (p: { orderNumber: string; businessName: string }) =>
    `${p.businessName}: Your order #${p.orderNumber} is confirmed! We'll be in touch with delivery details.`,

  depositReminder: (p: { orderNumber: string; amount: string; businessName: string }) =>
    `${p.businessName}: Reminder — a $${p.amount} deposit is due for order #${p.orderNumber}. Please submit payment to secure your date.`,

  deliveryScheduled: (p: { orderNumber: string; date: string; timeWindow: string; businessName: string }) =>
    `${p.businessName}: Order #${p.orderNumber} delivery scheduled for ${p.date}, ${p.timeWindow}. We'll notify you when the crew is en route.`,

  deliveryEnRoute: (p: { orderNumber: string; eta: string; businessName: string; trackingUrl?: string }) =>
    p.trackingUrl
      ? `${p.businessName}: Our crew is on the way with order #${p.orderNumber}! ETA: ${p.eta}. Track live: ${p.trackingUrl}`
      : `${p.businessName}: Our crew is on the way with order #${p.orderNumber}! ETA: ${p.eta}.`,

  deliveryCompleted: (p: { orderNumber: string; businessName: string }) =>
    `${p.businessName}: Order #${p.orderNumber} has been delivered and set up. Enjoy your event!`,

  weatherAlert: (p: { orderNumber: string; date: string; businessName: string }) =>
    `${p.businessName}: Weather alert for ${p.date} may affect order #${p.orderNumber}. We'll reach out if any changes are needed.`,

  paymentReceived: (p: { amount: string; orderNumber: string; businessName: string }) =>
    `${p.businessName}: Payment of $${p.amount} received for order #${p.orderNumber}. Thank you!`,

  orderCancelled: (p: { orderNumber: string; businessName: string }) =>
    `${p.businessName}: Order #${p.orderNumber} has been cancelled. Contact us if you have any questions.`,
};
