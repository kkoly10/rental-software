export const smsTemplates = {
  orderConfirmation: (p: { orderNumber: string; businessName: string }) =>
    `${p.businessName}: Order #${p.orderNumber} confirmed! We'll be in touch with delivery details. Rply STOP to unsubscribe.`,

  depositReminder: (p: { orderNumber: string; amount: string; businessName: string }) =>
    `${p.businessName}: A $${p.amount} deposit is due for order #${p.orderNumber}. Pay to secure your date. Rply STOP to opt out.`,

  deliveryScheduled: (p: { orderNumber: string; date: string; timeWindow: string; businessName: string }) =>
    `${p.businessName}: Order #${p.orderNumber} delivery on ${p.date}, ${p.timeWindow}. We'll notify you en route. Rply STOP to opt out.`,

  deliveryEnRoute: (p: { orderNumber: string; eta: string; businessName: string; trackingUrl?: string }) =>
    p.trackingUrl
      ? `${p.businessName}: Crew is on the way for order #${p.orderNumber}! ETA: ${p.eta}. Track: ${p.trackingUrl} Rply STOP to opt out.`
      : `${p.businessName}: Crew is on the way for order #${p.orderNumber}! ETA: ${p.eta}. Rply STOP to opt out.`,

  deliveryCompleted: (p: { orderNumber: string; businessName: string }) =>
    `${p.businessName}: Order #${p.orderNumber} delivered and set up. Enjoy your event! Rply STOP to opt out.`,

  weatherAlert: (p: { orderNumber: string; date: string; businessName: string }) =>
    `${p.businessName}: Weather alert for ${p.date} may affect order #${p.orderNumber}. We'll contact you if changes are needed. Rply STOP to opt out.`,

  paymentReceived: (p: { amount: string; orderNumber: string; businessName: string }) =>
    `${p.businessName}: Payment of $${p.amount} received for order #${p.orderNumber}. Thank you! Rply STOP to opt out.`,

  orderCancelled: (p: { orderNumber: string; businessName: string }) =>
    `${p.businessName}: Order #${p.orderNumber} has been cancelled. Contact us with any questions. Rply STOP to opt out.`,
};
