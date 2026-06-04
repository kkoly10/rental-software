import test from "node:test";
import assert from "node:assert/strict";
import { emailCopy, resolveEmailLocale } from "../lib/email/email-i18n.ts";

test("localized labels per locale", () => {
  assert.equal(emailCopy("en").labels.order, "Order");
  assert.equal(emailCopy("fr").labels.order, "Commande");
  assert.equal(emailCopy("es").labels.order, "Pedido");
  assert.equal(emailCopy("pt").labels.eventDate, "Data do evento");
});

test("resolveEmailLocale falls back to en for unknown/empty", () => {
  assert.equal(resolveEmailLocale("de"), "en");
  assert.equal(resolveEmailLocale(null), "en");
  assert.equal(resolveEmailLocale("es"), "es");
});

test("emailCopy(unknown) falls back to the English bundle", () => {
  // @ts-expect-error testing the runtime fallback for an unsupported code
  assert.equal(emailCopy("xx").quoteSent.heading, emailCopy("en").quoteSent.heading);
});

test("headings are translated per locale (not English)", () => {
  assert.equal(emailCopy("es").paymentReceived.heading, "Pago recibido");
  assert.equal(emailCopy("fr").quoteSent.heading, "Votre devis est prêt !");
  assert.equal(emailCopy("pt").orderConfirmation.heading, "Reserva recebida!");
  assert.equal(emailCopy("fr").orderStatus.statuses.confirmed.heading, "Votre réservation est confirmée !");
});

test("interpolation: payment intro uses first name + payment type", () => {
  assert.match(emailCopy("es").paymentReceived.intro("Sara", "saldo"), /Hola Sara.*saldo/);
});

test("documents intro agrees in number (singular vs plural)", () => {
  const plural = emailCopy("pt").documentsReady.intro("João", "Contrato e Termo", "1042", true);
  const singular = emailCopy("pt").documentsReady.intro("João", "Contrato", "1042", false);
  assert.match(plural, /estão prontos/);
  assert.match(singular, /está pronto/);
});

test("subject lines are localized", () => {
  assert.equal(emailCopy("en").subjects.quoteSent("1042", "Acme"), "Your quote for order #1042 — Acme");
  assert.match(emailCopy("es").subjects.paymentReceived("1042", "Acme"), /Pago recibido del pedido n\.º 1042 — Acme/);
  assert.match(emailCopy("fr").subjects.orderConfirmation("1042", "Acme"), /Réservation n° 1042 reçue/);
  assert.match(emailCopy("pt").subjects.depositReminder("1042", "Acme"), /Lembrete de sinal/);
  assert.match(emailCopy("es").subjects.orderStatus("1042", "Acme", "Entrega programada"), /Entrega programada — pedido n\.º 1042 — Acme/);
});

test("every locale exposes the same key set as en (shape parity)", () => {
  const keys = (o: object): string[] =>
    Object.entries(o).flatMap(([k, v]) =>
      v && typeof v === "object" && typeof v !== "function"
        ? [k, ...keys(v as object).map((s) => `${k}.${s}`)]
        : [k]
    );
  const enKeys = keys(emailCopy("en")).sort();
  for (const loc of ["fr", "es", "pt"] as const) {
    assert.deepEqual(keys(emailCopy(loc)).sort(), enKeys, `locale ${loc} key parity`);
  }
});
