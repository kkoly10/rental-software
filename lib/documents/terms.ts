/**
 * Rental-agreement & safety-waiver terms by vertical.
 *
 * Pure data + a resolver, with NO path-alias or jsPDF imports, so it can
 * be unit-tested directly with `node --test` (same pattern as
 * lib/market/evidence-summary.ts). The PDF generator imports getTerms
 * from here.
 *
 * These are operator-grade boilerplate, NOT lawyer-reviewed text — a
 * legal pass on the generated templates is a tracked founder action.
 */

export type DocumentTermsType = "rental_agreement" | "safety_waiver";

// Generic event-rental terms covering tents, tables-and-chairs, and
// dance-floors. These verticals share enough operational shape
// (delivery + setup at a venue, rental period bracketed by an event,
// weather considerations) that one shared block reads cleanly.
// Inflatables keeps its own version because the safety / supervision
// language is materially different.
const EVENT_RENTAL_TERMS: string[] = [
  "1. RENTAL PERIOD & RETURN: Equipment is delivered and picked up at the agreed times. The rental period begins upon delivery and ends at pickup. Customer is responsible for the equipment until it is retrieved.",
  "2. DAMAGE & LIABILITY: Customer accepts full responsibility for all damage to the equipment during the rental period, including damage caused by misuse, weather, or negligence. Normal wear is excluded.",
  "3. PAYMENT: Full balance is due no later than the event date. Deposits are non-refundable. Cancellations within 72 hours of the event forfeit the full deposit.",
  "4. WEATHER POLICY: Setup may be postponed or canceled if severe weather (high winds, lightning, heavy rain) makes installation unsafe. Customer may reschedule once at no charge under these conditions.",
  "5. SETUP AREA: Customer is responsible for providing a clean, level, obstacle-free area suitable for installation, plus reasonable access for the delivery crew. Additional setup fees apply for inaccessible locations or relocations.",
  "6. SITE CONDITIONS: Customer is responsible for marking buried utilities, sprinkler lines, and irrigation before the crew arrives. The rental company is not liable for damage caused by undisclosed obstructions.",
  "7. PERMITS & APPROVALS: Customer is responsible for any permits, venue approvals, or HOA notifications required for the installation.",
  "8. INDEMNIFICATION: Customer agrees to indemnify and hold harmless the rental company, its owners and employees from any claims, damages, or injuries arising from use of the rented equipment.",
];

const EVENT_SAFETY_WAIVER_TERMS: string[] = [
  "1. ASSUMPTION OF RISK: I understand that the use of rental equipment at an event involves risks, including those associated with weather, surface conditions, and crowd movement. I voluntarily assume all such risks.",
  "2. RELEASE OF LIABILITY: In consideration for the use of this equipment, I, on behalf of myself and my guests, hereby release and discharge the rental company from any and all claims, demands, or causes of action arising from participation.",
  "3. SUPERVISION: I certify that responsible adults will supervise the installation and venue during the rental period.",
  "4. PROPER USE: I agree to use the equipment only as intended (no climbing on tents or tables, no overloading capacities, no relocating during the event without rental company approval).",
  "5. ANCHORING & SAFETY: I acknowledge the rental company's setup decisions including anchoring methods, sandbags, and exclusion zones, and agree not to alter or remove them.",
  "6. ACKNOWLEDGMENT: I have read this waiver, understand its terms, and sign it voluntarily. I am at least 18 years of age and have the authority to sign on behalf of all participants.",
];

// Photo booths & concessions are ATTENDED, per-hour services where the
// operator's staff runs the equipment on site — so the terms differ from
// the drop-and-go event-rental block (which assumes the customer is left
// in control of the gear). Previously both fell through to the generic
// event-rental terms, which read oddly (a "no climbing on tents" waiver
// for a photo booth).
const PHOTO_BOOTH_TERMS: string[] = [
  "1. RENTAL PERIOD & ATTENDANT: Service covers the booked hours (with the stated minimum). A trained attendant operates the booth for the full rental window; idle time requested by the customer counts toward the booked hours.",
  "2. DAMAGE & LIABILITY: Customer is responsible for damage to the booth, props, backdrop, or printer caused by guests' misuse or negligence during the event. Normal wear is excluded.",
  "3. PAYMENT: A deposit reserves the date; the balance is due by the event date. Deposits are non-refundable. Cancellations within the disclosed cancellation window forfeit the deposit.",
  "4. POWER & SPACE: Customer must provide a dedicated grounded 110V outlet within 25 feet and a level, covered area of roughly 8'×8' (or as specified for the booth). Outdoor setups require shade/weather protection.",
  "5. SETUP & ACCESS: Customer is responsible for reasonable load-in access and a confirmed setup window before guests arrive. Additional fees apply for stairs, long carries, or delayed access.",
  "6. PROPS & PRINTS: Props and print templates are provided as described in the booking. Lost or damaged props may be charged at replacement cost.",
  "7. CONNECTIVITY: Live galleries, text, or social sharing depend on venue Wi-Fi or cellular signal, which the rental company cannot guarantee; photos are delivered after the event if connectivity is unavailable.",
  "8. INDEMNIFICATION: Customer agrees to indemnify and hold harmless the rental company, its owners and employees from any claims, damages, or injuries arising from use of the equipment.",
];

