import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Marketplace Terms of Service",
  description:
    "The terms that govern renting and listing on Korent Marketplace — fees, deposits, evidence rules, disputes, and arbitration.",
};

/**
 * Marketplace participation agreement (renters + sellers). Drafted
 * 2026-06-12 from the implemented product behavior — the Home Depot
 * rule: every fee and window stated here matches the code that
 * computes it. Structure per the legal-stack research: venue framing
 * (Peerspace/RVshare), AS-IS + assumption of risk, fees-paid cap with
 * carve-outs, Airbnb-§23-style arbitration with opt-out and
 * mass-arbitration batching (Selden v. Airbnb line), ESIGN consent.
 * PENDING one attorney review pass — see docs/marketplace/legal-stack.md.
 */
export default function MarketTermsPage() {
  const h2: React.CSSProperties = { fontSize: 19, margin: "28px 0 10px" };
  const h3: React.CSSProperties = { fontSize: 15, margin: "18px 0 8px" };
  const p: React.CSSProperties = { fontSize: 14, lineHeight: 1.75, margin: "0 0 12px" };
  const caps: React.CSSProperties = { ...p, fontWeight: 700 };

  return (
    <main className="mk-wrap" style={{ maxWidth: 760, padding: "36px 20px 60px" }}>
      <p className="mk-kicker">Legal</p>
      <h1 style={{ fontSize: 30, margin: "6px 0 6px" }}>Marketplace Terms of Service</h1>
      <p className="mk-card-m" style={{ marginBottom: 24 }}>
        Last updated: June 12, 2026 · These terms govern Korent Marketplace
        (rent.korent.app). The Korent software platform for rental businesses
        has its own{" "}
        <a href={`https://${process.env.NEXT_PUBLIC_APP_DOMAIN ?? "korent.app"}/terms`}>
          Terms of Service
        </a>
        . Our <Link href="/privacy">Privacy Policy</Link> covers both.
      </p>

      <p style={caps}>
        PLEASE READ THESE TERMS CAREFULLY. SECTION 17 CONTAINS AN ARBITRATION
        AGREEMENT AND CLASS ACTION WAIVER THAT AFFECT YOUR LEGAL RIGHTS. YOU
        MAY OPT OUT OF ARBITRATION WITHIN 30 DAYS — SEE SECTION 17.6.
      </p>

      <h2 style={h2}>1. Acceptance and eligibility</h2>
      <p style={p}>
        By creating an account on Korent Marketplace, or by browsing, booking,
        or listing, you agree to these Terms. You must be at least 18 years
        old and able to form a binding contract. If you list items on behalf
        of a business, you represent that you have authority to bind that
        business.
      </p>

      <h2 style={h2}>2. Korent is a marketplace, not a party to rentals</h2>
      <p style={p}>
        Korent Marketplace is a venue where people who own items
        (&ldquo;sellers&rdquo;) offer them for rent to people who need them
        (&ldquo;renters&rdquo;). Each confirmed booking forms a rental
        agreement <b>between the renter and the seller</b>, incorporating the
        listing, these Terms, and any rental packet we generate for the
        booking. Korent is not a party to that rental agreement, does not own,
        possess, inspect, certify, store, or deliver listed items, is not a
        lessor or bailee, and is not an agent of any renter or seller, except
        that sellers appoint us as a limited payment-collection agent solely
        to collect amounts due through our payment processor.
      </p>

      <h2 style={h2}>3. Identity verification — what it is and is not</h2>
      <p style={p}>
        Before booking, renters verify a phone number and provide a government
        ID photo and a live selfie; sellers review them in person at handoff.
        Sellers complete identity verification through our payments partner
        (Stripe) when setting up payouts. <b>We do not run background or
        criminal-record checks on anyone, and verification is not an
        endorsement.</b> Verification does not guarantee any person&rsquo;s
        conduct or any item&rsquo;s condition, quality, legality, or safety.
      </p>

      <h2 style={h2}>4. Bookings</h2>
      <p style={p}>
        A booking request gives the seller 24 hours to accept; if they
        don&rsquo;t, it cancels automatically and you pay nothing.
        Instant-book listings reserve immediately. A booking is confirmed when
        payment completes. Multi-item bookings from the same seller form one
        rental agreement with one deposit and one payment.
      </p>

      <h2 style={h2}>5. Fees, deposits, and taxes</h2>
      <p style={p}>
        <b>Renters pay no Korent service fee.</b> The rental price, any
        applicable sales tax, and (closer to handoff) a refundable deposit
        authorization are shown line-by-line before you pay. Korent&rsquo;s
        platform fee is charged to the seller as a percentage of the rental
        price and is disclosed in the Seller Hub before listing.
      </p>
      <p style={p}>
        <b>Deposits are authorization holds, not charges and not
        insurance.</b> The hold is placed on the renter&rsquo;s saved card
        near handoff and released after a clean return. A deposit can be
        captured, in whole or part, <b>only</b> through our dispute process
        (Section 9). Korent collects and remits sales tax where required as a
        marketplace facilitator.
      </p>

      <h2 style={h2}>6. Late returns and non-return</h2>
      <p style={p}>
        Returns have a 2-hour grace window. After it, each started late day
        costs the daily rental rate plus a $20 late fee, charged to the
        renter&rsquo;s saved card, for at most 3 late days — after which the
        rental is treated as a non-return and escalates to a dispute, and may
        be reported as theft where the evidence supports it. Requesting an
        extension before the return time suspends late fees while the request
        is pending; an approved extension retroactively removes late status.
      </p>

      <h2 style={h2}>7. Cancellations</h2>
      <p style={p}>
        Each listing shows its cancellation policy before booking: a full
        refund until the policy&rsquo;s cutoff before handoff, 50% after, and
        a 1-hour full-refund window immediately after booking. Deposits are
        always fully released on cancellation. Sellers who cancel confirmed
        bookings refund the renter in full; repeated seller cancellations
        lower ranking and may lead to suspension.
      </p>

      <h2 style={h2}>8. Condition evidence and claim windows</h2>
      <p style={p}>
        Photo evidence rules protect both sides, and the timestamps are part
        of the agreement: sellers must photograph the item&rsquo;s condition
        at handoff before checkout; renters should photograph it at pickup
        (within 4 hours) and at return (within 24 hours). A seller&rsquo;s
        damage claim must be opened within <b>24 hours of completion</b> and
        must include the seller&rsquo;s post-return photos.{" "}
        <b>A seller who did not record handoff condition photos cannot
        capture the deposit for damage.</b> A renter without pickup photos
        cannot rely on a claim that damage pre-existed the rental. All
        evidence is uploaded in-app and timestamped by our servers.
      </p>

      <h2 style={h2}>9. Disputes between renters and sellers</h2>
      <p style={p}>
        Either party may open a dispute about a booking (damage, non-return,
        no-shows, billing) within the windows above. Korent reviews the
        evidence and decides the outcome, including whether any part of the
        deposit is captured or any rental amount refunded. We aim to
        acknowledge disputes immediately and resolve straightforward ones
        within 72 hours. Our decision on deposit and refund movement through
        the platform is final as between us and each party&rsquo;s use of the
        platform; it does not limit either party&rsquo;s legal rights against
        the other.
      </p>

      <h2 style={h2}>10. Prohibited items and conduct</h2>
      <p style={p}>
        Listings must comply with our restricted-items rules (no firearms,
        recalled products, items you don&rsquo;t own or control, and the other
        categories listed in-product). You may not: misrepresent items or
        identity; take transactions off-platform or solicit off-platform
        payment (our messaging tools enforce this); use the marketplace to
        locate items for theft; scrape or misuse data; or interfere with the
        service. We may remove listings and suspend accounts for violations.
      </p>

      <h2 style={h2}>11. Your content, reviews, and copyright</h2>
      <p style={p}>
        You own the photos, descriptions, reviews, and messages you submit and
        grant Korent a non-exclusive, worldwide, royalty-free license to host
        and display them to operate and promote the marketplace. Reviews must
        reflect genuine completed rentals; buying, trading, or coercing
        reviews is prohibited. If you believe content infringes your
        copyright, send a DMCA notice to legal@korent.app with the material
        identified, your contact information, and the statements required by
        17 U.S.C. § 512(c)(3). We remove infringing content and terminate
        repeat infringers.
      </p>

      <h2 style={h2}>12. Disclaimer of warranties</h2>
      <p style={caps}>
        ITEMS ARE SUPPLIED BY INDEPENDENT SELLERS. THE MARKETPLACE AND ALL
        ITEMS ARE PROVIDED &ldquo;AS IS&rdquo; AND &ldquo;AS AVAILABLE&rdquo;
        WITHOUT WARRANTIES OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING
        MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE, AND
        NON-INFRINGEMENT. KORENT MAKES NO WARRANTY ABOUT ANY LISTING, ITEM,
        SELLER, OR RENTER.
      </p>

      <h2 style={h2}>13. Assumption of risk and release</h2>
      <p style={p}>
        Renting from or to another person carries inherent risk. To the
        maximum extent permitted by law, you assume all risk arising from
        rentals you enter through the marketplace, and you release Korent
        from claims arising out of disputes between you and other users —
        except to the extent caused by Korent&rsquo;s own gross negligence or
        willful misconduct. If you are a California resident, you waive
        California Civil Code § 1542, which says: &ldquo;A general release
        does not extend to claims that the creditor or releasing party does
        not know or suspect to exist in his or her favor at the time of
        executing the release and that, if known by him or her, would have
        materially affected his or her settlement with the debtor or released
        party.&rdquo;
      </p>

      <h2 style={h2}>14. Korent is not an insurer</h2>
      <p style={p}>
        Korent is not an insurance company and does not provide insurance.
        Security deposits and any Korent guarantee programs are contractual
        arrangements, not insurance policies. You are responsible for any
        insurance you need; check whether your homeowner&rsquo;s,
        renter&rsquo;s, or business policies cover items you rent out or
        borrow.
      </p>

      <h2 style={h2}>15. Limitation of liability</h2>
      <p style={caps}>
        TO THE MAXIMUM EXTENT PERMITTED BY LAW, KORENT&rsquo;S TOTAL LIABILITY
        ARISING OUT OF THE MARKETPLACE IS LIMITED TO THE GREATER OF (A) THE
        FEES YOU PAID TO KORENT IN THE 12 MONTHS BEFORE THE CLAIM AND (B)
        $100, AND KORENT IS NOT LIABLE FOR INDIRECT, INCIDENTAL, SPECIAL,
        CONSEQUENTIAL, OR PUNITIVE DAMAGES.
      </p>
      <p style={p}>
        This limitation does not apply to liability that cannot be limited by
        law, including personal injury caused by Korent&rsquo;s own gross
        negligence or willful misconduct. Some jurisdictions don&rsquo;t allow
        certain limitations, so parts of this section may not apply to you.
      </p>

      <h2 style={h2}>16. Indemnification</h2>
      <p style={p}>
        You will indemnify and hold Korent harmless from third-party claims
        arising out of your listings, your items, your rentals, your content,
        or your breach of these Terms, except to the extent caused by
        Korent&rsquo;s own gross negligence or willful misconduct.
      </p>

      <h2 style={h2}>17. Arbitration agreement and class action waiver</h2>
      <p style={caps}>
        THIS SECTION REQUIRES INDIVIDUAL ARBITRATION OF DISPUTES WITH KORENT
        AND WAIVES JURY TRIALS AND CLASS ACTIONS. IT DOES NOT GOVERN DISPUTES
        BETWEEN RENTERS AND SELLERS (SECTION 9).
      </p>
      <h3 style={h3}>17.1 Informal resolution first</h3>
      <p style={p}>
        Before starting arbitration, you must send an individualized written
        notice of your dispute to legal@korent.app (or to our registered
        agent) describing the claim and the relief sought, and give us 30
        days to resolve it. We owe you the same notice and 30 days.
      </p>
      <h3 style={h3}>17.2 Binding arbitration</h3>
      <p style={p}>
        Any dispute between you and Korent arising from these Terms or the
        marketplace that isn&rsquo;t resolved informally will be decided by
        binding individual arbitration administered by the American
        Arbitration Association under its Consumer Arbitration Rules. The
        Federal Arbitration Act governs this section. Korent will pay its
        share of arbitration fees as the AAA rules require, and arbitration
        will take place remotely or in the county where you live.
      </p>
      <h3 style={h3}>17.3 Small-claims carve-out</h3>
      <p style={p}>
        Either party may instead bring an individual claim in small-claims
        court where you live, and either party may seek injunctive relief for
        intellectual-property misuse in court.
      </p>
      <h3 style={h3}>17.4 Class action and jury waiver</h3>
      <p style={caps}>
        ALL DISPUTES ARE RESOLVED ON AN INDIVIDUAL BASIS. YOU AND KORENT
        WAIVE ANY RIGHT TO A JURY TRIAL AND TO PARTICIPATE IN A CLASS,
        COLLECTIVE, OR REPRESENTATIVE ACTION.
      </p>
      <h3 style={h3}>17.5 Coordinated filings</h3>
      <p style={p}>
        If 25 or more similar arbitration demands are filed against Korent
        within 180 days with coordinated counsel, the demands will be
        resolved in staged batches of up to 50, selected alphabetically, with
        one arbitrator per batch, and limitation periods are tolled while a
        demand awaits its batch.
      </p>
      <h3 style={h3}>17.6 Your right to opt out</h3>
      <p style={p}>
        You may opt out of this arbitration agreement entirely by emailing
        legal@korent.app with your account email and the words
        &ldquo;arbitration opt-out&rdquo; within 30 days of first accepting
        these Terms. Opting out does not affect any other part of these
        Terms.
      </p>
      <h3 style={h3}>17.7 Severability</h3>
      <p style={p}>
        If the class waiver is found unenforceable as to a particular claim,
        that claim (and only that claim) proceeds in court, and the rest of
        this section survives.
      </p>

      <h2 style={h2}>18. Electronic records and communications</h2>
      <p style={p}>
        You consent to receive agreements, disclosures, and notices
        electronically, and to transact electronically, under the federal
        ESIGN Act. By providing your phone number you agree to receive text
        messages for verification codes and rental notifications (message and
        data rates may apply; reply STOP to opt out, HELP for help). We keep
        records of the terms version you accepted, with timestamps.
      </p>

      <h2 style={h2}>19. Suspension and termination</h2>
      <p style={p}>
        You may close your account at any time; obligations from existing
        bookings survive. We may suspend or terminate accounts that violate
        these Terms, create risk for other users, or are involved in fraud,
        and may withhold pending payouts connected to suspected fraud while
        we investigate.
      </p>

      <h2 style={h2}>20. Changes to these Terms</h2>
      <p style={p}>
        We may update these Terms. For material changes we&rsquo;ll give at
        least 14 days&rsquo; notice by email or in-product, and the change
        applies prospectively. If you don&rsquo;t agree, stop using the
        marketplace before the effective date; continued use is acceptance.
      </p>

      <h2 style={h2}>21. Governing law</h2>
      <p style={p}>
        These Terms are governed by the laws of the Commonwealth of Virginia,
        without regard to conflict-of-law rules, except that the FAA governs
        Section 17 and consumers retain any non-waivable protections of their
        home state. Court proceedings permitted by these Terms take place in
        the state or federal courts of Virginia, or your home county for
        small claims.
      </p>

      <h2 style={h2}>22. Miscellaneous</h2>
      <p style={p}>
        If any provision is unenforceable, the rest remains in effect. These
        Terms plus the policies they reference are the entire agreement for
        marketplace use. You may not assign your rights; we may assign ours
        in a merger or sale. Our failure to enforce a provision is not a
        waiver. Questions: <b>legal@korent.app</b>.
      </p>
    </main>
  );
}
