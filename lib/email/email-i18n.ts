/**
 * Localized copy for customer-facing transactional emails.
 *
 * `emailCopy(locale)` returns a fully-typed bundle of every human-readable
 * string used by the customer-facing templates in `templates.ts`. Strings
 * containing interpolated values are exposed as functions; everything else
 * is a plain string. Unknown locales fall back to English.
 *
 * Operator-facing templates (new order alert, operator activity alert,
 * daily schedule digest) are intentionally NOT covered here — they stay
 * English.
 */

export type EmailLocale = "en" | "fr" | "es" | "pt";

const SUPPORTED: readonly EmailLocale[] = ["en", "fr", "es", "pt"];

export function isEmailLocale(value: string | null | undefined): value is EmailLocale {
  return !!value && (SUPPORTED as readonly string[]).includes(value);
}

export function resolveEmailLocale(value: string | null | undefined): EmailLocale {
  return isEmailLocale(value) ? value : "en";
}

// The shape of one locale's copy bundle. `en` is the source of truth; the
// other locales are checked against this type so a missing/renamed key is a
// compile error.
type EmailCopyBundle = {
  labels: {
    order: string;
    item: string;
    eventDate: string;
    subtotal: string;
    deliveryFee: string;
    total: string;
    amount: string;
    method: string;
    balanceRemaining: string;
    refundAmount: string;
    status: string;
    deliveryWindow: string;
    crew: string;
    deliveryTime: string;
    address: string;
    depositToConfirm: string;
    depositDue: string;
  };
  /** "Questions? ..." footer variants. */
  questions: {
    /** Reply to this email[ or contact us at X]. */
    replyOrContact: (email: string | null) => string;
    /** Questions? Contact us at X. (only rendered when email is present) */
    contactAt: (email: string) => string;
    /** Questions or feedback? Contact us at X. */
    feedbackContactAt: (email: string) => string;
  };
  orderConfirmation: {
    heading: string;
    intro: (firstName: string) => string;
    depositRequired: (depositDue: string) => string;
    depositInstructions: string;
    button: string;
  };
  paymentReceived: {
    heading: string;
    intro: (firstName: string, paymentType: string) => string;
    fullyPaidTitle: string;
    fullyPaidBody: string;
    balanceDue: (balance: string) => string;
  };
  refundProcessed: {
    heading: string;
    intro: (firstName: string) => string;
    timing: string;
    contactSuffix: (email: string) => string;
  };
  orderStatus: {
    intro: (firstName: string) => string;
    button: string;
    fallbackHeading: string;
    fallbackBody: string;
    statuses: Record<
      | "awaiting_deposit"
      | "confirmed"
      | "scheduled"
      | "out_for_delivery"
      | "delivered"
      | "completed"
      | "cancelled",
      { heading: string; body: string }
    >;
  };
  documentsReady: {
    heading: string;
    /** Connector used to join document-type names, e.g. " and ". */
    listAnd: string;
    /** Localized display names for known document types (unknown types fall back to title-case). */
    typeNames: Record<"rental_agreement" | "safety_waiver", string>;
    intro: (firstName: string, docList: string, orderNumber: string, plural: boolean) => string;
    button: string;
  };
  /** "Around 10:00 AM" — single-bound delivery-time window value. */
  aroundTime: (time: string) => string;
  eventReminder: {
    heading: string;
    intro: (firstName: string) => string;
    setupNotesTitle: string;
    accessNote: string;
  };
  postEventFollowUp: {
    heading: string;
    intro: (firstName: string, eventDate: string, businessName: string) => string;
    reviewCallout: string;
    reviewButton: string;
    bookAgainPrompt: string;
    bookAgainButton: string;
  };
  quoteSent: {
    heading: string;
    intro: (firstName: string) => string;
    button: string;
    disclaimer: string;
  };
  depositReminder: {
    heading: string;
    intro: (firstName: string) => string;
    button: string;
    preheader: (depositDue: string, orderNumber: string) => string;
  };
  /** Localized customer-facing email subject lines. */
  subjects: {
    orderConfirmation: (orderNumber: string, businessName: string) => string;
    paymentReceived: (orderNumber: string, businessName: string) => string;
    refundProcessed: (orderNumber: string, businessName: string) => string;
    orderStatus: (orderNumber: string, businessName: string, statusText: string) => string;
    documentsReady: (orderNumber: string, businessName: string) => string;
    quoteSent: (orderNumber: string, businessName: string) => string;
    depositReminder: (orderNumber: string, businessName: string) => string;
    eventReminder: (businessName: string) => string;
    postEventFollowUp: (businessName: string) => string;
  };
};

