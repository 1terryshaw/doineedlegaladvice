const verticalConfig = {
  id: "doineedlegaladvice",
  name: "DoINeedLegalAdvice.com",
  domain: "www.doineedlegaladvice.com",
  displayDomain: "doineedlegaladvice.com",
  tagline: "Tell us your situation. We'll find the right lawyer.",
  description:
    "AI-driven legal triage. Describe your situation, get matched to the right type of lawyer.",

  entityName: "Lawyer",
  entityNamePlural: "Lawyers",

  // Branding
  primaryColor: "#0f4c75",
  primaryColorDark: "#082e47",
  ctaColor: "#e07a00",
  ctaColorHover: "#b56300",
  heroGradientFrom: "#0f4c75",
  heroGradientVia: "#3282b8",
  heroGradientTo: "#bbe1fa",
  cardGradientFrom: "#1a365d",
  cardGradientTo: "#2a4a7f",

  // Supabase table prefix
  tablePrefix: "legal_",

  // === BILLING ===
  siteforgeEnabled: true,
  listingsTable: "legal_listings",
  inquiriesTable: "legal_inquiries",

  // Contact info
  supportEmail: "hello@doineedlegaladvice.com",

  // Social media
  instagramHandle: "",

  // Listing noun (singular/plural) — kept for backward compat
  listingNoun: "lawyer",
  listingNounPlural: "lawyers",

  // Category/type of business
  businessType: "LegalService",

  // Default country
  defaultCountry: "US",

  // Categories
  categories: [
    "family-lawyer",
    "real-estate-lawyer",
    "immigration-lawyer",
    "criminal-lawyer",
    "personal-injury-lawyer",
    "business-lawyer",
    "employment-lawyer",
    "estate-lawyer",
    "tax-lawyer",
    "intellectual-property-lawyer",
  ],

  // Chat system prompt — warm legal-help persona, strict 2-3 question turn flow
  chatSystemPrompt: `You are a warm, plain-language legal-help person — like a friend who's spent years pointing people to the right legal resource — duty counsel, legal aid, paralegals, lawyers — chatting with someone on FreeLawyerAdvice.ca. You are not a gatekeeper or a referral funnel. The visitor came here for help; your job is to actually help them.

Tone:
- Conversational, warm, encouraging. Use phrases like "Most people..." / "This is super common" / "Totally normal" to normalize the issue when it fits.
- Acknowledge feelings ("ugh, that's stressful" / "that sounds frustrating") when it fits.
- No corporate, advisor, or consultant vibe.
- Keep responses under ~100 words. Plain text only. No markdown (no **bold**, no *italic*, no bullet lists).

TURN FLOW — STRICT RULE:
You MUST ask 2-3 clarifying questions across your first 1-3 turns BEFORE giving substantive advice or recommending a lawyer.

- Turn 1: Acknowledge the situation warmly in one short sentence. Ask 1-2 questions about specifics (what kind of issue — criminal, family, employment, landlord-tenant, immigration, civil claim, estate; province; whether there's a deadline / court date in the next 14 days). Don't ask all at once — pick what matters most.
- Turn 2: Acknowledge their answer. Ask 1-2 follow-up questions to fill in gaps (context, timing, constraints, what they've already tried).
- Turn 3: If you still need clarity, ask one more question. Otherwise, begin delivering helpful, specific advice based on what you've learned.
- Turn 4+: Real, actionable advice — specific options, timing, what to watch for, what NOT to do. Treat the visitor as capable.

Directory CTA: only after multiple turns of being genuinely helpful. Never on turn 1, never on turn 2 unless emergency, rarely on turn 3. The CTA button appears automatically — you don't need to redirect.

EXCEPTION — EMERGENCY SAFETY BRANCHES:
The clarifying-questions rule does NOT apply when the user's first message describes any of:
- Arrest in progress or being held in custody
- Court date in the next 48 hours with no representation
- Domestic violence or child-safety emergency happening NOW

For these, respond directly on turn 1 with the appropriate safety branch — bypass questions. Lives and safety come first.

- ARREST / CUSTODY: "Anyone being held has the right to speak with duty counsel free of charge — ask the officer to call duty counsel right now. Don't answer questions until that call happens. In every province there's a 24/7 duty-counsel line (legal aid)."
- COURT DATE < 48H: "Call the legal aid office for your province today and ask for emergency duty counsel. If you're representing yourself, the court's family/criminal/civil registrar can usually point you to a duty-counsel desk that morning."
- DV / CHILD-SAFETY EMERGENCY: "Call 911 if anyone is in immediate danger. After safety is handled, a family lawyer or victim-services intake line is the next step. Shelter intake lines often have legal-aid advocates on staff."

GOOD turn 1 examples (default, non-emergency):
- "I might get evicted" → "Evictions are stressful but very often workable. Quick q's: which province, and have you received any written notice yet (and if yes, what kind / what date)?"
- "I want to sue my employer" → "Employment disputes are common and there's usually a clear path forward. What province are you in, and what's the core issue — termination, unpaid wages, harassment, something else?"

BAD turn 1 examples (avoid):
- Premature referral: "I'd recommend connecting with a local lawyer who can assess in person..."
- Premature punt: "While I can offer some general guidance, a professional would be best suited to..."
- Premature solution: launching into a long checklist without knowing context.
- Bullet lists or numbered steps on turn 1.`,

  // FAQs
  crossReferrals: [
    { name: 'Not Sure Which Pro?', url: 'https://doineedapro.com', description: 'Free AI triage — tell us your problem, we\'ll tell you which type of pro to call' },
  ],

  faqs: [
    {
      question: "Is this service really free?",
      answer:
        "Yes! Our AI legal guidance tool is completely free to use. We help you understand your legal situation and find the right type of lawyer at no cost.",
    },
    {
      question: "Is this legal advice?",
      answer:
        "No. FreeLawyerAdvice.ca provides general legal information only. This is not legal advice and does not create a lawyer-client relationship. Always consult with a qualified lawyer for advice specific to your situation.",
    },
    {
      question: "What types of lawyers can I find here?",
      answer:
        "We cover family lawyers, real estate lawyers, immigration lawyers, criminal defence lawyers, personal injury lawyers, business lawyers, employment lawyers, estate lawyers, tax lawyers, and intellectual property lawyers across Ontario.",
    },
    {
      question: "How does the AI triage work?",
      answer:
        "Describe your legal situation to our AI assistant. It will ask clarifying questions, help you understand your options, and recommend the right type of lawyer for your needs. It then connects you to relevant lawyers in our directory.",
    },
    {
      question: "How do I claim my listing as a lawyer?",
      answer:
        "If you are a lawyer listed in our directory, click the 'Claim Listing' button on your profile page. You will verify your identity via email, and then gain access to manage your listing, respond to inquiries, and upgrade your plan.",
    },
  ],

  // Design personality
  design: {
    primaryColor: '#1a365d',
    accentColor: '#3B82F6',
    personalityWord: 'sharp',
    personalityIcon: 'Scale',
    heroPattern: 'none' as const,
    loadingMessages: [
      'Reviewing the case...',
      'Consulting the statutes...',
      'Preparing the brief...',
      'Checking the precedents...',
      'Building the argument...',
    ],
    notFoundMessage: 'That page was overruled.',
  },

  // FIX-EMPIRE-SEARCHBAR-SWEEP — adapter fields required by canonical SearchBar
  supportedCountries: ["CA", "US"] as const,
  provinceLabels: {
    ON: "Ontario",
    BC: "British Columbia",
    AB: "Alberta",
    QC: "Quebec",
    MB: "Manitoba",
    SK: "Saskatchewan",
    NS: "Nova Scotia",
    NB: "New Brunswick",
    NL: "Newfoundland & Labrador",
    PE: "Prince Edward Island",
    NT: "Northwest Territories",
    NU: "Nunavut",
    YT: "Yukon",
    AL: "Alabama",
    AK: "Alaska",
    AZ: "Arizona",
    AR: "Arkansas",
    CA: "California",
    CO: "Colorado",
    CT: "Connecticut",
    DE: "Delaware",
    FL: "Florida",
    GA: "Georgia",
    HI: "Hawaii",
    ID: "Idaho",
    IL: "Illinois",
    IN: "Indiana",
    IA: "Iowa",
    KS: "Kansas",
    KY: "Kentucky",
    LA: "Louisiana",
    ME: "Maine",
    MD: "Maryland",
    MA: "Massachusetts",
    MI: "Michigan",
    MN: "Minnesota",
    MS: "Mississippi",
    MO: "Missouri",
    MT: "Montana",
    NE: "Nebraska",
    NV: "Nevada",
    NH: "New Hampshire",
    NJ: "New Jersey",
    NM: "New Mexico",
    NY: "New York",
    NC: "North Carolina",
    ND: "North Dakota",
    OH: "Ohio",
    OK: "Oklahoma",
    OR: "Oregon",
    PA: "Pennsylvania",
    RI: "Rhode Island",
    SC: "South Carolina",
    SD: "South Dakota",
    TN: "Tennessee",
    TX: "Texas",
    UT: "Utah",
    VT: "Vermont",
    VA: "Virginia",
    WA: "Washington",
    WV: "West Virginia",
    WI: "Wisconsin",
    WY: "Wyoming",
    DC: "District of Columbia",
  } as Record<string, string>,
};

export default verticalConfig;
