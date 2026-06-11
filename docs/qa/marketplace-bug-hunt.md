# Marketplace Bug Hunt — June 2026

Adversarial audit of the marketplace surface (5 parallel reviewers + cross-cutting
pass). Findings are deduped, verified where noted, and ranked. Severity: **P0**
breaks money/double-booking, **P1** real bug with user impact, **P2** edge/robustness,
**P3** cosmetic.

Status legend: ☐ open · ☑ verified-real · ✗ false-positive (kept for the record).

---

## A. MONEY (payments, refunds, fees, deposits, tax)

1. ☑ **P0 — Webhook marks event succeeded even if the booking DB write fails.** `app/api/market/stripe/webhooks/route.ts` → `confirmPaidBooking`: the Supabase update error is ignored and the event is marked `succeeded`/200, so Stripe never retries — renter charged, booking stuck `awaiting_payment`. Fix: check the update error/row count and throw so Stripe redelivers.
2. ☑ **P0 — Late-fee off-session charge has no idempotency key.** `app/api/cron/market-deposit-holds`: PaymentIntent created before the `late_days_charged` DB write; a crash between them re-charges the same late day next hour. Fix: idempotency key `(booking_id, daysNow)`.
3. ☑ **P0 — Late-fee update has no `.eq("state","overdue")` guard.** Same file: a concurrent return/cancel/dispute between SELECT and UPDATE lets the cron charge a late fee onto a booking that left `overdue`. Fix: state-guard the update.
4. ☑ **P1 — No-show reporters issue the Stripe refund BEFORE the state-guarded write.** `lib/market/cancel-actions.ts` (`reportSellerNoShow`/`reportRenterNoShow`): no `canTransition` guard and refund precedes the CAS, so concurrent no-show + cancel can double-refund. Fix: flip state first with `.eq("state",from)`, check rows, then refund.
5. ☑ **P1 — Cancellation overwrites `refund_cents` instead of incrementing + clamping.** `finalizeCancellation` sets `refund_cents` to the new value; a prior dispute refund is erased and refunds can stack beyond the charge. Fix: clamp to `max(charged - refund_cents, 0)` and increment (mirror dispute-actions).
6. ☑ **P1 — Late-fee daily/flat split can short the seller.** `market-deposit-holds`: `appFee = computePlatformFeeCents(dailyPart) + flat*days`, then `min(appFee, delta)` — when clamped, the seller's daily portion is swallowed into the platform fee. Fix: `application_fee_amount = delta - sellerDailyPortion` explicitly.
7. ☑ **P1 — Cancel refund + finalize not atomic; Stripe refunds, DB write fails, retry double-refunds after the 24h idempotency window.** `renterCancelBooking`. Fix: persist a refund-issued marker before/with the Stripe call; never re-refund without checking it.
8. ☑ **P1 — Dispute capture runs `paymentIntents.capture` before re-reading deposit_status.** Races the claim-window release cron → capture on an already-canceled intent or capture+release conflict. Fix: re-read `deposit_status='held'` (or CAS to `releasing`) immediately before the Stripe call.
9. ☑ **P1 — Claim-window release cron cancels the deposit intent before the guarded DB write.** `market-deposit-holds` vs `resolveDispute` capture — same race as #8 from the other side. Fix: CAS `held→releasing` then cancel.
10. ☑ **P2 — No-show "keep one day" mixes pre-tax day value with tax-inclusive charge.** `cancellation.ts computeRenterNoShowRefund`: renter is shorted tax on the forfeited portion. Fix: compute keep/refund on subtotal, refund tax proportionally.
11. ☑ **P2 — `taxRateForState` defaults unknown states to 6%.** `lib/market/tax.ts`: collects tax with no nexus for any non-DMV state. Fix: return 0 (or refuse) outside the configured nexus set.
12. ☑ **P2 — Chargeback reversal records `dispute.amount` even if part was already refunded+reversed.** `webhooks/route.ts charge.dispute.created`: double-counts recovered funds; no idempotency on the reversal. Fix: reverse only the un-reversed remainder, record net.
13. ☑ **P2 — Re-auth cancel swallows errors then creates a fresh intent.** `market-deposit-holds` re-auth block: old intent may survive and later be captured. Fix: confirm cancel succeeded (or that the intent is gone) before re-placing.
14. ✗ **P2 — checkout `application_fee_amount = fee + tax` could exceed amount.** FALSE POSITIVE for the booking path: enforced $15 minimum subtotal keeps `fee+tax` < `subtotal+tax`. Still: clamp `application_fee_amount` to the charge amount defensively.
15. ☑ **P3 — All Stripe amounts hardcode `currency:"usd"`.** Fine for DMV launch; will break any non-USD seller. Fix: store/use the booking currency.
16. ☑ **P3 — Fractional-cent drift between cancel refund and later dispute refundable.** Rounding leaves ~1¢ unrecoverable per split. Acceptable; note for accounting.