const en: EmailCopyBundle = {
  labels: {
    order: "Order",
    item: "Item",
    eventDate: "Event date",
    subtotal: "Subtotal",
    deliveryFee: "Delivery fee",
    total: "Total",
    amount: "Amount",
    method: "Method",
    balanceRemaining: "Balance remaining",
    refundAmount: "Refund amount",
    status: "Status",
    deliveryWindow: "Delivery window",
    crew: "Crew",
    deliveryTime: "Delivery time",
    address: "Address",
    depositToConfirm: "Deposit to confirm",
    depositDue: "Deposit due",
  },
  questions: {
    replyOrContact: (email) =>
      `Questions? Reply to this email${email ? ` or contact us at ${email}` : ""}.`,
    contactAt: (email) => `Questions? Contact us at ${email}.`,
    feedbackContactAt: (email) => `Questions or feedback? Contact us at ${email}.`,
  },
  orderConfirmation: {
    heading: "Booking received!",
    intro: (firstName) => `Hi ${firstName}, thanks for your reservation. Here are your details:`,
    depositRequired: (depositDue) => `Deposit required: ${depositDue}`,
    depositInstructions:
      "Please submit your deposit to confirm this booking. We'll reach out with payment instructions.",
    button: "Open Secure Customer Portal",
  },
  paymentReceived: {
    heading: "Payment received",
    intro: (firstName, paymentType) => `Hi ${firstName}, we received your ${paymentType} payment.`,
    fullyPaidTitle: "Your booking is fully paid and confirmed!",
    fullyPaidBody: "We'll be in touch with delivery details before your event.",
    balanceDue: (balance) => `Your remaining balance of ${balance} is due before the event date.`,
  },
  refundProcessed: {
    heading: "Refund processed",
    intro: (firstName) => `Hi ${firstName}, a refund has been issued for your order.`,
    timing: "The refund may take 5-10 business days to appear on your statement.",
    contactSuffix: (email) => ` Contact us at ${email} with any questions.`,
  },
  orderStatus: {
    intro: (firstName) => `Hi ${firstName}, here's an update on your booking:`,
    button: "View my order",
    fallbackHeading: "Order updated",
    fallbackBody: "Your order status has been updated.",
    statuses: {
      awaiting_deposit: {
        heading: "Quote accepted — deposit required",
        body: "Thanks for accepting your quote! Your booking will be confirmed once your deposit is received. Use the button below to pay securely.",
      },
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
    },
  },
  documentsReady: {
    heading: "Documents ready to sign",
    listAnd: " and ",
    typeNames: {
      rental_agreement: "Rental Agreement",
      safety_waiver: "Safety Waiver",
    },
    intro: (firstName, docList, orderNumber, plural) =>
      `Hi ${firstName}, your ${docList} for order #${orderNumber} ${plural ? "are" : "is"} ready for your signature.`,
    button: "Review & sign documents",
  },
  aroundTime: (time) => `Around ${time}`,
  eventReminder: {
    heading: "Your rental is tomorrow!",
    intro: (firstName) =>
      `Hi ${firstName}, just a friendly reminder that your rental is coming up tomorrow.`,
    setupNotesTitle: "Setup Notes",
    accessNote:
      "Please ensure the setup area is accessible and clear of obstacles. Our crew will handle everything else!",
  },
  postEventFollowUp: {
    heading: "How was your event?",
    intro: (firstName, eventDate, businessName) =>
      `Hi ${firstName}, we hope your event on ${eventDate} was a blast! Thank you for renting with ${businessName}.`,
    reviewCallout: "Loved it? Leave us a review!",
    reviewButton: "Write a Review",
    bookAgainPrompt: "Planning another event?",
    bookAgainButton: "Book Again",
  },
  quoteSent: {
    heading: "Your quote is ready!",
    intro: (firstName) =>
      `Hi ${firstName}, we've prepared a quote for your upcoming event. Review the details below and accept online to secure your booking.`,
    button: "View & Accept Quote",
    disclaimer: "This quote is not a confirmed booking. Pay your deposit to reserve your date.",
  },
  depositReminder: {
    heading: "Deposit reminder",
    intro: (firstName) =>
      `Hi ${firstName}, your booking is held but not yet confirmed. Submit your deposit to secure your event date.`,
    button: "Pay Deposit",
    preheader: (depositDue, orderNumber) =>
      `Pay your ${depositDue} deposit to confirm order #${orderNumber}.`,
  },
  subjects: {
    orderConfirmation: (orderNumber, businessName) => `Booking #${orderNumber} received — ${businessName}`,
    paymentReceived: (orderNumber, businessName) => `Payment received for order #${orderNumber} — ${businessName}`,
    refundProcessed: (orderNumber, businessName) => `Refund processed for order #${orderNumber} — ${businessName}`,
    orderStatus: (orderNumber, businessName, statusText) => `${statusText} — order #${orderNumber} — ${businessName}`,
    documentsReady: (orderNumber, businessName) => `Documents ready for order #${orderNumber} — ${businessName}`,
    quoteSent: (orderNumber, businessName) => `Your quote for order #${orderNumber} — ${businessName}`,
    depositReminder: (orderNumber, businessName) => `Deposit reminder — order #${orderNumber} — ${businessName}`,
    eventReminder: (businessName) => `Reminder: your rental from ${businessName} is tomorrow!`,
    postEventFollowUp: (businessName) => `How was your event? — ${businessName}`,
  },
};

