/**
 * Storefront baseline legal copy.
 *
 * These render on operator storefronts (`*.korent.app`) when the operator has
 * NOT supplied their own externally-hosted legal pages. They are written from
 * the OPERATOR's point of view (the operator is the business / data controller;
 * Korent is the software provider / processor) — distinct from Korent's own
 * SaaS-level /privacy and /terms, which govern Korent's relationship with the
 * operator, not the operator's relationship with their customer.
 *
 * IMPORTANT: this is a reasonable DRAFT baseline so no storefront ever ships
 * without legal pages. The limitation-of-liability and assumption-of-risk
 * language in particular should be reviewed by qualified counsel, and operators
 * can override it with their own policies in Website settings → Legal pages.
 */

function biz(businessName: string): string {
  return businessName.trim() || "this rental business";
}

export function StorefrontPrivacyBody({
  businessName,
  supportEmail,
}: {
  businessName: string;
  supportEmail: string;
}) {
  const name = biz(businessName);
  return (
    <div className="legal-content">
      <p>
        {name} (&ldquo;we&rdquo;, &ldquo;us&rdquo;) is an independent rental
        business. We use Korent, a software platform, to operate this website and
        process your bookings. This policy explains what information we collect
        when you book with us and how we use it.
      </p>

      <h2>1. Information We Collect</h2>
      <ul>
        <li>
          <strong>Contact details</strong> — your name, email address, and phone
          number.
        </li>
        <li>
          <strong>Booking details</strong> — your event date, delivery or pickup
          address, and the items you request.
        </li>
        <li>
          <strong>Payment information</strong> — payment and deposit records.
          Card payments are processed entirely by Stripe; we never see or store
          your full card number.
        </li>
        <li>
          <strong>Messages</strong> — anything you send us through this site or in
          connection with your booking.
        </li>
      </ul>

      <h2>2. How We Use Your Information</h2>
      <ul>
        <li>To prepare, deliver, and fulfill your rental</li>
        <li>To contact you about your booking, deposit, and delivery</li>
        <li>To process payments and any required deposit</li>
        <li>To keep business records and meet tax and legal obligations</li>
      </ul>

      <h2>3. How Your Information Is Shared</h2>
      <p>We do not sell your personal information. We share it only with:</p>
      <ul>
        <li>
          <strong>Korent</strong> — our software provider, which processes this
          information on our behalf to run the site and our bookings.
        </li>
        <li>
          <strong>Stripe</strong> — to process payments and deposits securely.
        </li>
        <li>
          Service providers (such as delivery help) only as needed to fulfill
          your order.
        </li>
      </ul>

      <h2>4. Data Retention</h2>
      <p>
        We keep booking and payment records for as long as needed to run our
        business and to meet tax and legal obligations.
      </p>

      <h2>5. Your Choices</h2>
      <p>
        You may contact us to access, correct, or request deletion of the
        personal information we hold about you.
      </p>

      <h2>6. Security</h2>
      <p>
        Information is transmitted over encrypted connections, and card payments
        are handled by Stripe under their own security and privacy practices.
      </p>

      <h2>7. Contact</h2>
      <p>
        For privacy questions or requests, contact us
        {supportEmail ? (
          <>
            {" "}at <strong>{supportEmail}</strong>
          </>
        ) : (
          " using the contact details on this site"
        )}
        .
      </p>
    </div>
  );
}

export function StorefrontTermsBody({
  businessName,
  supportEmail,
}: {
  businessName: string;
  supportEmail: string;
}) {
  const name = biz(businessName);
  return (
    <div className="legal-content">
      <h2>1. About These Terms</h2>
      <p>
        These terms govern rentals you book from {name}, an independent business.
        {" "}
        {name} — not Korent — is responsible for the rental, the equipment,
        delivery, setup, and service. Korent provides the booking software only
        and is not a party to your rental.
      </p>

      <h2>2. Bookings &amp; Payment</h2>
      <p>
        Prices, deposits, delivery fees, and availability are set by {name}.
        Payments and any required deposit are processed securely through Stripe. A
        deposit may be required to reserve your date.
      </p>

      <h2>3. Cancellations &amp; Refunds</h2>
      <p>
        Cancellation and refund terms are set by {name}. Please contact us for our
        current policy before booking.
      </p>

      <h2>4. Safety &amp; Assumption of Risk</h2>
      <p>
        Rental equipment — including inflatables and event gear — carries inherent
        risks. You agree to follow all safety instructions, provide a safe and
        suitable setup location, and supervise use at all times. {name} may
        require you to sign a separate rental agreement and liability waiver
        before delivery.
      </p>

      <h2>5. Your Responsibilities</h2>
      <ul>
        <li>Provide accurate booking and contact information</li>
        <li>Ensure the setup area is safe, accessible, and suitable</li>
        <li>Use the equipment only as intended and follow all instructions</li>
        <li>Return the equipment in the condition it was received, normal wear excepted</li>
      </ul>

      <h2>6. Limitation of Liability</h2>
      <p>
        To the fullest extent permitted by law, {name}&rsquo;s total liability
        arising from your rental is limited to the amount you paid for that
        rental. Korent, as the software provider, is not a party to the rental and
        is not liable for the rental, the equipment, or its use.
      </p>

      <h2>7. Contact</h2>
      <p>
        For questions about these terms, contact us
        {supportEmail ? (
          <>
            {" "}at <strong>{supportEmail}</strong>
          </>
        ) : (
          " using the contact details on this site"
        )}
        .
      </p>
    </div>
  );
}