const CONCESSION_TERMS: string[] = [
  "1. RENTAL PERIOD & OPERATION: Service covers the booked hours (with the stated minimum). Where an attendant is included, the rental company's staff operates the machine; for self-serve rentals the customer assumes full responsibility for safe operation.",
  "2. DAMAGE & LIABILITY: Customer is responsible for damage to the machine caused by misuse, improper cleaning, or negligence during the rental period. Normal wear is excluded.",
  "3. PAYMENT: A deposit reserves the date; the balance is due by the event date. Deposits are non-refundable. Cancellations within the disclosed cancellation window forfeit the deposit.",
  "4. POWER & SPACE: Customer must provide a dedicated grounded 110V outlet within 25 feet and a sturdy, level surface. Machines draw significant power; sharing a circuit with other equipment may trip breakers and is the customer's responsibility.",
  "5. CONSUMABLES & SUPPLIES: Servings counts are estimates based on typical use; actual yield varies. Consumables are included only as stated in the booking. The customer may not substitute unapproved supplies.",
  "6. FOOD HANDLING: For self-serve rentals, the customer is responsible for safe food handling, allergen disclosure to guests, and compliance with local health regulations. The rental company is not liable for foodborne illness arising from customer handling.",
  "7. CLEANING & RETURN: Equipment must be returned in clean condition (or as agreed); additional cleaning fees apply to machines returned with hardened residue or damage.",
  "8. INDEMNIFICATION: Customer agrees to indemnify and hold harmless the rental company, its owners and employees from any claims, damages, or injuries arising from use of the equipment.",
];

const PHOTO_BOOTH_WAIVER_TERMS: string[] = [
  "1. ASSUMPTION OF RISK: I understand that use of a photo booth at an event involves risks, including those associated with electrical equipment, cords, props, and crowd movement. I voluntarily assume all such risks.",
  "2. RELEASE OF LIABILITY: In consideration for the use of this equipment, I, on behalf of myself and my guests, hereby release and discharge the rental company from any and all claims arising from participation.",
  "3. ELECTRICAL SAFETY: I agree not to allow tampering with power cords, lighting, or the booth's electrical components, and to keep liquids away from the equipment.",
  "4. PROPER USE: I agree that guests will use the booth, props, and backdrop as intended and will not climb on, lean against, or relocate the equipment.",
  "5. IMAGE RELEASE: I understand photos are captured at the event. Unless I notify the rental company in writing otherwise, I grant permission for anonymized sample images to be used for promotional purposes.",
  "6. ACKNOWLEDGMENT: I have read this waiver, understand its terms, and sign it voluntarily. I am at least 18 years of age and have authority to sign on behalf of all participants.",
];

const CONCESSION_WAIVER_TERMS: string[] = [
  "1. ASSUMPTION OF RISK: I understand that concession equipment involves hot surfaces, moving parts, and electrical components, and that food products carry allergen and foodborne-illness risks. I voluntarily assume all such risks.",
  "2. RELEASE OF LIABILITY: In consideration for the use of this equipment, I, on behalf of myself and my guests, hereby release and discharge the rental company from any and all claims arising from use of the equipment or consumption of products made with it.",
  "3. ALLERGEN ACKNOWLEDGMENT: I understand products may contain or contact common allergens. For self-serve rentals, I am responsible for informing my guests of potential allergens.",
  "4. SUPERVISION & SAFE USE: I certify that a responsible adult (18+) will operate or supervise the equipment, keep children clear of hot surfaces, and follow all provided operating instructions.",
  "5. ELECTRICAL & BURN SAFETY: I agree to keep the equipment on a stable surface away from water, and not to bypass or tamper with electrical or heating components.",
  "6. ACKNOWLEDGMENT: I have read this waiver, understand its terms, and sign it voluntarily. I am at least 18 years of age and have authority to sign on behalf of all participants.",
];