const fr: EmailCopyBundle = {
  labels: {
    order: "Commande",
    item: "Article",
    eventDate: "Date de l'événement",
    subtotal: "Sous-total",
    deliveryFee: "Frais de livraison",
    total: "Total",
    amount: "Montant",
    method: "Mode de paiement",
    balanceRemaining: "Solde restant",
    refundAmount: "Montant du remboursement",
    status: "Statut",
    deliveryWindow: "Créneau de livraison",
    crew: "Équipe",
    deliveryTime: "Heure de livraison",
    address: "Adresse",
    depositToConfirm: "Acompte à verser",
    depositDue: "Acompte dû",
  },
  questions: {
    replyOrContact: (email) =>
      `Des questions ? Répondez à cet e-mail${email ? ` ou contactez-nous à ${email}` : ""}.`,
    contactAt: (email) => `Des questions ? Contactez-nous à ${email}.`,
    feedbackContactAt: (email) => `Des questions ou des remarques ? Contactez-nous à ${email}.`,
  },
  orderConfirmation: {
    heading: "Réservation reçue !",
    intro: (firstName) =>
      `Bonjour ${firstName}, merci pour votre réservation. Voici les détails :`,
    depositRequired: (depositDue) => `Acompte requis : ${depositDue}`,
    depositInstructions:
      "Merci de verser votre acompte pour confirmer cette réservation. Nous vous communiquerons les instructions de paiement.",
    button: "Ouvrir l'espace client sécurisé",
  },
  paymentReceived: {
    heading: "Paiement reçu",
    intro: (firstName, paymentType) =>
      `Bonjour ${firstName}, nous avons bien reçu votre paiement (${paymentType}).`,
    fullyPaidTitle: "Votre réservation est entièrement payée et confirmée !",
    fullyPaidBody:
      "Nous reviendrons vers vous avec les détails de livraison avant votre événement.",
    balanceDue: (balance) =>
      `Votre solde restant de ${balance} est dû avant la date de l'événement.`,
  },
  refundProcessed: {
    heading: "Remboursement effectué",
    intro: (firstName) =>
      `Bonjour ${firstName}, un remboursement a été émis pour votre commande.`,
    timing: "Le remboursement peut prendre 5 à 10 jours ouvrés pour apparaître sur votre relevé.",
    contactSuffix: (email) => ` Contactez-nous à ${email} pour toute question.`,
  },
  orderStatus: {
    intro: (firstName) =>
      `Bonjour ${firstName}, voici une mise à jour concernant votre réservation :`,
    button: "Voir ma commande",
    fallbackHeading: "Commande mise à jour",
    fallbackBody: "Le statut de votre commande a été mis à jour.",
    statuses: {
      awaiting_deposit: {
        heading: "Devis accepté — acompte requis",
        body: "Merci d'avoir accepté votre devis ! Votre réservation sera confirmée dès réception de votre acompte. Utilisez le bouton ci-dessous pour payer en toute sécurité.",
      },
      confirmed: {
        heading: "Votre réservation est confirmée !",
        body: "Votre événement est réservé. Nous vous enverrons les détails de livraison à l'approche de la date.",
      },
      scheduled: {
        heading: "Livraison planifiée",
        body: "Votre livraison a été planifiée. Notre équipe arrivera le jour de votre événement pour l'installation.",
      },
      out_for_delivery: {
        heading: "Nous arrivons !",
        body: "Notre équipe de livraison est en route vers votre adresse. Merci de veiller à ce que la zone d'installation soit accessible.",
      },
      delivered: {
        heading: "Installation terminée !",
        body: "Votre matériel de location a été installé et est prêt à l'emploi. Profitez bien de votre événement !",
      },
      completed: {
        heading: "Merci d'avoir loué chez nous !",
        body: "Votre location est terminée. Nous espérons que votre événement a été un succès ! Au plaisir de vous revoir.",
      },
      cancelled: {
        heading: "Commande annulée",
        body: "Votre commande a été annulée. Pour toute question concernant les remboursements, n'hésitez pas à nous contacter.",
      },
    },
  },
  documentsReady: {
    heading: "Documents prêts à signer",
    listAnd: " et ",
    typeNames: {
      rental_agreement: "contrat de location",
      safety_waiver: "décharge de responsabilité",
    },
    intro: (firstName, docList, orderNumber, plural) =>
      `Bonjour ${firstName}, ${plural ? "vos" : "votre"} ${docList} pour la commande n° ${orderNumber} ${plural ? "sont prêts" : "est prêt"} à être signé${plural ? "s" : ""}.`,
    button: "Consulter et signer les documents",
  },
  aroundTime: (time) => `Vers ${time}`,
  eventReminder: {
    heading: "Votre location, c'est demain !",
    intro: (firstName) =>
      `Bonjour ${firstName}, petit rappel amical : votre location a lieu demain.`,
    setupNotesTitle: "Notes d'installation",
    accessNote:
      "Merci de veiller à ce que la zone d'installation soit accessible et dégagée. Notre équipe s'occupe du reste !",
  },
  postEventFollowUp: {
    heading: "Comment s'est passé votre événement ?",
    intro: (firstName, eventDate, businessName) =>
      `Bonjour ${firstName}, nous espérons que votre événement du ${eventDate} a été une réussite ! Merci d'avoir loué chez ${businessName}.`,
    reviewCallout: "Vous avez aimé ? Laissez-nous un avis !",
    reviewButton: "Rédiger un avis",
    bookAgainPrompt: "Vous organisez un autre événement ?",
    bookAgainButton: "Réserver à nouveau",
  },
  quoteSent: {
    heading: "Votre devis est prêt !",
    intro: (firstName) =>
      `Bonjour ${firstName}, nous avons préparé un devis pour votre prochain événement. Consultez les détails ci-dessous et acceptez en ligne pour réserver.`,
    button: "Voir et accepter le devis",
    disclaimer:
      "Ce devis ne constitue pas une réservation confirmée. Versez votre acompte pour réserver votre date.",
  },
  depositReminder: {
    heading: "Rappel d'acompte",
    intro: (firstName) =>
      `Bonjour ${firstName}, votre réservation est en attente mais pas encore confirmée. Versez votre acompte pour garantir la date de votre événement.`,
    button: "Verser l'acompte",
    preheader: (depositDue, orderNumber) =>
      `Versez votre acompte de ${depositDue} pour confirmer la commande n° ${orderNumber}.`,
  },
  subjects: {
    orderConfirmation: (orderNumber, businessName) => `Réservation n° ${orderNumber} reçue — ${businessName}`,
    paymentReceived: (orderNumber, businessName) => `Paiement reçu pour la commande n° ${orderNumber} — ${businessName}`,
    refundProcessed: (orderNumber, businessName) => `Remboursement effectué pour la commande n° ${orderNumber} — ${businessName}`,
    orderStatus: (orderNumber, businessName, statusText) => `${statusText} — commande n° ${orderNumber} — ${businessName}`,
    documentsReady: (orderNumber, businessName) => `Documents prêts pour la commande n° ${orderNumber} — ${businessName}`,
    quoteSent: (orderNumber, businessName) => `Votre devis pour la commande n° ${orderNumber} — ${businessName}`,
    depositReminder: (orderNumber, businessName) => `Rappel d’acompte — commande n° ${orderNumber} — ${businessName}`,
    eventReminder: (businessName) => `Rappel : votre location chez ${businessName} a lieu demain !`,
    postEventFollowUp: (businessName) => `Comment s’est passé votre événement ? — ${businessName}`,
  },
};