## B. BOOKING ENGINE (holds, state machine, crons, bridge)

17. ☑ **P0 — Double-booking via the `hold_id IS NULL` capacity predicate.** `market_reserve_hold` counts inventory-blocking bookings only where `hold_id IS NULL`; a still-blocking booking whose hold row is `released`/`expired` (but `hold_id` non-null) is counted by neither the holds nor the bookings query → overbooking. Fix: count an inventory-blocking booking unless its hold is currently *active*; or stop retaining the `confirmed` hold and block purely from the bookings table.
18. ☑ **P0 — Timezone-naive date parsing.** `booking-actions.ts`: `new Date("${date}T09:00:00")` parses in server TZ (UTC on Vercel) → "tomorrow 9am" becomes a different calendar day; future-date check, rental-days, and stored window all shift. Fix: construct against `America/New_York` with explicit offset.
19. ☑ **P1 — Bridge consumer marks the outbox row consumed even when the booking is missing / projection write fails.** `market-bridge/route.ts`: "never loses work" claim is false — confirmed projections get dropped; cancelled/completed applied to nonexistent projections then consumed. Fix: only set `consumed_at` after a successful projection write.
20. ☑ **P1 — Instant-book orphan hold on insert failure.** `booking-actions.ts`: hold taken, booking insert errors, function returns without releasing the hold (30-min block). Fix: release the hold on the error branch.
21. ☑ **P1 — Approval orphan hold on lost-update race.** `approveBookingRequest`: hold reserved, then state-guarded update no-ops (0 rows) but the hold is never released (24h block). Fix: if the guarded update affects 0 rows, release the just-created hold.
22. ☑ **P1 — `approve`/`decline` ignore affected-row count.** Unlike `advanceBooking`, they don't `.select()` after the guarded update, so on a race they still log events + send emails as if it worked. Fix: check the updated row, bail if null.
23. ☑ **P1 — Overdue flip has no state guard.** `market-cleanup-holds`: `checked_out → overdue` update keyed only on state=checked_out is fine, but a booking moved to `disputed`/`cancelled` in the same window via a different path can still be force-set `overdue` (illegal transition). Fix: keep the `.eq("state","checked_out")` and also exclude already-advanced rows (it has the guard — verify the cancel path can't leave it checked_out).
24. ☑ **P1 — Self-booking check uses only active org context, not all memberships.** `booking-actions.ts`: a member of the seller org whose active context is null/another org bypasses the "can't book your own listing" check. Fix: compare against `get_user_org_ids()`.
25. ☑ **P2 — SLA auto-cancel doesn't release the request's holds.** `market-cleanup-holds`: a 24h-timeout cancel leaves any hold rows to the separate 5-min expiry. Mostly benign (requests don't hold), but verify no hold leaks. Fix: release holds in the same statement.
26. ☑ **P2 — Stranded `awaiting_payment` if cron outage > 48h.** Payment-timeout cancel only looks back 48h for expired holds. Fix: cancel by joining bookings to any expired hold regardless of age, or inside the RPC.
27. ☑ **P2 — Instant-book hold uses 30-min checkout TTL but UI says "finish payment from My rentals."** Mismatch silently kills a booking presented as successful. Fix: use the 24h payment TTL for instant holds that back a created booking.
28. ☑ **P2 — Rental-day count derived from synthetic 09:00/18:00 hours, not calendar dates.** Diverges from the buffered availability window; off-by-one at the edges. Fix: days = calendar `endDate − startDate` (+1 if inclusive).
29. ☑ **P2 — Late-day `Math.ceil` charges a full day at 2h+1ms late.** `cancellation.ts lateDaysStarted`. By design-ish (Turo rounds up) but worth a small grace beyond the 2h. Note only.
30. ☐ **P2 — Standby queue never inserted or promoted.** `market_reservation_standby` table exists; no writer/promoter anywhere. Spec feature silently absent. Fix: enqueue on `unavailable`, promote on hold release.
31. ☑ **P3 — `instant_book` not re-checked inside the hold RPC.** Toggled-off between read and book still instant-books. Low TOCTOU. Fix: assert in the RPC.

## C. UI / DATA / RENDERING

32. ☑ **P1 — Email HTML injection via seller-controlled listing title.** `lib/market/notify.ts`: `listingTitle`/`extra` interpolated raw into email HTML; a crafted title delivers live HTML/links into inboxes. Fix: HTML-escape all interpolated values.
33. ☑ **P1 — "Pay $X now" button omits tax.** `app/market/rentals/page.tsx`: shows `subtotal` but charges `subtotal+tax`. Fix: display the tax-inclusive amount the action charges.
34. ☑ **P1 — Store-page rating averaged over only the latest 10 reviews.** `app/market/store/[slug]/page.tsx`: `.limit(10)` then avg + `(count)` — wrong average and wrong count at scale. Fix: DB aggregate over all reviews.
35. ☑ **P1 — Search `.or()` injection: `)` and `\` not escaped.** `lib/market/data.ts`: `replace(/[%_,]/g," ")` misses parens/backslash; a `)` breaks out of the PostgREST or-group. Fix: strip `()\\` too (or tokenize).
36. ☑ **P2 — Booking totals shown `toFixed(0)`, dropping cents and tax.** `rentals/page.tsx`. Fix: cents-accurate, tax-inclusive `dollars()` helper.
37. ☑ **P2 — Dates render with server-TZ `toLocaleDateString()` → off-by-one.** Multiple market pages. Fix: format with the metro IANA timezone.
38. ☑ **P2 — Proof-of-function video not byte-sniffed.** `seller-actions.ts uploadProofVideo`: trusts client `file.type` (images are sniffed). Fix: sniff container magic bytes.
39. ☑ **P2 — Evidence + proof media on the PUBLIC uploads bucket.** Evidence photos and proof videos are publicly reachable via `getPublicUrl`; proof path is `orgId/timestamp` (semi-enumerable). Fixed with the correct split: **evidence** (private dispute material, no public render path) → new PRIVATE `market-evidence` bucket, `photo_url` now stores the path, read via admin `createSignedUrl()` (mirrors `market-identity`). **Proof video + listing photo** are *intentional* public listing media rendered on the listing page, so they stay in `uploads` — the real risk there was the sweep (#61), now fixed; proof path also hardened with a random token to kill enumeration/same-ms collision.
40. ☑ **P2 — `published_at` tie-break in ranking is dead code.** `LISTING_SELECT` never selects it, so `rankListings` tie-break compares `""==""`. Fix: select + map `published_at`.
41. ☑ **P3 — Review/profile mutations don't revalidate the store path.** Stale ratings on `/market/store/[slug]` (mitigated by force-dynamic). Fix: `revalidatePath` store route (old+new slug).
42. ☑ **P3 — World tile counts capped at `.limit(1000)`.** Undercount at scale. Fix: `count:"exact",head:true`.
43. ☑ **P3 — Ranking silently degrades to publish-order on any stats error.** Could surface disputed sellers first. By-design best-effort; note.
44. ☑ **P3 — Seller "$X total" labels subtotal as total (no tax).** Cosmetic seller-side. Fix: label "subtotal" or add tax.

---

## (verified non-bugs, recorded so they aren't re-flagged)
- Message thread / listing text render as JSX → React-escaped; no XSS there.
- Marketplace-only seller in operator dashboard: every `getVertical()` lookup falls back to defaults — degrades gracefully.
- Paused-after-request listing: the hold RPC re-checks `published`, so it correctly fails + auto-cancels.

---

*Security/trust section (RLS, identity bucket scoping, moderation bypasses,
admin-gate consistency, OTP hardening, IDOR) appended below from the trust auditor.*

## D. CROSS-CUTTING (own pass)

45. ☑ **P1 — §20 leakage-risk scoring + escalation never built.** `lib/market/moderation.ts` blocks/soft-warns per message but there is no per-thread/account leakage score and no escalating action (flag → account review → restriction → trust escalation) the spec mandates. A user can soft-warn-probe endlessly with no consequence. Fix: persist a leakage score per conversation/account; escalate on threshold.
46. ☑ **P1 — Moderation regex is trivially bypassed.** Obfuscated phone/email/payment ("five five five…", "name [at] gmail", "v e n m o", unicode digits) slips through; conversely the phone regex can false-positive on order numbers/dimensions ("20x30, 1000 sq ft 5551234"). Fix: normalize (strip spacing/leetspeak, unicode-fold) before matching; tune patterns.
47. ☑ **P2 — Evidence handoff form available before the seller's identity check.** `evidence-actions.ts` gates on `booking.state ∈ {ready_for_handoff, checked_out}` but not on `identity_verified_at`; a renter can post "handoff" evidence pre-verification. Minor, but lets evidence predate the actual handoff. Fix: also require identity verified for handoff-phase evidence.
48. ☑ **P2 — Follow-up `would_repeat` accepts a value from renters (ignored) — and the unique(booking_id,party) is the only guard against a flagged→clean re-submit.** Submitting twice is blocked (good), but there's no way to amend an accidental "great" to "problem." Acceptable; note.
49. ☑ **P2 — `confirmRenterIdentity` has no rate limit and no audit of *who* in the org clicked.** Any owner/admin can stamp `identity_verified_at` without the signed-URL panel ever loading (direct form post). Fix: require the panel context or at least log the acting user id.
50. ☑ **P3 — Review allowed once per booking, but a bundle/multi-item booking yields one review for the whole booking** (no per-listing granularity). By design for v1; note.

---

## Tally
50 consolidated findings across money / booking / UI / cross-cutting. **P0: 5** (webhook-drop, late-fee idempotency, late-fee state-guard, double-booking predicate, timezone). **P1: ~17.** Plus the trust/security auditor's set (RLS, identity scoping, OTP, admin gates, IDOR) — appended below.

### Fix-first shortlist (the ones that lose money or break trust on day one)
1. Webhook: throw on failed booking write so Stripe retries (#1)
2. Late-fee idempotency key + state guard (#2, #3)
3. Double-booking capacity predicate (#17)
4. Timezone-correct date parsing (#18)
5. No-show/cancel: refund AFTER the state-guarded CAS (#4, #5, #7)
6. Email HTML-escape the listing title (#32)
7. "Pay $X" must show the taxed amount (#33)
8. Moderation: real leakage scoring + de-obfuscation (#45, #46)

## E. TRUST / SECURITY / RLS

51. ☑ **P1 — Cross-party leak of private follow-up notes + "would rent again."** `migration 20260611_140000` `market_followups_own_read`: both parties can SELECT *all* rows for a booking, so a renter reads the seller's confidential `notes` and `would_repeat`, and vice-versa. Fix: scope the policy to the author's own `party`, or drop the authenticated SELECT entirely (admin reads via service role).
52. ☑ **P1 — OTP brute-force cap is resettable.** `verification-actions.ts`: `sendPhoneOtp` resets `attempts:0` on every send, so an account holder loops send→try-5→send forever against the 6-digit space. Fix: cumulative failure counter not reset by resend; lock after N total.
53. ☑ **P1 — OTP send rate-limited on client key, not `user.id`; no resend cooldown.** Same file: SMS-pump / denial vector. Fix: per-user limit + 60s resend cooldown.
54. ☑ **P2 — Allowed-link check uses substring `.includes(host)`.** `moderation.ts hasDisallowedLink`: `evil.com/?x=korent.app` and `korent.app.attacker.com` pass as trusted. Fix: compare parsed `URL.hostname` (=== host or endsWith `.host`).
55. ☑ **P2 — Support request stores attacker-supplied `booking_id` with no ownership check.** `support-actions.ts`: lets a user spoof association with any booking in your trust queue. Fix: verify ownership (renter or org) before storing, else null.
56. ☑ **P2 — Four duplicated `isPlatformAdmin` copies.** All currently correct, but a future edit to one won't propagate. Fix: single shared `requirePlatformAdmin` helper.
57. ☑ **P2 — Conversation fetched by id via admin client before the party check.** No exploit (line-128 check holds), but enumeration-friendly. Fix: add the renter/org filter to the query itself.
58. (= #46 — moderation obfuscation bypass, confirmed by the security auditor too: `v3nmo`, `five five five`, unicode digits, `name [at] gmail`. Highest-value trust gap.)
59. (= #45 — leakage scoring/escalation absent, confirmed.)
60. ☑ **P3 — PHONE_RE false-positives on serials/dimensions in inquiry**, hard-blocking legit messages and pushing users off-platform. Fix: require separator-grouped phone shape.

### Verified SAFE (primary hunt targets that held up)
- **Private `market-identity` bucket is correctly private** (`public=false`, no `storage.objects` policies → service-role only). Both signed-URL sites are properly scoped: the admin viewer is dispute-gated, and the Seller Hub signs URLs **only for `ready_for_handoff` bookings in the seller's own org** — a seller cannot pull an arbitrary renter's ID, only the one at their own active handoff. This was the #1 worry and it's sound.
- Bookings / holds / messages / disputes / evidence RLS all scope to `auth.uid()` or active `get_user_org_ids()` — no A-reads-B hole except follow-ups (#51).
- All writes go through service-role after explicit party/admin checks; no client INSERT/UPDATE policies on sensitive tables.
- `market_reserve_hold`/`expire_stale_holds` are `security definer`, revoked from anon/authenticated, granted only to `service_role`.
- Identity storage path is server-built from the session `user.id` (UUID) + sniffed ext — no traversal/overwrite.
- `marketSignIn` blocks `//` and off-origin open-redirects.
- Reserved slugs (`rent`/`market`/`marketplace` + auth routes) block host shadowing; seller signup requires confirmed email and no existing org.
- OTP compare itself is `timingSafeEqual` with a length guard — sound (the weakness is the resettable counter, #52).

---

## Run 3 addendum (found while fixing #39)

61. ☑ **P0 — Storage-sweep cron silently deletes all marketplace media after 24h.** `app/api/cron/storage-sweep/route.ts` walks the *entire* `uploads` bucket and removes any object >24h old whose path isn't in `referencedPaths`. That set was built only from `product_images`, org brand settings, and `route_stops` photos — it never included `market_listings.photo_url` (`market-listings/…`) or `market_listings.proof_video_url` (`market-proof/…`). Result: every listing photo and proof video would be deleted a day after upload, gutting the storefront. Fix: add a `market_listings` photo/proof-video query to the referenced-path set. (Evidence dodges this entirely by moving to the private `market-evidence` bucket, which the sweep never walks; with #62 new media lands in `market-media`, also never walked — the sweep entry now protects legacy uploads-bucket paths.)

62. ☑ **P0 — Listing photos + proof videos stored as `getPublicUrl()` links into the PRIVATE `uploads` bucket → every image broken in production.** Discovered on the live DB while applying migrations: `uploads` is private *by design* (phase0_security — crew delivery-proof photos, org-scoped read policies), and public-URL links into a private bucket return 400. The marketplace storefront would have launched with zero working images. Fix: new PUBLIC `market-media` bucket (migration `20260611_190000`) for intentional public listing media; `uploadProofVideo` + the listing-photo upload now write there (service-role only — no client write policies; the sweep never walks it). **Operator-side variant flagged, not fixed here:** crew proof/pickup photos (`lib/crew/actions.ts`) also store `getPublicUrl` links into private `uploads` and render them raw (`pickup-photo-upload.tsx`, equipment-condition card) — broken the same way, pre-existing, needs its own fix (signed URLs at render).

---

## Final count
**62 consolidated, verified findings** distilled from ~100 raw observations across five parallel auditors (dupes merged, 1 false-positive and ~10 non-bugs recorded). Breakdown: **7 P0**, **~22 P1**, **~25 P2**, **~8 P3**.

The recurring root causes are worth fixing structurally, not one-by-one:
- **Stripe money moves before the guarded DB write** (do compare-and-swap on state first, *then* call Stripe) — explains #1, #4, #5, #7, #8, #9.
- **Off-session/webhook charges lack idempotency keys** — #2, #12.
- **The inventory invariant ("blocking booking ⇒ active hold") isn't enforced** — #17, the double-booking risk.
- **User-controlled strings reach HTML/queries unescaped** — #32 (email), #35 (search), #54 (links).
- **Moderation is literal-match only** — #45/#46/#58, the core off-platform-leakage threat.
