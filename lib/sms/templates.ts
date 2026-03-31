export const smsTemplates = {
  orderConfirmation: (orderNumber: string, businessName: string) =>
    `${businessName}: Your order #${orderNumber} is confirmed! We'll be in touch with delivery details.`,

  depositReminder: (
    orderNumber: string,
    amount: string,
    businessName: string
  ) =>
    `${businessName}: Reminder — a $${amount} deposit is due for order #${orderNumber}. Please submit payment to secure your date.`,

  deliveryScheduled: (
    orderNumber: string,
    date: string,
    timeWindow: string,
    businessName: string
  ) =>
    `${businessName}: Order #${orderNumber} delivery scheduled for ${date}, ${timeWindow}. We'll notify you when the crew is en route.`,

  deliveryEnRoute: (
    orderNumber: string,
    eta: string,
    businessName: string
  ) =>
    `${businessName}: Our crew is on the way with order #${orderNumber}! ETA: ${eta}.`,

  deliveryCompleted: (orderNumber: string, businessName: string) =>
    `${businessName}: Order #${orderNumber} has been delivered and set up. Enjoy your event!`,

  weatherAlert: (
    orderNumber: string,
    date: string,
    businessName: string
  ) =>
    `${businessName}: Weather alert for ${date} may affect order #${orderNumber}. We'll reach out if any changes are needed.`,

  paymentReceived: (
    amount: string,
    orderNumber: string,
    businessName: string
  ) =>
    `${businessName}: Payment of $${amount} received for order #${orderNumber}. Thank you!`,
};