const es: EmailCopyBundle = {
  labels: {
    order: "Pedido",
    item: "Artículo",
    eventDate: "Fecha del evento",
    subtotal: "Subtotal",
    deliveryFee: "Gastos de entrega",
    total: "Total",
    amount: "Importe",
    method: "Método de pago",
    balanceRemaining: "Saldo pendiente",
    refundAmount: "Importe reembolsado",
    status: "Estado",
    deliveryWindow: "Franja de entrega",
    crew: "Equipo",
    deliveryTime: "Hora de entrega",
    address: "Dirección",
    depositToConfirm: "Depósito para confirmar",
    depositDue: "Depósito pendiente",
  },
  questions: {
    replyOrContact: (email) =>
      `¿Tienes preguntas? Responde a este correo${email ? ` o escríbenos a ${email}` : ""}.`,
    contactAt: (email) => `¿Tienes preguntas? Escríbenos a ${email}.`,
    feedbackContactAt: (email) => `¿Preguntas o comentarios? Escríbenos a ${email}.`,
  },
  orderConfirmation: {
    heading: "¡Reserva recibida!",
    intro: (firstName) =>
      `Hola ${firstName}, gracias por tu reserva. Aquí tienes los detalles:`,
    depositRequired: (depositDue) => `Depósito requerido: ${depositDue}`,
    depositInstructions:
      "Por favor, realiza tu depósito para confirmar esta reserva. Te enviaremos las instrucciones de pago.",
    button: "Abrir portal seguro del cliente",
  },
  paymentReceived: {
    heading: "Pago recibido",
    intro: (firstName, paymentType) =>
      `Hola ${firstName}, hemos recibido tu pago (${paymentType}).`,
    fullyPaidTitle: "¡Tu reserva está totalmente pagada y confirmada!",
    fullyPaidBody: "Nos pondremos en contacto contigo con los detalles de la entrega antes de tu evento.",
    balanceDue: (balance) =>
      `Tu saldo pendiente de ${balance} debe abonarse antes de la fecha del evento.`,
  },
  refundProcessed: {
    heading: "Reembolso procesado",
    intro: (firstName) =>
      `Hola ${firstName}, se ha emitido un reembolso para tu pedido.`,
    timing: "El reembolso puede tardar de 5 a 10 días hábiles en aparecer en tu extracto.",
    contactSuffix: (email) => ` Escríbenos a ${email} si tienes alguna pregunta.`,
  },
  orderStatus: {
    intro: (firstName) =>
      `Hola ${firstName}, aquí tienes una actualización sobre tu reserva:`,
    button: "Ver mi pedido",
    fallbackHeading: "Pedido actualizado",
    fallbackBody: "El estado de tu pedido se ha actualizado.",
    statuses: {
      awaiting_deposit: {
        heading: "Presupuesto aceptado — depósito requerido",
        body: "¡Gracias por aceptar tu presupuesto! Tu reserva se confirmará en cuanto recibamos tu depósito. Usa el botón de abajo para pagar de forma segura.",
      },
      confirmed: {
        heading: "¡Tu reserva está confirmada!",
        body: "Tu evento está asegurado. Te enviaremos los detalles de la entrega a medida que se acerque la fecha.",
      },
      scheduled: {
        heading: "Entrega programada",
        body: "Tu entrega ha sido programada. Nuestro equipo llegará el día de tu evento para el montaje.",
      },
      out_for_delivery: {
        heading: "¡Vamos en camino!",
        body: "Nuestro equipo de entrega se dirige a tu ubicación. Por favor, asegúrate de que la zona de montaje sea accesible.",
      },
      delivered: {
        heading: "¡Montaje completado!",
        body: "Tu equipo de alquiler ya está montado y listo para usar. ¡Disfruta de tu evento!",
      },
      completed: {
        heading: "¡Gracias por alquilar con nosotros!",
        body: "Tu alquiler ha finalizado. ¡Esperamos que tu evento haya sido todo un éxito! Nos encantaría volver a verte.",
      },
      cancelled: {
        heading: "Pedido cancelado",
        body: "Tu pedido ha sido cancelado. Si tienes alguna pregunta sobre reembolsos, no dudes en contactarnos.",
      },
    },
  },
  documentsReady: {
    heading: "Documentos listos para firmar",
    listAnd: " y ",
    typeNames: {
      rental_agreement: "contrato de alquiler",
      safety_waiver: "exención de responsabilidad",
    },
    intro: (firstName, docList, orderNumber, plural) =>
      `Hola ${firstName}, ${plural ? "tus" : "tu"} ${docList} del pedido n.º ${orderNumber} ${plural ? "están listos" : "está listo"} para tu firma.`,
    button: "Revisar y firmar documentos",
  },
  aroundTime: (time) => `Alrededor de las ${time}`,
  eventReminder: {
    heading: "¡Tu alquiler es mañana!",
    intro: (firstName) =>
      `Hola ${firstName}, solo un recordatorio amistoso: tu alquiler es mañana.`,
    setupNotesTitle: "Notas de montaje",
    accessNote:
      "Por favor, asegúrate de que la zona de montaje sea accesible y esté despejada. ¡Nuestro equipo se encargará del resto!",
  },
  postEventFollowUp: {
    heading: "¿Qué tal tu evento?",
    intro: (firstName, eventDate, businessName) =>
      `Hola ${firstName}, ¡esperamos que tu evento del ${eventDate} fuera todo un éxito! Gracias por alquilar con ${businessName}.`,
    reviewCallout: "¿Te encantó? ¡Déjanos una reseña!",
    reviewButton: "Escribir una reseña",
    bookAgainPrompt: "¿Planeas otro evento?",
    bookAgainButton: "Reservar de nuevo",
  },
  quoteSent: {
    heading: "¡Tu presupuesto está listo!",
    intro: (firstName) =>
      `Hola ${firstName}, hemos preparado un presupuesto para tu próximo evento. Revisa los detalles a continuación y acéptalo en línea para asegurar tu reserva.`,
    button: "Ver y aceptar presupuesto",
    disclaimer:
      "Este presupuesto no es una reserva confirmada. Paga tu depósito para reservar tu fecha.",
  },
  depositReminder: {
    heading: "Recordatorio de depósito",
    intro: (firstName) =>
      `Hola ${firstName}, tu reserva está retenida pero aún no confirmada. Realiza tu depósito para asegurar la fecha de tu evento.`,
    button: "Pagar depósito",
    preheader: (depositDue, orderNumber) =>
      `Paga tu depósito de ${depositDue} para confirmar el pedido n.º ${orderNumber}.`,
  },
  subjects: {
    orderConfirmation: (orderNumber, businessName) => `Reserva n.º ${orderNumber} recibida — ${businessName}`,
    paymentReceived: (orderNumber, businessName) => `Pago recibido del pedido n.º ${orderNumber} — ${businessName}`,
    refundProcessed: (orderNumber, businessName) => `Reembolso procesado del pedido n.º ${orderNumber} — ${businessName}`,
    orderStatus: (orderNumber, businessName, statusText) => `${statusText} — pedido n.º ${orderNumber} — ${businessName}`,
    documentsReady: (orderNumber, businessName) => `Documentos listos para el pedido n.º ${orderNumber} — ${businessName}`,
    quoteSent: (orderNumber, businessName) => `Tu presupuesto del pedido n.º ${orderNumber} — ${businessName}`,
    depositReminder: (orderNumber, businessName) => `Recordatorio de depósito — pedido n.º ${orderNumber} — ${businessName}`,
    eventReminder: (businessName) => `Recordatorio: ¡tu alquiler con ${businessName} es mañana!`,
    postEventFollowUp: (businessName) => `¿Qué tal tu evento? — ${businessName}`,
  },
};