const RENTAL_AGREEMENT_TERMS: Record<string, string[]> = {
  tents: EVENT_RENTAL_TERMS,
  "tables-and-chairs": EVENT_RENTAL_TERMS,
  "dance-floors": EVENT_RENTAL_TERMS,
  "photo-booths": PHOTO_BOOTH_TERMS,
  concessions: CONCESSION_TERMS,
  inflatable: [
    "1. RENTAL PERIOD & RETURN: Equipment must be available for pickup at the agreed time. Rental period begins upon delivery and ends at pickup. Customer is responsible for the equipment until it is retrieved.",
    "2. DAMAGE & LIABILITY: Customer accepts full responsibility for all damage to the equipment during the rental period, including damage caused by misuse, weather, or negligence. Normal wear is excluded.",
    "3. PAYMENT: Full balance is due no later than the event date. Deposits are non-refundable. Cancellations within 72 hours of the event forfeit the full deposit.",
    "4. WEATHER POLICY: Equipment must not be used during severe weather including high winds, lightning, or heavy rain. Customer may reschedule once at no charge if weather conditions are dangerous.",
    "5. SUPERVISION: An adult 18+ must supervise the equipment at all times. The renter assumes all responsibility for safe use.",
    "6. CAPACITY & USE: Equipment must not exceed posted weight/capacity limits. No shoes, sharp objects, or food on equipment. Violating these rules may result in immediate removal with no refund.",
    "7. SETUP AREA: Customer is responsible for providing a clean, level, obstacle-free area with access to a dedicated electrical outlet within 100 feet. Any additional setup fees for inaccessible locations are the customer's responsibility.",
    "8. INDEMNIFICATION: Customer agrees to indemnify and hold harmless the rental company, its owners and employees from any claims, damages, or injuries arising from use of the rented equipment.",
  ],
  car: [
    "1. RENTAL PERIOD & RETURN: The vehicle must be returned by the agreed return date and time. Late returns are subject to additional daily charges. Customer is responsible for the vehicle from pickup to return.",
    "2. AUTHORIZED DRIVERS: Only the named renter and any additional drivers listed at the time of booking are authorized to operate the vehicle. Unauthorized drivers void coverage.",
    "3. DAMAGE & LIABILITY: Customer accepts full financial responsibility for all damage to the vehicle during the rental period, including collision, vandalism, and theft. Customer should carry their own auto insurance or purchase the rental company's protection plan.",
    "4. FUEL POLICY: The vehicle must be returned with the same fuel level as at pickup. Refueling fees apply if returned with less fuel.",
    "5. TRAFFIC & VIOLATIONS: Customer is responsible for all traffic citations, tolls, and parking violations incurred during the rental period.",
    "6. PROHIBITED USE: The vehicle may not be used for: commercial purposes, off-road driving, towing, transporting hazardous materials, or any illegal activity.",
    "7. GEOGRAPHIC RESTRICTIONS: The vehicle may not be taken outside the agreed geographic area without prior written authorization.",
    "8. INDEMNIFICATION: Customer agrees to indemnify and hold harmless the rental company from any claims, damages, or liabilities arising from the customer's use of the vehicle.",
  ],
  equipment: [
    "1. RENTAL PERIOD & RETURN: Equipment must be returned by the agreed return date. Late returns are subject to additional rental charges. Customer is responsible for the equipment from delivery or pickup until return.",
    "2. DAMAGE & LIABILITY: Customer accepts full financial responsibility for all damage, loss, or theft of the equipment during the rental period. Normal wear is excluded.",
    "3. PAYMENT: Full balance is due at the start of the rental period. Deposits are non-refundable unless canceled within the allowed cancellation window.",
    "4. QUALIFIED OPERATORS: Customer certifies that all operators of the equipment are qualified and trained for its safe operation. Customer assumes full liability for misuse or operator error.",
    "5. PROHIBITED USE: Equipment may not be modified, sublet, or used outside the scope for which it was designed. Overloading or misuse voids all protections.",
    "6. MAINTENANCE & INSPECTION: Customer agrees to inspect the equipment upon receipt and report any pre-existing damage before use. Equipment must be returned in the same condition, ordinary wear excepted.",
    "7. COMPLIANCE: Customer agrees to comply with all applicable local, state, and federal safety regulations governing the use of the rented equipment.",
    "8. INDEMNIFICATION: Customer agrees to indemnify and hold harmless the rental company, its owners and employees from any claims, damages, or injuries arising from use of the rented equipment.",
  ],
};