const pt: EmailCopyBundle = {
  labels: {
    order: "Pedido",
    item: "Item",
    eventDate: "Data do evento",
    subtotal: "Subtotal",
    deliveryFee: "Taxa de entrega",
    total: "Total",
    amount: "Valor",
    method: "Forma de pagamento",
    balanceRemaining: "Saldo restante",
    refundAmount: "Valor do reembolso",
    status: "Status",
    deliveryWindow: "Janela de entrega",
    crew: "Equipe",
    deliveryTime: "Horário de entrega",
    address: "Endereço",
    depositToConfirm: "Sinal para confirmar",
    depositDue: "Sinal pendente",
  },
  questions: {
    replyOrContact: (email) =>
      `Dúvidas? Responda a este e-mail${email ? ` ou fale conosco em ${email}` : ""}.`,
    contactAt: (email) => `Dúvidas? Fale conosco em ${email}.`,
    feedbackContactAt: (email) => `Dúvidas ou comentários? Fale conosco em ${email}.`,
  },
  orderConfirmation: {
    heading: "Reserva recebida!",
    intro: (firstName) =>
      `Olá ${firstName}, obrigado pela sua reserva. Aqui estão os detalhes:`,
    depositRequired: (depositDue) => `Sinal necessário: ${depositDue}`,
    depositInstructions:
      "Por favor, faça o pagamento do sinal para confirmar esta reserva. Enviaremos as instruções de pagamento.",
    button: "Abrir portal seguro do cliente",
  },
  paymentReceived: {
    heading: "Pagamento recebido",
    intro: (firstName, paymentType) =>
      `Olá ${firstName}, recebemos o seu pagamento (${paymentType}).`,
    fullyPaidTitle: "Sua reserva está totalmente paga e confirmada!",
    fullyPaidBody: "Entraremos em contato com os detalhes da entrega antes do seu evento.",
    balanceDue: (balance) =>
      `O seu saldo restante de ${balance} deve ser pago antes da data do evento.`,
  },
  refundProcessed: {
    heading: "Reembolso processado",
    intro: (firstName) =>
      `Olá ${firstName}, um reembolso foi emitido para o seu pedido.`,
    timing: "O reembolso pode levar de 5 a 10 dias úteis para aparecer no seu extrato.",
    contactSuffix: (email) => ` Fale conosco em ${email} se tiver alguma dúvida.`,
  },
  orderStatus: {
    intro: (firstName) =>
      `Olá ${firstName}, aqui está uma atualização sobre a sua reserva:`,
    button: "Ver meu pedido",
    fallbackHeading: "Pedido atualizado",
    fallbackBody: "O status do seu pedido foi atualizado.",
    statuses: {
      awaiting_deposit: {
        heading: "Orçamento aceito — sinal necessário",
        body: "Obrigado por aceitar o seu orçamento! Sua reserva será confirmada assim que recebermos o sinal. Use o botão abaixo para pagar com segurança.",
      },
      confirmed: {
        heading: "Sua reserva está confirmada!",
        body: "Seu evento está garantido. Enviaremos os detalhes da entrega conforme a data se aproxima.",
      },
      scheduled: {
        heading: "Entrega agendada",
        body: "Sua entrega foi agendada. Nossa equipe chegará no dia do seu evento para a montagem.",
      },
      out_for_delivery: {
        heading: "Estamos a caminho!",
        body: "Nossa equipe de entrega está indo até o seu endereço. Por favor, garanta que a área de montagem esteja acessível.",
      },
      delivered: {
        heading: "Montagem concluída!",
        body: "Seu equipamento de locação foi montado e está pronto para uso. Aproveite o seu evento!",
      },
      completed: {
        heading: "Obrigado por alugar conosco!",
        body: "Sua locação foi concluída. Esperamos que o seu evento tenha sido um sucesso! Adoraríamos ter você de volta.",
      },
      cancelled: {
        heading: "Pedido cancelado",
        body: "Seu pedido foi cancelado. Se tiver alguma dúvida sobre reembolsos, entre em contato conosco.",
      },
    },
  },
  documentsReady: {
    heading: "Documentos prontos para assinar",
    listAnd: " e ",
    typeNames: {
      rental_agreement: "contrato de locação",
      safety_waiver: "termo de responsabilidade",
    },
    intro: (firstName, docList, orderNumber, plural) =>
      `Olá ${firstName}, ${plural ? "seus" : "seu"} ${docList} do pedido n.º ${orderNumber} ${plural ? "estão prontos" : "está pronto"} para a sua assinatura.`,
    button: "Revisar e assinar documentos",
  },
  aroundTime: (time) => `Por volta das ${time}`,
  eventReminder: {
    heading: "Sua locação é amanhã!",
    intro: (firstName) =>
      `Olá ${firstName}, apenas um lembrete amigável: sua locação será amanhã.`,
    setupNotesTitle: "Notas de montagem",
    accessNote:
      "Por favor, garanta que a área de montagem esteja acessível e livre de obstáculos. Nossa equipe cuida do resto!",
  },
  postEventFollowUp: {
    heading: "Como foi o seu evento?",
    intro: (firstName, eventDate, businessName) =>
      `Olá ${firstName}, esperamos que o seu evento em ${eventDate} tenha sido incrível! Obrigado por alugar com a ${businessName}.`,
    reviewCallout: "Gostou? Deixe uma avaliação!",
    reviewButton: "Escrever uma avaliação",
    bookAgainPrompt: "Planejando outro evento?",
    bookAgainButton: "Reservar novamente",
  },
  quoteSent: {
    heading: "Seu orçamento está pronto!",
    intro: (firstName) =>
      `Olá ${firstName}, preparamos um orçamento para o seu próximo evento. Confira os detalhes abaixo e aceite on-line para garantir a sua reserva.`,
    button: "Ver e aceitar orçamento",
    disclaimer:
      "Este orçamento não é uma reserva confirmada. Pague o sinal para garantir a sua data.",
  },
  depositReminder: {
    heading: "Lembrete de sinal",
    intro: (firstName) =>
      `Olá ${firstName}, sua reserva está retida, mas ainda não confirmada. Faça o pagamento do sinal para garantir a data do seu evento.`,
    button: "Pagar sinal",
    preheader: (depositDue, orderNumber) =>
      `Pague o seu sinal de ${depositDue} para confirmar o pedido n.º ${orderNumber}.`,
  },
  subjects: {
    orderConfirmation: (orderNumber, businessName) => `Reserva n.º ${orderNumber} recebida — ${businessName}`,
    paymentReceived: (orderNumber, businessName) => `Pagamento recebido do pedido n.º ${orderNumber} — ${businessName}`,
    refundProcessed: (orderNumber, businessName) => `Reembolso processado do pedido n.º ${orderNumber} — ${businessName}`,
    orderStatus: (orderNumber, businessName, statusText) => `${statusText} — pedido n.º ${orderNumber} — ${businessName}`,
    documentsReady: (orderNumber, businessName) => `Documentos prontos para o pedido n.º ${orderNumber} — ${businessName}`,
    quoteSent: (orderNumber, businessName) => `Seu orçamento do pedido n.º ${orderNumber} — ${businessName}`,
    depositReminder: (orderNumber, businessName) => `Lembrete de sinal — pedido n.º ${orderNumber} — ${businessName}`,
    eventReminder: (businessName) => `Lembrete: sua locação com a ${businessName} é amanhã!`,
    postEventFollowUp: (businessName) => `Como foi o seu evento? — ${businessName}`,
  },
};

const BUNDLES: Record<EmailLocale, EmailCopyBundle> = { en, fr, es, pt };

export function emailCopy(locale: EmailLocale): EmailCopyBundle {
  return BUNDLES[locale] ?? en;
}