const SAFETY_WAIVER_TERMS: Record<string, string[]> = {
  tents: EVENT_SAFETY_WAIVER_TERMS,
  "tables-and-chairs": EVENT_SAFETY_WAIVER_TERMS,
  "dance-floors": EVENT_SAFETY_WAIVER_TERMS,
  "photo-booths": PHOTO_BOOTH_WAIVER_TERMS,
  concessions: CONCESSION_WAIVER_TERMS,
  inflatable: [
    "1. ASSUMPTION OF RISK: I understand that the use of rental equipment involves risks, including but not limited to falls, collisions, and entrapment. I voluntarily assume all such risks.",
    "2. RELEASE OF LIABILITY: In consideration for the use of this equipment, I, on behalf of myself and any minor children in my care, hereby release and discharge the rental company from any and all claims, demands, or causes of action arising from participation.",
    "3. SAFETY RULES: I agree to enforce all posted safety rules, including no shoes, no rough play, no food or drinks on equipment, and maintaining capacity limits at all times.",
    "4. ADULT SUPERVISION: I certify that a responsible adult (18+) will supervise the equipment and all participants at all times during the rental period.",
    "5. MEDICAL AUTHORIZATION: In the event of an emergency involving a minor, I authorize emergency medical treatment and accept financial responsibility for any costs incurred.",
    "6. PHOTO RELEASE: I grant permission for photos taken at the event to be used by the rental company for promotional purposes, unless I notify them in writing to the contrary.",
    "7. ACKNOWLEDGMENT: I have read this waiver, understand its terms, and sign it voluntarily. I am at least 18 years of age and have the authority to sign on behalf of all participants.",
  ],
  car: [
    "1. ASSUMPTION OF RISK: I understand that operating a motor vehicle involves inherent risks. I voluntarily assume all risks associated with driving the rental vehicle.",
    "2. DRIVER CERTIFICATION: I certify that I hold a valid driver's license appropriate for the class of vehicle rented and am legally permitted to drive in the jurisdiction where the vehicle will be operated.",
    "3. CONDITION ACKNOWLEDGMENT: I have inspected the vehicle and agree that any damage not noted on the vehicle condition report at pickup is my responsibility.",
    "4. INSURANCE REPRESENTATION: I represent that I carry adequate auto liability insurance or have purchased the rental company's protection plan for the duration of this rental.",
    "5. COMPLIANCE: I agree to operate the vehicle in compliance with all applicable traffic laws and regulations.",
    "6. ACKNOWLEDGMENT: I have read this waiver, understand its terms, and sign it voluntarily. I am at least 18 years of age.",
  ],
  equipment: [
    "1. ASSUMPTION OF RISK: I understand that the operation of heavy or powered equipment involves inherent risks, including mechanical failure, operator error, and environmental hazards. I voluntarily assume all such risks.",
    "2. OPERATOR COMPETENCY: I certify that I (and any operators I designate) am trained and competent in the safe operation of the rented equipment and hold any required licenses or certifications.",
    "3. SAFETY COMPLIANCE: I agree to follow all applicable OSHA regulations, manufacturer guidelines, and site safety requirements during use of the equipment.",
    "4. PRE-USE INSPECTION: I agree to inspect the equipment before each use and immediately report any defects, damage, or unsafe conditions to the rental company.",
    "5. RELEASE OF LIABILITY: I hereby release and discharge the rental company from any and all claims arising from my use or misuse of the equipment, to the extent permitted by law.",
    "6. ACKNOWLEDGMENT: I have read this waiver, understand its terms, and sign it voluntarily. I am at least 18 years of age and have the authority to sign on behalf of my organization.",
  ],
};

export function getTerms(
  documentType: DocumentTermsType,
  businessType: string,
): string[] {
  const map = documentType === "rental_agreement" ? RENTAL_AGREEMENT_TERMS : SAFETY_WAIVER_TERMS;
  // Unknown business types fall through to the generic event-rental
  // block — previously they got the inflatable terms which mention
  // bouncers and "no shoes" rules, which would read as oddly specific
  // for, say, a hardware-equipment operator that landed on the
  // wrong key. The event-rental block reads cleanly across every
  // delivery-driven vertical.
  const fallback =
    documentType === "rental_agreement" ? EVENT_RENTAL_TERMS : EVENT_SAFETY_WAIVER_TERMS;
  return map[businessType] ?? fallback;
}

/**
 * Resolve the clauses a document should render: an operator's saved
 * custom clauses (from document_templates) win when present and non-empty
 * (after trimming blanks); otherwise the built-in per-vertical defaults.
 */
export function resolveDocumentClauses(
  custom: readonly string[] | null | undefined,
  documentType: DocumentTermsType,
  businessType: string,
): string[] {
  const cleaned = (custom ?? []).map((c) => c.trim()).filter((c) => c.length > 0);
  return cleaned.length > 0 ? cleaned : getTerms(documentType, businessType);
}
