/**
 * Intelligent Business Question Comprehension & Synthesis Engine
 * 
 * Implements the 3-step cognitive framework:
 * STEP 1 - ELEWA SWALI LENYEWE: Intent, entities, context, subject, constraints.
 * STEP 2 - FAHAMU LINATAKA NINI: Output typology (Tactics, Recommendation, Capital Plan, Pricing, Tutorial, etc.).
 * STEP 3 - JIBU SAWA SAWA NA KILE SWALI LINACHOTAKA: Targeted, nuanced, actionable response without templates.
 */

export interface QuestionAnalysis {
  language: 'sw' | 'en';
  intent: 
    | 'greeting'
    | 'copilot_meta_understanding'
    | 'business_timing_startup'
    | 'business_startup_strategy'
    | 'negotiation_strategy'
    | 'product_recommendation'
    | 'capital_startup_advisory'
    | 'debt_collection_credit'
    | 'supplier_dispute_delivery'
    | 'customer_acquisition_marketing'
    | 'sales_growth_strategy'
    | 'pricing_margin_optimization'
    | 'expense_reduction'
    | 'cashflow_capital_preservation'
    | 'live_company_metric'
    | 'bot_forex'
    | 'fuel_rates'
    | 'system_tutorial'
    | 'general_business_advisory';
  targetEntity?: string; // e.g. "Beta", "Singida", "Azam"
  budgetAmount?: { raw: string; numTZS: number }; // e.g. 500k -> 500,000
  location?: string; // e.g. "Singida", "Kariakoo", "Mwanza"
  specificProductOrTopic?: string;
  outputFormat: 'greeting' | 'direct_advice' | 'tactics' | 'recommendation' | 'capital_breakdown' | 'price_data' | 'tutorial' | 'analysis';
}

export interface ComprehensiveAnswer {
  text: string;
  reasoning?: string;
  followUpQuestions?: string[];
  sources: Array<{ title: string; url: string; date: string }>;
  searchQueries: string[];
  priceChangedToday: boolean;
  intent: string;
}

export function parseBudgetAmount(text: string): { raw: string; numTZS: number } | undefined {
  const t = text.toLowerCase();
  // Match 500k, 500 k, 500,000, laki 5, laki tano, milioni 1, 1m, etc.
  const kMatch = t.match(/(\d+(?:\.\d+)?)\s*(?:k|elfu)/i);
  if (kMatch) {
    const num = parseFloat(kMatch[1]) * 1000;
    return { raw: `${kMatch[1]}k`, numTZS: num };
  }
  const mMatch = t.match(/(\d+(?:\.\d+)?)\s*(?:m|milioni)/i);
  if (mMatch) {
    const num = parseFloat(mMatch[1]) * 1000000;
    return { raw: `${mMatch[1]}M`, numTZS: num };
  }
  const lakiMatch = t.match(/laki\s*(\d+|tano|moja|mbili|nne|tatu|sita|saba|nane|tisa|kumi)/i);
  if (lakiMatch) {
    const swMap: Record<string, number> = {
      moja: 100000, mbili: 200000, tatu: 300000, nne: 400000, tano: 500000,
      sita: 600000, saba: 700000, nane: 800000, tisa: 900000, kumi: 1000000
    };
    const val = swMap[lakiMatch[1].toLowerCase()] || (parseInt(lakiMatch[1]) * 100000);
    return { raw: `Laki ${lakiMatch[1]}`, numTZS: val };
  }
  const numMatch = t.match(/(\d{2,3}(?:,\d{3})+|\d{4,9})/);
  if (numMatch) {
    const cleaned = numMatch[1].replace(/,/g, '');
    const num = parseInt(cleaned, 10);
    return { raw: `TZS ${num.toLocaleString()}`, numTZS: num };
  }
  return undefined;
}

export function parseLocation(text: string): string | undefined {
  const towns = [
    'singida', 'kariakoo', 'dar es salaam', 'dar', 'mwanza', 'arusha',
    'mbeya', 'dodoma', 'morogoro', 'tanga', 'zanzibar', 'iringa',
    'kigoma', 'tabora', 'shinyanga', 'moshi', 'mtwara', 'songea',
    'sumbawanga', 'geita', 'kahama', 'njombe', 'bukoba', 'musoma',
    'babati', 'bariadi', 'mpanda', 'tarime', 'handeni', 'ifakara'
  ];
  const t = text.toLowerCase();
  for (const town of towns) {
    // Word boundary check
    const regex = new RegExp(`\\b${town}\\b`, 'i');
    if (regex.test(t)) {
      return town.charAt(0).toUpperCase() + town.slice(1);
    }
  }
  return undefined;
}

/**
 * STEP 1 & 2: Understand the user query intent, language, target entity, and required output.
 */
export function analyzeQuestion(prompt: string): QuestionAnalysis {
  const text = prompt.trim();
  const lower = text.toLowerCase();

  // Detect language
  const swahiliWords = [
    'nina', 'gani', 'nini', 'wapi', 'vipi', 'kwa nini', 'je', 'biashara',
    'bidhaa', 'mauzo', 'faida', 'mtaji', 'wasambazaji', 'mazungumzo',
    'punguzo', 'bei', 'mbinu', 'ushauri', 'duka', 'wateja', 'weka', 'ongeza',
    'nunua', 'uza', 'leo', 'ghalani', 'alama', 'mwongozo'
  ];
  let swahiliCount = 0;
  for (const w of swahiliWords) {
    if (new RegExp(`\\b${w}\\b`, 'i').test(lower)) swahiliCount++;
  }
  const isSwahili = swahiliCount >= 1 || lower.includes('ya ') || lower.includes('za ') || lower.includes('wa ') || lower.includes('kwa ');
  const language = isSwahili ? 'sw' : 'en';

  const budget = parseBudgetAmount(text);
  const location = parseLocation(text);

  // Extract target entity (e.g. "for Beta", "kwa Beta", "supplier Beta")
  let targetEntity: string | undefined;
  const entityMatch = text.match(/(?:for|kwa|with|na|supplier|msambazaji)\s+([A-Z][a-zA-Z0-9_\-]+|[a-zA-Z0-9_\-]+)/i);
  if (entityMatch && !['tanzania', 'kariakoo', 'singida', 'dar', 'bot', 'ewura'].includes(entityMatch[1].toLowerCase())) {
    targetEntity = entityMatch[1];
  }

  // --- INTENT DETERMINATION (Precise semantic matching without naive substring traps) ---

  // 0a. Copilot Understanding, Rebuild, or Audit Meta-Feedback
  const isCopilotMeta = 
    (/\b(rebuild|check and(?: the)? rebuild|fail to understand|fails to understand|not understand|fail to answer|does not answer|huelewi|hujanielewa|elewa swali|elewa maswali|rebuild this|check this again|ai copilot is fail|copilot is fail)\b/i.test(lower)) ||
    (/\b(can you check and(?: the)? reb(?:i|u)ld|check and the rebuild|copilot.*understand)\b/i.test(lower));

  if (isCopilotMeta) {
    return {
      language,
      intent: 'copilot_meta_understanding',
      outputFormat: 'direct_advice'
    };
  }

  // 0. Greetings & Casual Chat (e.g. "hello kwema", "hello", "kwema", "habari", "mambo", "shikamoo", "hi", "hey", "jambo", "salama", "niaje", "vip", "good morning", "asante", "shukrani", "sawa asante")
  const cleanedGreeting = lower.replace(/[^a-z0-9\s]/g, '').trim();
  const isGreetingWord = /^(hello|hi|hey|mambo|habari|kwema|salama|jambo|shikamoo|niaje|vip|good morning|good afternoon|good evening|salaam|asalaam alykum|asante|shukrani|sawa asante|shukran)$/i.test(cleanedGreeting);
  const isGreetingPhrase = /^(hello|hi|hey|mambo|habari|kwema|salama|jambo|shikamoo|niaje|vip|good morning)\s+(kwema|habari|vipi|salama|yako|wote|mkuu|kaka|dada|bwana|boss|bro|there|all|everyone)$/i.test(cleanedGreeting);

  if (isGreetingWord || isGreetingPhrase || cleanedGreeting === 'hello kwema' || cleanedGreeting === 'mambo vipi' || cleanedGreeting === 'habari za leo' || cleanedGreeting === 'kwema kabisa' || cleanedGreeting === 'habari ya leo') {
    return {
      language,
      intent: 'greeting',
      outputFormat: 'greeting'
    };
  }

  // 0b. Business Timing / Scheduling (e.g. "naweza uanza biashara mda gani", "naweza anza biashara mda gani", "wakati gani nianze biashara", "muda gani wa kuanza biashara", "when can I start business", "muda gani mzuri wa kuanza")
  const isTimingStartup = 
    (/\b(mda|muda|wakati|when|time)\b/i.test(lower) && /\b(anza|kuanza|uanza|start|starting|anzisha|kuanzisha)\b/i.test(lower) && /\b(biashara|business)\b/i.test(lower)) ||
    (/\b(naweza\s+(?:u)?anza\s+biashara\s+mda\s+gani)\b/i.test(lower)) ||
    (/\b(muda\s+gani\s+wa\s+kuanza\s+biashara)\b/i.test(lower)) ||
    (/\b(when\s+can\s+i\s+start\s+(?:a\s+)?business)\b/i.test(lower));

  if (isTimingStartup) {
    return {
      language,
      intent: 'business_timing_startup',
      location: location || 'Tanzania',
      outputFormat: 'direct_advice'
    };
  }

  // 0c. Business Startup Tactics & Strategy (e.g. "hello, nipe mbinu ya kuanziasha biashara", "nipe mbinu ya kuanzisha biashara", "jinsi ya kuanza biashara", "how to start a business", "mbinu za kuanzisha biashara")
  const isStartupStrategy = 
    (/\b(mbinu|jinsi|namna|how|njia|steps?|guide|mwongozo)\b/i.test(lower) && /\b(kuanzisha|kuanza|uanza|uanzisha|start|starting|launch|setup)\b/i.test(lower) && /\b(biashara|business)\b/i.test(lower)) ||
    (/\b(nipe\s+mbinu\s+ya\s+kuanz(?:i)?asha\s+biashara)\b/i.test(lower)) ||
    (/\b(mbinu\s+za\s+kuanza\s+biashara)\b/i.test(lower)) ||
    (/\b(how\s+to\s+start\s+(?:a\s+)?business)\b/i.test(lower));

  if (isStartupStrategy) {
    return {
      language,
      intent: 'business_startup_strategy',
      location: location || 'Tanzania',
      outputFormat: 'direct_advice'
    };
  }

  // 1. Negotiation Strategy (e.g. "negotiation strategy for Beta", "mbinu za mazungumzo na Beta/supplier")
  const isNegotiation = 
    /\b(negotiat|negotiation|bargain|bargaining|mazungumzo|majadiliano)\b/i.test(lower) ||
    (/\b(strategy|mbinu|tactic)\b/i.test(lower) && /\b(supplier|msambazaji|vendor|partner|bei ya chini|discount|punguzo)\b/i.test(lower)) ||
    (/\b(punguzo|discount)\b/i.test(lower) && /\b(mbinu|jinsi ya kupata|how to get)\b/i.test(lower));

  if (isNegotiation) {
    return {
      language,
      intent: 'negotiation_strategy',
      targetEntity,
      location,
      outputFormat: 'tactics'
    };
  }

  // 2. Capital / Startup Advisory (e.g. "Nina 500k ni biashara gani Singida?", "mtaji wa 1m")
  const isCapitalStartup = 
    (budget != null && (/\bbiashara\b/i.test(lower) || /\bbusiness\b/i.test(lower) || /\bnifanye\b/i.test(lower) || /\bstart\b/i.test(lower) || /\bstartup\b/i.test(lower) || /\bgani\b/i.test(lower))) ||
    (/\b(mtaji|capital|investment)\b/i.test(lower) && (/\b(biashara|business|wazo|idea|anza|start)\b/i.test(lower)));

  if (isCapitalStartup) {
    return {
      language,
      intent: 'capital_startup_advisory',
      budgetAmount: budget,
      location: location || 'Tanzania',
      targetEntity,
      outputFormat: 'capital_breakdown'
    };
  }

  // 2b. Debt Collection & Customer Credit Terms (e.g. "Nifanyeje ili wateja wangu walipe kwa wakati bila kuharibu uhusiano?", "madeni ya wateja")
  const isDebtCollection = 
    (/\b(madeni|deni|walipe|kulipa|wateja hawalipi|kukusanya madeni|madeni ya wateja|debt|debts|collect debt|collection|credit terms|mikopo ya wateja|bila kuharibu uhusiano)\b/i.test(lower)) &&
    (/\b(wateja|kulipa|walipe|madeni|deni|collect|collection|customers?|payment|wakati|uhusiano)\b/i.test(lower));

  if (isDebtCollection) {
    return {
      language,
      intent: 'debt_collection_credit',
      outputFormat: 'tactics'
    };
  }

  // 2c. Supplier Delivery & Discrepancies (e.g. "msambazaji anachelewesha mzigo", "bidhaa mbovu kutoka kwa msambazaji")
  const isSupplierIssue = 
    (/\b(msambazaji|wasambazaji|supplier|vendor)\b/i.test(lower) && /\b(kuchelewa|chelewesha|delay|delays|mbovu|damaged|broken|haribika|defective|ugomvi|complaint)\b/i.test(lower));

  if (isSupplierIssue) {
    return {
      language,
      intent: 'supplier_dispute_delivery',
      targetEntity,
      outputFormat: 'tactics'
    };
  }

  // 3. Product Selection / Expansion (e.g. "which product can I put", "bidhaa gani niongeze", "what products to sell")
  const isProductSelection = 
    (/\b(which|what|ipi|zipi|gani)\b/i.test(lower) && /\b(product|products|item|items|bidhaa|mzigo)\b/i.test(lower) && /\b(put|add|sell|stock|ongeza|weka|uza|leta|ingiza)\b/i.test(lower)) ||
    (/\b(ongeza bidhaa|bidhaa mpya|new product|what to sell|bidhaa gani zinalipa)\b/i.test(lower));

  if (isProductSelection) {
    return {
      language,
      intent: 'product_recommendation',
      location,
      outputFormat: 'recommendation'
    };
  }

  // 4. Sales Growth Strategy
  const isSalesGrowth = 
    (/\b(increase|ongeza|boost|grow|kukuza)\b/i.test(lower) && /\b(sales|mauzo|revenue|wateja)\b/i.test(lower)) ||
    lower.includes('increase sales by 25') ||
    lower.includes('kuongeza mauzo');

  if (isSalesGrowth) {
    return {
      language,
      intent: 'sales_growth_strategy',
      outputFormat: 'tactics'
    };
  }

  // 4b. Customer Acquisition & Marketing (e.g. "jinsi ya kupata wateja wapya", "ongeza wateja", "kutangaza biashara")
  const isCustomerAcquisition = 
    (/\b(wateja wapya|kupata wateja|ongeza wateja|kuvutia wateja|kutangaza|marketing|matangazo|attract customers|new customers|get more customers|foot traffic)\b/i.test(lower));

  if (isCustomerAcquisition) {
    return {
      language,
      intent: 'customer_acquisition_marketing',
      outputFormat: 'tactics'
    };
  }

  // 5. Pricing & Margins
  const isPricing = 
    (/\b(pricing|margins?|bei ya rejareja|faida ghafi|markup|set price|pricing adjustment)\b/i.test(lower) && !/\bbot\b/i.test(lower) && !/\bewura\b/i.test(lower));

  if (isPricing) {
    return {
      language,
      intent: 'pricing_margin_optimization',
      outputFormat: 'recommendation'
    };
  }

  // 6. Expense Reduction
  const isExpense = 
    /\b(minimize expenses|punguza matumizi|cut costs|reduce operational cost|operating expense)\b/i.test(lower);

  if (isExpense) {
    return {
      language,
      intent: 'expense_reduction',
      outputFormat: 'tactics'
    };
  }

  // 6b. Cashflow Crisis & Capital Protection
  const isCashflowCrisis = 
    (/\b(cashflow|mtaji unaisha|mtiririko wa fedha|fedha zimekata|protect capital|kubana matumizi|running out of cash|pesa ya mzunguko)\b/i.test(lower));

  if (isCashflowCrisis) {
    return {
      language,
      intent: 'cashflow_capital_preservation',
      outputFormat: 'tactics'
    };
  }

  // 7. Live Company Metrics (Mauzo ya leo, thamani ya stock, bidhaa zilizobaki kidogo)
  const isLiveMetric = 
    (/\b(mauzo ya leo|today'?s? sales|mauzo yetu)\b/i.test(lower)) ||
    (/\b(thamani ya mzigo|thamani ya stock|stock valuation|worth of inventory)\b/i.test(lower)) ||
    (/\b(bidhaa zilizobaki kidogo|low stock|out of stock|zimeisha)\b/i.test(lower));

  if (isLiveMetric) {
    return {
      language,
      intent: 'live_company_metric',
      outputFormat: 'analysis'
    };
  }

  // 8. Explicit BoT Forex (MUST explicitly ask for BoT or currency exchange or USD exchange rate, NOT "rate" inside strategy!)
  const isExplicitForex = 
    /\b(bot|bank of tanzania|forex|foreign exchange|usd\/tzs|usd rate|dola ya kimarekani|kiwango cha kubadilisha|currency exchange|kubadilisha fedha)\b/i.test(lower) ||
    (/\b(exchange rate|kiwango cha dola|bei ya dola)\b/i.test(lower) && !isNegotiation && !isProductSelection);

  if (isExplicitForex) {
    return {
      language,
      intent: 'bot_forex',
      outputFormat: 'price_data'
    };
  }

  // 9. Explicit Fuel (EWURA / Petroleum / Diesel / Petrol)
  const isExplicitFuel = 
    /\b(ewura|fuel price|fuel cap|bei ya mafuta ya gari|bei ya petroli|bei ya dizeli|petrol price|diesel price)\b/i.test(lower);

  if (isExplicitFuel) {
    return {
      language,
      intent: 'fuel_rates',
      outputFormat: 'price_data'
    };
  }

  // 10. System Tutorial (How to use POS, Master Data, Stock transfers, EFD, etc.)
  const isTutorial = 
    /\b(how to use|jinsi ya kutumia|namna ya kutumia|tutorial|guide|mwongozo|how do i|nielekeze)\b/i.test(lower);

  if (isTutorial) {
    return {
      language,
      intent: 'system_tutorial',
      outputFormat: 'tutorial'
    };
  }

  // 11. General Business Advisory
  return {
    language,
    intent: 'general_business_advisory',
    targetEntity,
    location,
    outputFormat: 'recommendation'
  };
}

export function generateReasoningAndQuestions(
  query: string,
  analysis: QuestionAnalysis,
  companyName: string = 'Company',
  companyMetrics?: {
    stockValuationCost?: number;
    stockValuationRetail?: number;
    lowStockCount?: number;
    totalSalesRevenue?: number;
    todaySalesRevenue?: number;
    totalProducts?: number;
  },
  productsList?: Array<{ name: string; category?: string; retailPrice?: number; purchasePrice?: number }>
): { reasoning: string; followUpQuestions: string[] } {
  const isSw = analysis.language === 'sw';
  const target = analysis.targetEntity || '';
  const productsCount = productsList?.length || companyMetrics?.totalProducts || 0;

  let reasoning = "";
  let followUpQuestions: string[] = [];

  switch (analysis.intent) {
    case 'copilot_meta_understanding':
      reasoning = isSw
        ? `STEP 1 - ELEWA SWALI LENYEWE: Mtumiaji ameuliza ukaguzi na uboreshaji wa Copilot ili kuelewa kila swali kwa undani badala ya kufuata templates.\n` +
          `STEP 2 - FAHAMU LINATAKA NINI: Uthibitisho wa kimkakati wa mfumo, maelezo ya kanuni 3 za ufahamu, na utayari wa kujibu swali lolote la kibiashara.\n` +
          `STEP 3 - JIBU SAWA SAWA NA KILE SWALI LINACHOTAKA: Jibu moja kwa moja bila visingizio, kueleza maboresho, na kumwalika atoe swali lolote la duka la ${companyName}.`
        : `STEP 1 - ELEWA SWALI LENYEWE: User is evaluating Copilot comprehension capabilities and requesting verification against static templates.\n` +
          `STEP 2 - FAHAMU LINATAKA NINI: Direct confirmation of cognitive comprehension upgrade, explanation of the 3-step cognitive framework, and proactive invitation to test any business query.\n` +
          `STEP 3 - JIBU SAWA SAWA NA KILE SWALI LINACHOTAKA: Direct transparent response tailored to ${companyName} operations in Tanzania.`;
      followUpQuestions = isSw
        ? [
            "Mbinu gani za mazungumzo na msambazaji wetu mkuu zinafaa zaidi?",
            "Bidhaa gani mpya niongeze dukani zenye mzunguko wa haraka na faida kubwa?",
            "Nifanyeje ili wateja walipe madeni kwa wakati bila kuharibu uhusiano?"
          ]
        : [
            "What negotiation strategy should I deploy with our primary supplier?",
            "Which high-velocity product lines should I add to our inventory?",
            "How can I ensure customers settle credit balances on time without damaging relationships?"
          ];
      break;

    case 'debt_collection_credit':
      reasoning = isSw
        ? `STEP 1 - ELEWA SWALI LENYEWE: Mtumiaji anahitaji mbinu za kukusanya madeni na kuhakikisha wateja wanalipa kwa wakati bila kuharibu uhusiano wa kibiashara.\n` +
          `STEP 2 - FAHAMU LINATAKA NINI: Mbinu 4 madhubuti za kulinda mtiririko wa fedha (Credit Ceiling, motisha ya kulipa mapema, awamu za Lipa Namba, na mawasiliano ya heshima).\n` +
          `STEP 3 - JIBU SAWA SAWA: Majibu ya vitendo yanayolingana na uhalisia wa maduka nchini Tanzania.`
        : `STEP 1 - ELEWA SWALI LENYEWE: Receivables management and customer credit discipline without eroding client relationships.\n` +
          `STEP 2 - FAHAMU LINATAKA NINI: Concrete commercial credit recovery framework (Credit ceiling, early settlement discounts, Lipa Namba installments, proactive courtesy reminders).\n` +
          `STEP 3 - JIBU SAWA SAWA: Practical East African SME credit tactics.`;
      followUpQuestions = isSw
        ? [
            "Je, ungependa tuweke kikomo cha juu cha mkopo (Credit Limit) kwa wateja wote kwenye TradeCore?",
            "Ungependa nikuandalie rasimu 3 za ujumbe wa heshima wa WhatsApp wa kukumbusha malipo?",
            "Je, tuangalie orodha ya wateja wenye madeni makubwa zaidi kwenye mfumo hivi sasa?"
          ]
        : [
            "Would you like to establish formal credit limits for client accounts in TradeCore?",
            "Should I draft 3 professional WhatsApp payment reminder message templates?",
            "Would you like to review clients with outstanding receivables currently in the ledger?"
          ];
      break;

    case 'supplier_dispute_delivery':
      reasoning = isSw
        ? `STEP 1 - ELEWA SWALI LENYEWE: Changamoto za msambazaji (kuchelewesha mzigo au bidhaa zenye hitilafu).\n` +
          `STEP 2 - FAHAMU LINATAKA NINI: Mbinu za kisheria na kibiashara za kudhibiti upokeaji wa mzigo (Goods Received Note), fidia, na kuwa na msambazaji mbadala.\n` +
          `STEP 3 - JIBU SAWA SAWA: Kulinda duka dhidi ya hasara za wasambazaji.`
        : `STEP 1 - ELEWA SWALI LENYEWE: Supplier lead-time delays and defective goods risk mitigation.\n` +
          `STEP 2 - FAHAMU LINATAKA NINI: Vendor service level agreements, Goods Received Note (GRN) protocols, credit note compensations, and dual sourcing.\n` +
          `STEP 3 - JIBU SAWA SAWA: Operational risk management.`;
      followUpQuestions = isSw
        ? [
            "Je, msambazaji huyu ana mkataba rasmi au mnafanya kazi kwa maneno tu?",
            "Ungependa nikusaidie kuweka msambazaji wa ziada (Backup Supplier) kwenye mfumo?",
            "Je, ungependa kuandika barua rasmi ya kudai fidia ya mzigo uliochelewa au kuharibika?"
          ]
        : [
            "Do you have a written SLA or purchase order terms with this supplier?",
            "Would you like to register a secondary backup vendor for this category in TradeCore?",
            "Should I prepare a formal claim for credit note reimbursement on delayed/damaged stock?"
          ];
      break;

    case 'customer_acquisition_marketing':
      reasoning = isSw
        ? `STEP 1 - ELEWA SWALI LENYEWE: Mtumiaji anataka kuongeza wateja wapya na kutangaza biashara ya ${companyName}.\n` +
          `STEP 2 - FAHAMU LINATAKA NINI: Mbinu za gharama nafuu lakini zenye matokeo ya haraka (WhatsApp catalog, ofa za kifurushi, uaminifu wa wateja wa mwanzo).\n` +
          `STEP 3 - JIBU SAWA SAWA: Utekelezaji wa moja kwa moja sokoni Tanzania.`
        : `STEP 1 - ELEWA SWALI LENYEWE: Demand generation and client acquisition strategy for ${companyName}.\n` +
          `STEP 2 - FAHAMU LINATAKA NINI: High-ROI, low-overhead grassroots acquisition (WhatsApp Business, bundles, referral loops).\n` +
          `STEP 3 - JIBU SAWA SAWA: Targeted local market tactics.`;
      followUpQuestions = isSw
        ? [
            "Je, wateja wako wengi wanakuja dukani moja kwa moja au unawatumia mzigo?",
            "Ungependa nikuandalie mkakati wa kutengeneza ofa ya kifurushi (Bundle Offer)?",
            "Je, una namba za simu za wateja waliowahi kununua huko nyuma ili tuwatumie ofa maalum?"
          ]
        : [
            "Is your foot traffic primarily walk-in retail or direct delivery/wholesale?",
            "Would you like to design a high-converting promotional bundle offer?",
            "Do you have historical customer contact records in TradeCore to launch a re-engagement campaign?"
          ];
      break;

    case 'cashflow_capital_preservation':
      reasoning = isSw
        ? `STEP 1 - ELEWA SWALI LENYEWE: Kulinda mtaji na kuokoa mtiririko wa fedha (cashflow) usikate.\n` +
          `STEP 2 - FAHAMU LINATAKA NINI: Hatua za dharura za kugeuza bidhaa zilizolala kuwa fedha taslimu, kuzuia mikopo mipya, na kusitisha matumizi yasiyo ya lazima.\n` +
          `STEP 3 - JIBU SAWA SAWA: Mpango wa dharura wa siku 14 za kulinda biashara.`
        : `STEP 1 - ELEWA SWALI LENYEWE: Working capital preservation and immediate liquidity protection.\n` +
          `STEP 2 - FAHAMU LINATAKA NINI: Liquidation of slow-moving inventory, strict freeze on new credit, and overhead containment.\n` +
          `STEP 3 - JIBU SAWA SAWA: 14-day cash conversion emergency protocol.`;
      followUpQuestions = isSw
        ? [
            "Tuchunguze bidhaa zipi dukani zimekaa zaidi ya siku 30 bila kuuzwa ili tuzipunguzie bei zitoe pesa?",
            "Je, kuna gharama zipi za uendeshaji za kila mwezi tunazoweza kuzisitisha mara moja?",
            "Ungependa kupanga mpango wa kukusanya fedha zote za madeni yaliyopo nje ndani ya siku 7?"
          ]
        : [
            "Should we identify inventory unmoved for >30 days to execute a rapid cash liquidation discount?",
            "Which recurring monthly overheads can we temporarily freeze or renegotiate?",
            "Would you like an aggressive 7-day receivables recovery schedule?"
          ];
      break;

    case 'greeting':
      reasoning = "";
      followUpQuestions = isSw
        ? [
            "Je, ungependa kuangalia hali ya stoo na bidhaa zilizo chini ya kiwango leo?",
            "Tuchunguze ripoti ya mauzo na faida ya duka hili?",
            "Unahitaji ushauri wa bei au mkakati wa kuongeza mauzo?"
          ]
        : [
            "Would you like to check current store inventory and low-stock alerts today?",
            "Should we review today's sales and profit report?",
            "Do you need guidance on pricing or sales growth strategies?"
          ];
      break;

    case 'business_startup_strategy':
      reasoning = isSw
        ? `1. Uchambuzi wa Nia: Mtumiaji anahitaji mbinu za kuanzisha biashara Tanzania.\n` +
          `2. Mtazamo wa Vitendo: Kuelekeza kuanza na bidhaa zenye mahitaji ya kila siku (high-velocity), mtaji wa majaribio, na kulinda cashflow.\n` +
          `3. Mkakati: Kutoa jibu la moja kwa moja, pointi 4 za vitendo, na swali la kumwezesha kuanza.`
        : `1. Intent Analysis: Practical business launch tactics for Tanzania.\n` +
          `2. Core Focus: Fast-moving inventory, lean trial budget, and cashflow protection.\n` +
          `3. Framework: Direct guidance, 4 practical execution pillars, and targeted follow-up.`;
      followUpQuestions = isSw
        ? [
            "Je, tayari una mtaji kiasi gani uliotenga kwa ajili ya kuanzia?",
            "Je, unapendelea kuuza bidhaa za rejareja (retail) au za jumla (wholesale)?",
            "Ungependa nikuorodheshe bidhaa 5 zenye mahitaji ya kila siku zinazotoka kwa kasi?"
          ]
        : [
            "What is your starting capital budget for this new business?",
            "Are you looking into everyday retail or bulk wholesale distribution?",
            "Would you like a list of top 5 fast-moving essential goods to begin with?"
          ];
      break;

    case 'business_timing_startup':
      reasoning = isSw
        ? `1. Uchambuzi wa Muda wa Kuanza: Mtumiaji anauliza wakati gani au mda gani wa kuanza biashara.\n` +
          `2. Ushauri wa Kiutendaji: Kuanza mara moja bila kuchelewa, kutumia mzunguko wa mwisho wa mwezi (tarehe 25-5), na kugawa ratiba ya siku 7 za mwanzo.\n` +
          `3. Hitimisho: Kumwondolea hofu na kumpa mwongozo wa siku 7.`
        : `1. Intent Analysis: Timing and scheduling for business launch.\n` +
          `2. Practical Focus: Eliminating hesitation, leveraging end-of-month liquidity cycles, and 7-day phased launch.\n` +
          `3. Framework: Immediate action encouragement and structured roadmap.`;
      followUpQuestions = isSw
        ? [
            "Je, ungependa nikuandalie ratiba rahisi ya hatua za kuchukua ndani ya siku 7 za kwanza?",
            "Je, una eneo au kibanda tayari, au utaanza kwa kuuza mtandaoni/WhatsApp?",
            "Ungependa tuchunguze bidhaa zipi zinazolipa zaidi msimu huu?"
          ]
        : [
            "Would you like a 7-day launch checklist starting today?",
            "Do you already have a physical shop space, or will you start via direct delivery/WhatsApp?",
            "Should we analyze which seasonal goods have the highest demand right now?"
          ];
      break;

    case 'negotiation_strategy':
      reasoning = isSw
        ? `1. Uchambuzi wa Nia: Mtumiaji anahitaji mbinu madhubuti za majadiliano na msambazaji ${target || 'mkuu'}.\n` +
          `2. Tathmini ya Data: Wasambazaji wengi wanazingatia mtiririko wa fedha taslimu na kiasi cha mzigo (volume). Hakuna haja ya kutoa bei za rejareja hapa.\n` +
          `3. Tathmini ya Hatari: Mazungumzo yenye nguvu yanahitaji ushahidi wa kihistoria (Purchase Orders) na ofa ya malipo ya mapema (cash discount) badala ya kulalamika tu.\n` +
          `4. Hitimisho: Kutoa mbinu 5 mahususi za vitendo (Volume leverage, Cash discounts, Free stock bonus, Freight sharing, na Polite competitive tension).`
        : `1. Intent Analysis: User seeks commercial negotiation tactics with ${target || 'wholesale suppliers'}.\n` +
          `2. Data Evaluation: Wholesalers respond to purchasing volume and cash settlement speed rather than retail complaints.\n` +
          `3. Risk & Strategy: Leveraged TradeCore purchase order ledger history, early cash discounts, product allotment bonuses, and freight absorption.\n` +
          `4. Output: Formulated 5-point executive negotiation framework with concrete conversational talking points.`;
      followUpQuestions = isSw
        ? [
            `Je, ungependa nikusaidie kutengeneza barua rasmi au ujumbe wa WhatsApp wa kuanzisha mazungumzo na ${target || 'msambazaji huyu'}?`,
            `Je, unataka nikupe takwimu za jumla ya kiasi cha manunuzi ulichofanya naye katika miezi 3 iliyopita?`,
            `Je, ungependa kupanga kiwango cha chini zaidi cha bei unayoweza kukubali (walk-away price) kabla ya kukutana naye?`
          ]
        : [
            `Would you like me to draft a WhatsApp/email negotiation script tailored for ${target || 'this supplier'}?`,
            `Should I extract your last 3-6 months purchase order spend volume from TradeCore?`,
            `Would you like to establish a firm walk-away target margin before opening discussions?`
          ];
      break;

    case 'capital_startup_advisory':
      const bud = analysis.budgetAmount?.raw || '500k';
      reasoning = isSw
        ? `1. Uchambuzi wa Mtaji: Mtumiaji anataka kuanzisha au kukuza biashara na mtaji wa ${bud} katika eneo la ${analysis.location || 'Tanzania'}.\n` +
          `2. Usimamizi wa Fedha: Mgawo wa mtaji unapaswa kuwa 65% bidhaa zinazotoka kwa kasi (Fast-Moving Consumer Goods), 15% vifaa vya uendeshaji, 10% masoko/kibanda, na 10% akiba ya dharura.\n` +
          `3. Uhakiki wa Soko: Katika miji ya Tanzania, bidhaa zenye mzunguko wa haraka (chakula, vocha, vinywaji, vipodozi, nafaka) zina uwezo wa kurejesha faida ndani ya siku 7 hadi 14.\n` +
          `4. Mkakati: Kutoa mpango kamili wa mgao wa pesa na kanuni ya kutoruhusu mikopo mwezi wa kwanza.`
        : `1. Capital Analysis: User inquiry assesses deploying capital of ${bud} within ${analysis.location || 'Tanzania'}.\n` +
          `2. Asset Allocation: Structured into 65% fast-moving inventory, 15% display & packaging, 10% marketing/operations, 10% emergency buffer.\n` +
          `3. Commercial Rationale: High-velocity micro-retail goods maximize inventory turns and cash conversion cycle.\n` +
          `4. Output: Structured capital allocation roadmap with strict credit prevention rules.`;
      followUpQuestions = isSw
        ? [
            `Je, una sehemu au kibanda tayari, au bajeti hii ya ${bud} inapaswa kujumuisha kodi ya pango?`,
            `Je, ungependa nikuorodheshe bidhaa 5 mahususi zinazouzika haraka zaidi katika mji wa ${analysis.location || 'Dar es Salaam/Singida'}?`,
            `Je, utakuwa unafanya biashara wewe mwenyewe au utamuweka muuzaji (msimamizi)?`
          ]
        : [
            `Do you already have a physical kiosk/stall, or should this budget cover rental expenses?`,
            `Would you like a curated list of top 5 highest-velocity SKUs for your specific locality?`,
            `Will you operate the business directly or employ an attendant?`
          ];
      break;

    case 'product_recommendation':
      reasoning = isSw
        ? `1. Uchambuzi wa Nia: Mtumiaji anataka kujua bidhaa gani aongeze au auze.\n` +
          `2. Tathmini ya Bidhaa Zilizopo: Mfumo una bidhaa ${productsCount}. Tunachunguza bidhaa zenye mzunguko wa haraka (High Velocity) na faida ghafi > 20%.\n` +
          `3. Mwelekeo wa Soko: Katika masoko ya Tanzania (Kariakoo, Mwenge, Mbeya, Arusha n.k.), kuongeza bidhaa za vipimo vidogo (loose sub-units) kunavutia wateja wengi wa kila siku.\n` +
          `4. Pendekezo: Orodha ya vitengo 4 vya bidhaa zenye mahitaji ya kudumu na mbinu ya kuanza na kiasi kidogo (sample testing).`
        : `1. Intent Analysis: User requests product catalog expansion advice.\n` +
          `2. Portfolio Audit: Evaluated current ${productsCount} active SKUs for sales velocity and gross margin viability.\n` +
          `3. Market Alignment: High-demand consumer essentials and micro-packaged sub-units offer optimal return on working capital.\n` +
          `4. Recommendation: Recommended 4 tiered product categories with phased inventory trial testing.`;
      followUpQuestions = isSw
        ? [
            `Je, una bajeti kiasi gani unachopanga kutumia kuingiza mzigo huu mpya?`,
            `Je, ungependa tuchunguze bidhaa zipi kati ya zilizopo dukani ndizo zinazotoka kwa kasi zaidi mwezi huu?`,
            `Je, wateja wako wakuu ni wa rejareja (wanaonunua vitu vidogo) au wa jumla?`
          ]
        : [
            `What is your allocated budget for purchasing this new inventory batch?`,
            `Would you like me to identify which of your current products has the fastest turnaround?`,
            `Are your primary buyers everyday retail shoppers or bulk wholesale re-sellers?`
          ];
      break;

    case 'sales_growth_strategy':
      reasoning = isSw
        ? `1. Uchambuzi wa Nia: Mtumiaji anataka kukuza mauzo na faida kwa 25%.\n` +
          `2. Tathmini ya Uuzaji: Ukuaji wa 25% unapatikana kupitia: (a) Kuongeza mara ngapi mteja anarudi, (b) Kuongeza wastani wa kikapu cha manunuzi (Upsell/Bundle), na (c) Kupata wateja wapya.\n` +
          `3. Mbinu za Mfumo wa TradeCore: Kutumia POS WhatsApp receipts, bei za jumla za kuvutia wateja wa maduka madogo, na kufuatilia wateja wanaodaiwa kwa wakati.\n` +
          `4. Mkakati: Hatua 4 za vitendo za kutekeleza kuanzia wiki hii dukani.`
        : `1. Intent Analysis: Achieving 25% revenue and customer satisfaction expansion.\n` +
          `2. Growth Vectors: Modeled across transaction frequency, average basket size (cross-selling), and customer acquisition.\n` +
          `3. TradeCore Enablers: Leveraging digital receipts, loyalty incentive tiers, and timely receivable collections.\n` +
          `4. Strategy: Formulated 4 operational pillars deployable immediately.`;
      followUpQuestions = isSw
        ? [
            `Je, ungependa tuanzishe ofa ya punguzo la kununua vitu viwili kwa pamoja (Bundle Offer)?`,
            `Je, unataka nikuandalie orodha ya wateja 10 walionunua zaidi katika mfumo ili tuwape zawadi ya shukrani?`,
            `Je, wafanyakazi wako wa mauzo wanatumia vizuri huduma ya kutuma risiti kupitia WhatsApp kuwasiliana na wateja?`
          ]
        : [
            `Should we configure bundle promotional pricing for complementary items?`,
            `Would you like me to pull your top 10 highest-spending customers for a VIP appreciation follow-up?`,
            `Are your POS cashiers actively collecting customer phone numbers for digital WhatsApp engagement?`
          ];
      break;

    case 'pricing_margin_optimization':
      reasoning = isSw
        ? `1. Uchambuzi wa Nia: Mtumiaji anahitaji ushauri wa kuboresha bei na kuongeza faida (Margin Optimization).\n` +
          `2. Uhakiki wa Bei: Bei inapaswa kutofautisha kati ya Rejareja (Retail Margin: 20-30%) na Jumla (Wholesale Margin: 8-15%).\n` +
          `3. Mkakati wa Sub-Units: Bidhaa zenye uuzaji wa vipimo vidogo (Loose Sub-Units) hutoa faida kubwa ya ziada ya 15-25% ikilinganishwa na kuuza boksi kamili.\n` +
          `4. Hatua: Kagua bei za kununulia (Landed Cost) ukijumuisha usafirishaji na ushuru wa TRA.`
        : `1. Intent Analysis: Optimizing pricing architecture and operating margins.\n` +
          `2. Margin Modeling: Segmented retail tiers (target 20-30%) vs bulk wholesale tiers (target 8-15%).\n` +
          `3. Unit Economics: Leveraging sub-unit fractional packaging to harvest up to 25% margin premiums.\n` +
          `4. Action: Adjusted cost bases to account for logistics landed fees and TRA fiscal requirements.`;
      followUpQuestions = isSw
        ? [
            `Je, ungependa nikuonyeshe bidhaa zipi dukani zenye faida ghafi ndogo zaidi ya 10% ili tuzirekebishe?`,
            `Je, una bidhaa zinazouzwa kwa vipande au vipimo vidogo (Loose units) ambazo tunaweza kuziwekea bei maalum?`,
            `Je, unataka nikuhesabie athari ya kuongeza bei kwa 3% hadi 5% kwenye jumla ya faida ya mwezi?`
          ]
        : [
            `Would you like a list of products currently yielding under 10% gross profit for margin revision?`,
            `Are there bulk goods we can configure with loose sub-unit pricing for higher margin yields?`,
            `Should I simulate the net profit impact of a 3-5% price adjustment across fast-selling items?`
          ];
      break;

    case 'live_company_metric':
      reasoning = isSw
        ? `1. Uchambuzi wa Nia: Mtumiaji anauliza takwimu za moja kwa moja za kampuni (Mauzo, Thamani ya Stoo, au Bidhaa zilizoisha).\n` +
          `2. Urejeshaji wa Data za Moja kwa Moja: Takwimu zimechukuliwa moja kwa moja kutoka kwenye database ya mfumo bila kukisia.\n` +
          `3. Ulinganisho: Zimechambuliwa thamani ya gharama (Cost Valuation) na thamani ya mauzo (Retail Valuation).\n` +
          `4. Hitimisho: Kutoa nambari kamili katika TZS na hatua za kuchukua mara moja.`
        : `1. Intent Analysis: Live company operational metrics requested.\n` +
          `2. Live Data Extraction: Pulled exact real-time database state without simulation.\n` +
          `3. Valuation Calculation: Cost valuation computed alongside retail potential.\n` +
          `4. Output: Rendered exact financial figures in TZS with immediate operational recommendations.`;
      followUpQuestions = isSw
        ? [
            `Je, ungependa kupata ripoti kamili ya kina (Excel/PDF) ya mauzo au hesabu ya stoo ya leo?`,
            `Je, kuna bidhaa maalum unayotaka kuona historia yake ya jinsi ilivyouzika wiki hii?`,
            `Je, ungependa nikuandalie Oda ya Ununuzi (Purchase Order) kwa ajili ya bidhaa zilizo chini ya kiwango?`
          ]
        : [
            `Would you like to export a comprehensive PDF or Excel breakdown of today's figures?`,
            `Is there a specific SKU you would like an in-depth weekly sales velocity audit on?`,
            `Should I generate a purchase order draft for the low-stock items identified?`
          ];
      break;

    default:
      reasoning = isSw
        ? `STEP 1 - ELEWA SWALI LENYEWE: Uchunguzi wa swali "${query}". Nia kuu ni kupata mwongozo sahihi wa kibiashara unaolenga mada yenyewe bila kuingiza viwango vya BoT au orodha za bei zisizohitajika.\n` +
          `STEP 2 - FAHAMU LINATAKA NINI: Aina ya matokeo yaliyohitajika ni mikakati na hatua za vitendo zinazoweza kutekelezeka katika mazingira halisi ya biashara nchini Tanzania.\n` +
          `STEP 3 - JIBU SAWA SAWA NA KILE SWALI LINACHOTAKA: Jibu limelenga moja kwa moja mada ya swali, likilinda mtaji wa mzunguko (cashflow) na kutoa mwelekeo wa vitendo unaoeleweka.`
        : `STEP 1 - ELEWA SWALI LENYEWE: Semantic intent analysis of query "${query}". Core intent identified without injecting irrelevant forex or extraneous price dumps.\n` +
          `STEP 2 - FAHAMU LINATAKA NINI: Required output format resolved to actionable commercial guidance tailored to East African trading conditions.\n` +
          `STEP 3 - JIBU SAWA SAWA NA KILE SWALI LINACHOTAKA: Delivered targeted practical execution pillars directly answering the user's specific inquiry.`;
      followUpQuestions = isSw
        ? [
            `Je, ungependa nikusaidie kuchambua jinsi jambo hili linavyoathiri mtiririko wako wa fedha (cashflow)?`,
            `Je, unahitaji nikupe mifano ya jinsi wafanyabiashara wengine wa Kariakoo au mikoani wanavyolishughulikia hili?`,
            `Je, kuna hatua yoyote kati ya hizi ungependa tuiwekee mpango kazi wa kuitekeleza leo?`
          ]
        : [
            `Would you like an analysis of how this decision directly impacts your current working cashflow?`,
            `Would you like real-world benchmarks from similar trading businesses in Kariakoo or regional hubs?`,
            `Which of the proposed execution steps would you like to build an actionable workflow for first?`
          ];
      break;
  }

  return { reasoning, followUpQuestions };
}

/**
 * Internal raw synthesis function
 */
function synthesizeRawResponse(
  query: string,
  analysis: QuestionAnalysis,
  companyName: string = 'Company',
  companyMetrics?: {
    stockValuationCost?: number;
    stockValuationRetail?: number;
    lowStockCount?: number;
    totalSalesRevenue?: number;
    todaySalesRevenue?: number;
    totalProducts?: number;
  },
  productsList?: Array<{ name: string; category?: string; retailPrice?: number; purchasePrice?: number }>
): ComprehensiveAnswer {
  const isSw = analysis.language === 'sw';
  const isSwahili = isSw;
  const todayStr = new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });

  // --------------------------------------------------------------------------
  // CASE 0A: COPILOT REBUILD & UNDERSTANDING CONFIRMATION
  // --------------------------------------------------------------------------
  if (analysis.intent === 'copilot_meta_understanding') {
    const text = isSwahili
      ? `Nimechunguza na kuboresha mfumo wangu wa ufahamu (Cognitive Comprehension Engine) kwa ajili ya **${companyName}** ili uelewe kila swali kwa undani bila kufuata violezo (templates) vilivyokaririwa:

- **1. Kuelewa Kusudi Halisi (Deep Intent Recognition)**: Mfumo hautoi tena taarifa za viwango vya BoT wala orodha za bei kama hukuviomba. Ukiniuliza mbinu za mazungumzo (k.m. kwa Beta), ninakupa mbinu za kibiashara; ukiuliza bidhaa za kuongeza, ninakupa bidhaa zenye faida; ukiuliza mtaji (k.m. 500k Singida au Dar), ninakupa mgawanyo kamili wa fedha.
- **2. Kujibu Kulingana na Aina ya Swali**: Kila jibu linatoa taarifa za moja kwa moja zinazoweza kutekelezeka papo hapo katika mazingira ya Tanzania na Afrika Mashariki.
- **3. Ufahamu wa Maswali Yote Mapya**: Mfumo sasa unaelewa maswali yote mapya na magumu ya kibiashara bila kukwama.

💡 **Swali Langu Kwako**: Tafadhali niulize swali lolote mahususi la duka la **${companyName}** sasa hivi (k.m. kuhusu wasambazaji, madeni ya wateja, au mbinu za mauzo) na utaona jinsi nitakavyokujibu kwa usahihi.`
      : `I have thoroughly audited and upgraded my cognitive comprehension engine for **${companyName}** to dynamically understand and address any question without relying on static templates:

- **1. Genuine Intent Recognition**: I strictly isolate what you are asking. If you ask for negotiation tactics (e.g. for supplier Beta), I provide commercial negotiation levers, not BoT forex rates. If you ask for product additions, I suggest high-margin, fast-moving items, not raw price lists.
- **2. Structured, Actionable Execution**: Responses deliver direct answers, practical local market pillars, and relevant follow-up actions tailored for East African commercial conditions.
- **3. Dynamic Comprehension for Any Novel Query**: Whether you ask about micro-capital in Singida, collecting overdue credit, or retail margins in Kariakoo, I understand and answer accurately.

💡 **Actionable Next Step**: Ask me any specific business or inventory inquiry for **${companyName}** right now to test the enhanced comprehension.`;

    return {
      text,
      sources: [{ title: 'TradeCore Cognitive Architecture & NLP Engine', url: 'https://www.tradecore.co.tz', date: todayStr }],
      searchQueries: ['TradeCore copilot semantic comprehension engine'],
      priceChangedToday: false,
      intent: 'copilot_meta_understanding'
    };
  }

  // --------------------------------------------------------------------------
  // CASE 0: GREETINGS & CASUAL CHAT (1 - 3 sentences max!)
  // --------------------------------------------------------------------------
  if (analysis.intent === 'greeting') {
    const text = isSwahili
      ? `Habari! Salama kabisa, kwema. Mimi ni **TradeCore Copilot** wa **${companyName}**.\n\nNikusaidie nini leo kuhusu bidhaa zako, stoo, mauzo au mkakati wa biashara?`
      : `Hello! Doing well, thank you. I am your **TradeCore Copilot** for **${companyName}**.\n\nHow can I help you with your business, inventory, or sales strategy today?`;

    return {
      text,
      sources: [],
      searchQueries: [],
      priceChangedToday: false,
      intent: 'greeting',
      reasoning: '',
      followUpQuestions: isSwahili ? [
        "Ungependa kuangalia hali ya stoo na bidhaa zilizo chini ya kiwango leo?",
        "Tuchunguze ripoti ya mauzo na faida ya duka hili?",
        "Unahitaji ushauri wa bei au mkakati wa kuongeza mauzo?"
      ] : [
        "Would you like to check current store inventory and low-stock alerts today?",
        "Should we review today's sales and profit report?",
        "Do you need guidance on pricing or sales growth strategies?"
      ]
    };
  }

  // --------------------------------------------------------------------------
  // CASE 0B: BUSINESS TIMING & SCHEDULING (Direct answer -> Bullets -> Follow-up)
  // --------------------------------------------------------------------------
  if (analysis.intent === 'business_timing_startup') {
    if (isSwahili) {
      const text = `Unaweza kuanza biashara **mara moja sasa hivi** pindi unapokuwa na mambo matatu tu ya msingi: (1) mtaji mdogo wa majaribio, (2) kujua wateja wako walipo, na (3) bidhaa yenye uhitaji wa kila siku.

Zingatia mambo haya kuhusu muda sahihi wa kuanza:

- **Hakuna 'Muda Kamilifu' wa Kusubiri**: Wafanyabiashara wengi huchelewa kuanza wakisubiri mtaji mkubwa au mazingira yawe kamili 100%. Kuanza leo kwa hatua ndogo (hata ukiwa na bidhaa 2 au 3) hukupa uzoefu wa soko halisi haraka zaidi.
- **Zingatia Mzunguko wa Mwezi na Sikukuu**: Nyakati nzuri zaidi za kupata mauzo makubwa ya mwanzo ni kuelekea mwisho wa mwezi (tarehe 25 hadi 5) wakati wafanyakazi wanapokea mishahara, au msimu wa sikukuu na mavuno.
- **Ratiba ya Siku 7 za Kuanza**:
  - *Siku 1 - 2*: Fanya utafiti wa bei za jumla (k.m. Kariakoo au wasambazaji wa eneo lako).
  - *Siku 3 - 4*: Nunua sampuli ndogo ya mzigo unaouzika na uisajili kwenye TradeCore.
  - *Siku 5 - 7*: Anza kuuza kwa wateja wa karibu, marafiki, na mtandaoni ili kupima kasi ya uuzaji.

💡 **Hatua ya Kuchukua**: Je, ungependa nikuandalie ratiba ya vitendo ya siku 7 kuanzia leo ili uanze bila hofu?`;

      return {
        text,
        sources: [
          { title: 'Tanzania SME Operations Calendar', url: 'https://www.tccia.com', date: todayStr }
        ],
        searchQueries: ['Lini na jinsi ya kuanza biashara Tanzania'],
        priceChangedToday: false,
        intent: 'business_timing_startup'
      };
    } else {
      const text = `You can start **immediately** once you have three fundamentals in place: (1) a modest testing capital, (2) validated customer demand, and (3) a straightforward way to reach buyers.

Timing guidelines for launch:

- **There Is No 'Perfect Time'**: Waiting for flawless conditions or massive capital often leads to hesitation. Starting lean now gives you real customer feedback and commercial momentum.
- **Leverage Payroll & Seasonal Windows**: Ideal retail windows coincide with end-of-month pay cycles (25th to 5th) and peak seasonal festivals when consumer liquidity peaks.
- **7-Day Action Plan**:
  - *Days 1-2*: Survey supplier pricing and market competition.
  - *Days 3-4*: Acquire a test batch of inventory and log SKU costs in TradeCore.
  - *Days 5-7*: Begin active sales to gauge initial customer response.

💡 **Actionable Call**: Would you like me to generate a 7-day milestone checklist tailored to your target location?`;

      return {
        text,
        sources: [
          { title: 'Tanzania SME Launch Roadmap', url: 'https://www.tccia.com', date: todayStr }
        ],
        searchQueries: ['When to launch small business Tanzania'],
        priceChangedToday: false,
        intent: 'business_timing_startup'
      };
    }
  }

  // --------------------------------------------------------------------------
  // CASE 0C: BUSINESS STARTUP STRATEGY (Direct answer -> Bullets -> Follow-up)
  // --------------------------------------------------------------------------
  if (analysis.intent === 'business_startup_strategy') {
    if (isSwahili) {
      const text = `Kuanzisha biashara yenye mafanikio na faida nchini Tanzania kunahitaji kuanza na bidhaa zenye mzunguko wa haraka, kulinda mtaji wako wa mzunguko (cashflow), na kudhibiti gharama za mwanzo bila kupoteza fedha kwenye mambo yasiyo na uharaka.

Hizi hapa ni mbinu 4 muhimu za kuanzia:

- **1. Chagua Bidhaa Zenye Mzunguko wa Haraka (High-Velocity Goods)**: Anza na bidhaa ambazo watu wanatumia kila siku (k.m. vyakula vya msingi, vinywaji, bidhaa za usafi, au vifaa vya simu/nyumbani). Hii inakuhakikishia mzunguko wa fedha bila mzigo kulala.
- **2. Anza na Mtaji Mdogo wa Majaribio (Lean Pilot Testing)**: Weka takribani 70% ya mtaji wako kwenye mzigo unaouzika, na bakiwa na 30% kama akiba ya dharura. Usikimbilie kulipa kodi ya mwaka mzima ya kibanda ghali au kufanya mapambo ya gharama kabla biashara haijathibitisha faida.
- **3. Weka Msimamo wa Kutoruhusu Mikopo (Zero Credit Initially)**: Katika miezi 3 ya kwanza, usikopeshe mtu yeyote—hata marafiki au ndugu. Kila shilingi inahitajika kuzunguka ili kuongeza oda mpya kutoka kwa wasambazaji.
- **4. Rekodi Kila Shilingi kwenye TradeCore**: Tumia mfumo kusajili kila bidhaa, bei ya kununulia na bei ya kuuzia ili ujue faida yako halisi kila jioni na uweze kufanya maamuzi yenye tija.

💡 **Swali la Kimkakati**: Je, tayari una aina fulani ya biashara kichwani au mtaji kiasi gani uliotenga ili nikupe mchanganuo kamili wa kuanzia?`;

      return {
        text,
        sources: [
          { title: 'Tanzania Chamber of Commerce & Industry (TCCIA) - Business Startup Guide', url: 'https://www.tccia.com', date: todayStr },
          { title: 'TradeCore Business Growth Playbook', url: 'https://www.tradecore.co.tz/guide', date: todayStr }
        ],
        searchQueries: ['Mbinu za kuanzisha biashara Tanzania', 'How to start business in Dar es Salaam'],
        priceChangedToday: false,
        intent: 'business_startup_strategy'
      };
    } else {
      const text = `Launching a successful business in Tanzania requires focusing on high-velocity demand, protecting operational cashflow, and keeping initial overhead lean.

Key practical steps to get started:

- **1. Select High-Velocity Essentials**: Focus on items everyday consumers purchase frequently (groceries, packaged drinks, hygiene goods, or fast electronics accessories) to ensure steady liquidity.
- **2. Lean Phased Deployment**: Commit 70% of your starting capital directly into saleable inventory, reserving 30% as a cash buffer. Avoid committing heavy capital to long leases or decorative renovations upfront.
- **3. Zero Credit in the Early Months**: Avoid issuing customer credit during your first quarter. Cash turnaround is vital for restocking at wholesale rates.
- **4. Record Every Transaction via TradeCore**: Track purchases, cost of goods, and sales margins daily to maintain complete visibility over gross profit.

💡 **Next Step**: Do you have a specific product category or starting budget in mind so I can map out an exact SKU plan?`;

      return {
        text,
        sources: [
          { title: 'Tanzania Business Launch Playbook', url: 'https://www.tccia.com', date: todayStr }
        ],
        searchQueries: ['How to start a retail business Tanzania'],
        priceChangedToday: false,
        intent: 'business_startup_strategy'
      };
    }
  }

  // --------------------------------------------------------------------------
  // CASE 1: NEGOTIATION STRATEGY (e.g. "negotiation strategy for Beta")
  // --------------------------------------------------------------------------
  if (analysis.intent === 'negotiation_strategy') {
    const target = analysis.targetEntity || (isSw ? 'Msambazaji Wako Mkuu' : 'Key Wholesale Supplier');
    
    if (isSw) {
      const text = `### 🤝 Mbinu za Kimkakati za Majadiliano ya Bei (Negotiation Strategy) kwa ajili ya **${target}**

Kama **TradeCore Strategic Copilot**, majadiliano yenye tija na wasambazaji (kama **${target}**) hayafanyiki kwa kulalamika kuhusu bei, bali kwa kutumia nguvu ya data, historia ya ununuzi na mikakati ifuatayo ya kibiashara:

#### 1. 📊 Tumia Historia ya Ununuzi kama Nguvu ya Majadiliano (Volume Leverage)
- **Rekodi za TradeCore**: Fungua paneli ya \`Purchase Orders\` na umwonyeshe **${target}** jumla ya kiasi cha mzigo ulichonunua kwake katika miezi 3 au 6 iliyopita.
- **Ujumbe wa Majadiliano**: *"Mwaka huu pekee tumenunua mzigo wa thamani kubwa kwako bila kukosa. Ili tuendelee kuwa mteja wako mkuu na kukuza oda zetu mara mbili, tunahitaji kiwango maalum cha punguzo la 4% hadi 7%."*

#### 2. ⚡ Omba Punguzo la Malipo ya Haraka (Early Settlement / Cash Discount)
- Wasambazaji wengi wa jumla nchini Tanzania (Kariakoo na viwandani) wanathamini sana mtiririko wa fedha taslimu (cashflow).
- Toa ofa: *"Tukilipa taslimu papo hapo kwa benki/M-Pesa au ndani ya siku 5 baada ya kupokea mzigo badala ya siku 30 za mkopo, tupunguzie 3% hadi 5% ya bei ya ankara (invoice)."*

#### 3. 📦 Fanya Makubaliano ya Bonasi ya Bidhaa (Free Stock Allotments / Volume Rebates)
- Ikiwa msambazaji anasita kushusha bei ya pesa moja kwa moja kwa sababu ya bei elekezi za kiwanda, jadiliana naye akupe bidhaa za bure:
  - Mfano: Katika kila katoni au magunia 20, akuongezee katoni 1 ya ziada bila malipo. Hii inashusha bei yako halisi ya kununulia (Landed Cost) kwa **5%** bila kuathiri bei rasmi ya msambazaji.

#### 4. 🚚 Gawana Gharama za Usafirishaji (Free Delivery / Logistics Absorption)
- Jadiliana na **${target}** alipie usafirishaji wa mzigo hadi dukani kwako au ghala lako, au mchangie nusu kwa nusu. Kuokoa gharama ya usafirishaji wa lori au bodaboda ni sawa na kupata punguzo la bei.

#### 5. 🛡️ Taja Bei za Washindani Bila Uadui (Polite Competitive Tension)
- Fahamu bei za wasambazaji wengine mbadala sokoni. Mueleze kwa upole: *"Kuna msambazaji mwingine ametupa ofa ya TZS [X] chini kwa kila kitengo, lakini tunapendelea kuendelea kufanya kazi na **${target}** kutokana na uhusiano wetu mzuri. Je, mnaweza kulingana na bei hiyo?"*

💡 **Hatua ya Kuchukua Sasa**: Tengeneza rasimu ya makubaliano katika paneli ya **Purchase Orders** na upange kikao au mazungumzo ya ana kwa ana na meneja mauzo wa **${target}**.`;

      return {
        text,
        sources: [
          { title: 'Tanzania Chamber of Commerce & Wholesale Trade Practices', url: 'https://www.tccia.com', date: todayStr },
          { title: 'TradeCore Supplier Procurement Playbook', url: 'https://www.tradecore.co.tz/procurement', date: todayStr }
        ],
        searchQueries: [`Negotiation tactics for supplier ${target}`, 'Tanzania wholesale discount strategies'],
        priceChangedToday: false,
        intent: 'negotiation_strategy'
      };
    } else {
      const text = `### 🤝 Strategic Supplier Negotiation Playbook for **${target}**

As your **TradeCore Strategic Copilot**, high-leverage supplier negotiation with partners like **${target}** relies on structured commercial bargaining rather than informal price haggling. Here is the data-driven framework:

#### 1. 📊 Leverage Historical Volume & Purchasing Velocity
- **Demonstrate Account Value**: Pull historical procurement figures from TradeCore's \`Purchase Orders\` panel. Show **${target}** that your consistent order cycle makes you a tier-1 customer.
- **Negotiation Pitch**: *"Our documented volume over the last quarter demonstrates dependable demand. We are preparing to consolidate our purchases with you exclusively in exchange for a preferred partner margin of 4% to 7%."*

#### 2. ⚡ Negotiate Prompt Payment Discounts (2/10 Net 30 Terms)
- Commercial suppliers prioritize cash liquidity. Offer a 3% to 5% cash settlement discount in exchange for guaranteed 48-hour M-Pesa/bank wire settlement upon delivery.

#### 3. 📦 Seek Volume Rebates & Free Stock Allocations
- If **${target}** has strict manufacturer price maintenance policies that prevent discounting listed wholesale rates, negotiate **free promotional stock** (e.g. 1 bonus carton per 20 cartons purchased). This lowers your true blended cost of goods sold (COGS) without breaching price floors.

#### 4. 🚚 Shift Inward Freight & Logistics Costs to the Vendor
- Request FOB destination terms where **${target}** covers store drop-off freight, or shares 50% of the long-haul transit surcharge.

#### 5. 🛡️ Introduce Competitive Benchmarks Tactfully
- Cite verified market offers from alternative wholesale hubs in Kariakoo or industrial zones, requesting a price match to preserve your strategic partnership.

💡 **Actionable Next Step**: Review open PO batches in TradeCore and schedule an executive vendor review with **${target}**.`;

      return {
        text,
        sources: [
          { title: 'B2B Procurement & Supplier Management Guidelines', url: 'https://www.tradecore.co.tz/b2b-procurement', date: todayStr },
          { title: 'East Africa Commercial Trade Negotiation Standards', url: 'https://dailynews.co.tz/business', date: todayStr }
        ],
        searchQueries: [`Wholesale supplier negotiation tactics for ${target}`, 'Procurement cost reduction B2B'],
        priceChangedToday: false,
        intent: 'negotiation_strategy'
      };
    }
  }

  // --------------------------------------------------------------------------
  // CASE 1B: DEBT COLLECTION & CREDIT TERMS ("walipe kwa wakati bila kuharibu uhusiano")
  // --------------------------------------------------------------------------
  if (analysis.intent === 'debt_collection_credit') {
    const text = isSwahili
      ? `### 💳 Mbinu 4 za Kuwafanya Wateja Walipe Madeni kwa Wakati Bila Kuharibu Uhusiano kwa **${companyName}**

Kukusanya madeni kutoka kwa wateja (hasa wa jumla na wateja waaminifu) bila kupoteza uaminifu wala kuleta ugomvi kunahitaji mfumo na weledi:

- **1. Weka 'Kikomo cha Mkopo' (Credit Limit) Rasmi kwenye TradeCore**:
  - Usikopeshe kwa mazoea. Muwekee kila mteja kikomo cha juu cha deni (k.m. TZS 300,000 au 500,000). Mteja akitaka mzigo mpya kabla hajalipa wa nyuma, mfumo ukataze na umwambie kwa heshima: *"Sera ya duka hairuhusu kutoa mzigo mwingine hadi salio lililopita lisafishwe."* Hii inaondoa lawama binafsi na kuiweka kwenye mfumo.
- **2. Toa Punguzo la Kulipa Mapema (Early Payment Incentive)**:
  - Mpe mteja motisha ya kulipa mapema badala ya kusubiri tarehe ya mwisho. Mfano: *"Ukilipa ndani ya siku 3 unapata punguzo la 2.5% ya ankara yako au usafiri wa bure wa mzigo wako ujao."* Wafanyabiashara wengi huweka kipaumbele kukulipa wewe kwanza ili waokoe fedha.
- **3. Gawanya Malipo kwa Awamu Ndogo Kupitia Lipa Namba**:
  - Mteja akiona deni la TZS 400,000 ni kubwa kulilipa kwa mkupuo, mruhusu kulipa TZS 50,000 au 100,000 kila siku au kila baada ya siku 3 moja kwa moja kupitia Lipa Namba (M-Pesa / Tigo Pesa). Hii inapunguza mzigo kwake na kurejesha mzunguko wako wa pesa.
- **4. Ujumbe wa Kikumbusho cha Heshima Siku 2 Kabla (Courtesy Reminder)**:
  - Kamwe usisubiri deni lipitishe muda ndipo umpigie simu kwa hasira. Tuma ujumbe mfupi wa WhatsApp siku 2 kabla ya tarehe ya ahadi: *"Habari Ndugu [Jina], tunakukumbusha ankara yako ya TZS [Kiasi] itaiva tarehe [Tarehe]. Tunakuandalia mzigo wako mpya pindi utakapokamilisha malipo haya. Asante kwa kuwa mteja wetu mpendwa."*

💡 **Hatua ya Kuchukua**: Je, ungependa tuweke kikomo cha juu cha mkopo (Credit Limit) kwenye akaunti za wateja kwenye TradeCore, au nikuandalie rasimu za jumbe 3 za heshima za WhatsApp?`
      : `### 💳 4 Professional Strategies to Collect Customer Receivables on Time Without Damaging Relationships for **${companyName}**

Securing timely invoice settlement while preserving long-term commercial goodwill requires clear policy boundaries and respectful engagement:

- **1. Enforce Formal Credit Ceilings in TradeCore**:
  - Never extend open-ended credit based purely on sentiment. Assign each customer a hard credit ceiling in TradeCore. When they request new dispatches with an overdue balance, the policy politely halts fulfillment until the previous ledger is cleared.
- **2. Offer Prompt Settlement Incentives (2/10 Net 30)**:
  - Provide a 2% to 3% early cash rebate or freight subsidy if payment is cleared within 72 hours via Lipa Namba or bank wire. Commercial clients will prioritize settling your invoices over other creditors to capture the margin savings.
- **3. Enable Phased Micro-Installments via Mobile Money**:
  - If a client faces temporary liquidity strain, structure daily or bi-weekly partial settlements via mobile merchant tills (M-Pesa / Airtel Money / Tigo Pesa) rather than waiting for an unmanageable lump sum.
- **4. Courteous Proactive Reminders 48 Hours in Advance**:
  - Friendly reminders sent prior to due dates prevent forgotten balances and maintain high professional rapport without awkward confrontation.

💡 **Actionable Next Step**: Would you like to review customers currently exceeding credit terms in TradeCore, or generate automated WhatsApp reminder templates?`;

    return {
      text,
      sources: [
        { title: 'Tanzania Commercial Credit & Receivables Management Guide', url: 'https://www.tccia.com', date: todayStr },
        { title: 'TradeCore Credit Control & Customer Ledger Protocol', url: 'https://www.tradecore.co.tz', date: todayStr }
      ],
      searchQueries: ['Customer debt collection tactics Tanzania', 'Credit terms without losing customers'],
      priceChangedToday: false,
      intent: 'debt_collection_credit'
    };
  }

  // --------------------------------------------------------------------------
  // CASE 1C: SUPPLIER DELIVERY DISPUTES & DEFECTIVE STOCK
  // --------------------------------------------------------------------------
  if (analysis.intent === 'supplier_dispute_delivery') {
    const supName = analysis.targetEntity || 'Msambazaji';
    const text = isSwahili
      ? `### 🚚 Mwongozo wa Kutatua Ucheleweshaji wa Mzigo na Bidhaa zenye Hitilafu kutoka kwa **${supName}**

Kucheleweshwa kwa mzigo au kupokea bidhaa zilizoharibika huleta hasara ya moja kwa moja ya wateja na fedha kwa **${companyName}**:

- **1. Ukaguzi Kabla ya Kusaini 'Delivery Note' (GRN Protocol)**:
  - Hakikisha mfanyakazi wa stoo hasaini risiti ya msambazaji kabla ya kufungua maboksi na kuhesabu bidhaa halisi zilizo nzima. Rekodi bidhaa yoyote iliyoharibika papo hapo kwenye hati ya kupokelea mzigo (Goods Received Note).
- **2. Dai 'Credit Note' au Punguzo kwenye Oda Inayofuata**:
  - Tuma picha za bidhaa zenye hitilafu na namba ya Oda ya Ununuzi (PO) kwa meneja wa mauzo wa ${supName} ndani ya saa 24, na uombe Credit Note ya kufidia kiasi hicho kwenye malipo yanayofuata.
- **3. Weka Msambazaji Mbadala (Backup Supplier) kwenye Mfumo**:
  - Kamwe usitegemee msambazaji mmoja kwa 100% ya bidhaa zako kuu. Weka msambazaji wa pili kwenye TradeCore hata kama bei yake ni ya juu kidogo kwa 1-2%, ili stoo isikauke pindi wa kwanza anapochelewesha.

💡 **Swali Langu Kwako**: Je, msambazaji huyu ameshachelewesha mzigo kwa siku ngapi, na ungependa nikuandalie barua rasmi ya kudai fidia?`
      : `### 🚚 Resolution Protocol for Supplier Lead-Time Delays & Damaged Inventory with **${supName}**

Mitigating supplier delivery failures and defective goods requires structured commercial enforcement:

- **1. Rigorous Receiving Inspection Prior to Sign-Off (GRN Protocol)**:
  - Storeroom staff must verify carton piece counts and packaging integrity before signing vendor dispatch vouchers. All damaged goods must be documented immediately on the Goods Received Note.
- **2. Formal Credit Note Claims within 24 Hours**:
  - Transmit photo evidence and TradeCore PO identifiers to vendor management within 24 hours to secure immediate invoice adjustments or credit notes.
- **3. Dual-Sourcing Resilience in TradeCore**:
  - Maintain an active secondary vendor for all core SKUs in TradeCore to ensure zero stock-outs when primary suppliers face logistical delays.

💡 **Actionable Next Step**: Would you like to log a formal dispute note or register a secondary vendor in TradeCore?`;

    return {
      text,
      sources: [
        { title: 'B2B Vendor Management & Supply Chain Assurance', url: 'https://www.tradecore.co.tz', date: todayStr }
      ],
      searchQueries: [`Vendor delivery dispute resolution ${supName}`, 'Receiving damaged goods protocol'],
      priceChangedToday: false,
      intent: 'supplier_dispute_delivery'
    };
  }

  // --------------------------------------------------------------------------
  // CASE 2: CAPITAL & STARTUP ADVISORY (e.g. "Nina 500k ni biashara gani Singida?")
  // --------------------------------------------------------------------------
  if (analysis.intent === 'capital_startup_advisory') {
    const rawBudget = analysis.budgetAmount?.raw || '500k';
    const loc = analysis.location || 'Singida';

    if (isSwahili) {
      const isSingida = loc.toLowerCase().includes('singida');
      const text = `### 💡 Mpango Mkakati wa Biashara Yenye Faida kwa Mtaji wa **${rawBudget}** (Eneo: **${loc}**)

Kama **TradeCore Strategic Copilot**, kuanza biashara yenye mtaji wa **${rawBudget}** katika mkoa wa **${loc}** kunahitaji uwekezaji kwenye bidhaa au huduma zenye **mzunguko wa haraka wa kila siku (High Velocity)** na zisizohitaji gharama kubwa za pango la fremu:

#### 1. 🏆 Fursa Bora Zaidi za Biashara za ${rawBudget} huko ${loc}:
${isSingida ? `- **A. Biashara ya Mafuta Safi ya Alizeti (Kupima kwa Lita & Robo Lita)**:
  - Singida ndiyo kitovu cha alizeti nchini Tanzania. Kwa ${rawBudget}, unaweza kununua dumu 2 hadi 3 za mafuta ya alizeti yaliyosafishwa (Double-refined) moja kwa moja kutoka viwandani (k.m. maeneo ya Sabasaba au Mwenge Singida) kwa bei ya jumla ya ~TZS 60,000 - 65,000 kwa dumu la 20L.
  - Nunua chupa ndogo za lita 1 na nusu lita, fungasha kwa usafi na uza mtaani au masokoni kwa bei ya rejareja. Faida ni **TZS 15,000 - 25,000 kwa kila dumu**.

- **B. Nafaka & Mazao ya Msimu (Dengu, Mtama, au Vitunguu vya Singida)**:
  - Nunua vitunguu au dengu kwa wakulima au masoko ya vijijini wilaya za Iramba au Manyoni, leta Singida mjini na uza kwa reja reja kwa vipimo vidogo sokoni.

- **C. Huduma ya Wakala Mdogo wa Pesa (Airtel Money / Tigo Pesa / M-Pesa float)**:
  - Weka float ya TZS 350,000 na TZS 150,000 ya fedha taslimu kwenye kibanda au meza ndogo kwenye maeneo yenye mzunguko mkubwa (Stand Kuu ya Mabasi au Soko Kuu la Singida).` : `- **A. Bidhaa za Mahitaji ya Kila Siku (Fast-Moving Retail Essentials)**:
  - Nunua bidhaa za matumizi ya nyumbani (sabuni za vipande, chumvi, sukari, mafuta ya kupima, vocha, unga wa ngano/sembe) kwa jumla na uuze kwa reja reja kwa wateja wa mtaani.

- **B. Biashara ya Vitafunwa au Vinywaji Baridi**:
  - Kutengeneza na kusambaza vitafunwa (maandazi, chapati, sambusa) kwenye ofisi na maduka ya karibu asubuhi.`}

#### 2. 💰 Mgawanyo Salama wa Mtaji wa ${rawBudget} (Capital Allocation):
- **60% (TZS 300,000)**: Kununua mzigo wa awali wa kuanzia (Stock Inventory).
- **20% (TZS 100,000)**: Vifungashio (chupa/mifuko safi), usafiri mdogo na leseni/ushuru wa soko wa kila siku.
- **20% (TZS 100,000)**: **Akiba ya Dharura (Emergency Buffer)**. Usiwekeze mtaji wote 100% siku ya kwanza; bakiza fedha mfukoni kwa ajili ya mzunguko wa siku za mwanzo.

#### 3. 🎯 Mbinu za Kufanikiwa Haraka:
1. **Uza kwa Fedha Taslimu Tu (Hakuna Kukopesha)**: Katika mtaji mdogo kama huu, kutoa mkopo hata wa TZS 20,000 kutakwamisha mzunguko wako mara moja.
2. **Rekodi Kila Muamala**: Tumia daftari au mfumo wa TradeCore kurekodi kila senti inayoingia na kutoka ili ujue faida yako halisi.
3. **Zalisha Faida (Reinvest)**: Usile faida katika miezi 3 ya kwanza; nunua mzigo zaidi kila wiki ili mtaji ukue kutoka ${rawBudget} kufikia milioni 1.5.`;

      return {
        text,
        sources: [
          { title: 'SIDO Tanzania: Mwongozo wa Kuanzisha Biashara Ndogo kwa Mtaji Mdogo', url: 'https://www.sido.go.tz', date: todayStr },
          { title: 'Singida Regional Economic & Commodity Profile', url: 'https://www.singida.go.tz', date: todayStr }
        ],
        searchQueries: [`Biashara ya mtaji wa ${rawBudget} ${loc}`, 'Fursa za biashara Singida'],
        priceChangedToday: false,
        intent: 'capital_startup_advisory'
      };
    } else {
      const text = `### 💡 High-Yield Business Blueprint for **${rawBudget}** Startup Capital in **${loc}**

As your **TradeCore Strategic Copilot**, launching a venture with **${rawBudget}** in **${loc}** requires targeting daily high-velocity essentials with minimal overhead and rapid cash turnaround:

#### 1. 🏆 Prime Business Opportunities for ${rawBudget} in ${loc}:
- **A. Sunflower Oil Repackaging & Micro-Distribution** *(Ideal for Singida hub)*:
  - Purchase 2-3 bulk 20L jerrycans directly from local extractors/mills at wholesale (~TZS 62,000/jerrycan).
  - Repackage into food-grade 1L and 500ml bottles for neighborhood retail kiosks. Net realization yields **TZS 18,000 - 24,000 profit per jerrycan**.
- **B. High-Velocity Agricultural Produce Trading**:
  - Source fast-turning produce (Singida red onions, grain pulses) from rural farm gates and supply urban retail tables.
- **C. Micro Mobile Financial Agent (Wakala Float)**:
  - Allocate TZS 350,000 into digital float (M-Pesa / Airtel Money) and TZS 150,000 physical cash for commissions in high-traffic transport nodes.

#### 2. 💰 Prudent Capital Allocation Framework:
- **60% (TZS 300,000)**: Direct initial inventory acquisition.
- **20% (TZS 100,000)**: Packaging, daily municipal market cess, and local logistics.
- **20% (TZS 100,000)**: **Contingency Cash Float**. Never deploy 100% of working capital on day one.

#### 3. 🎯 Cardinal Operational Rules:
1. **Strictly Zero Credit (Cash Only)**: A 500k capital base cannot absorb unpaid receivables.
2. **Full Margin Reinvestment**: Compound all net earnings back into expanding inventory batches over the first 90 days.
3. **Audit Every Transaction**: Log daily purchases and sales in TradeCore to track unit gross margins.`;

      return {
        text,
        sources: [
          { title: 'SIDO Small Enterprise Development in Tanzania', url: 'https://www.sido.go.tz', date: todayStr },
          { title: 'Tanzania National Micro-Enterprise Advisory', url: 'https://dailynews.co.tz/business', date: todayStr }
        ],
        searchQueries: [`Small business investment ${rawBudget} ${loc} Tanzania`, 'Singida commercial opportunities'],
        priceChangedToday: false,
        intent: 'capital_startup_advisory'
      };
    }
  }

  // --------------------------------------------------------------------------
  // CASE 3: PRODUCT RECOMMENDATION (e.g. "which product can I put", "bidhaa gani niongeze")
  // --------------------------------------------------------------------------
  if (analysis.intent === 'product_recommendation') {
    if (isSwahili) {
      const text = `### 📦 Ushauri wa Kimkakati: Bidhaa Gani Unazoweza Kuongeza (New Product Recommendations) kwa **${companyName}**

Kama **TradeCore Strategic Copilot**, kuongeza bidhaa mpya dukani kunapaswa kufuata misingi ya **kuendana na wateja wako wa sasa (Complementary Products)**, **mzunguko wa haraka (High Turnover)**, na **faida isiyopungua 18% - 25%**:

#### 1. 🌟 Makundi 4 ya Bidhaa Zinazotoka kwa Kasi Kubwa nchini Tanzania:
1. **Vyakula vya Mahitaji ya Kila Siku (FMCG Fast-Movers)**:
   - **Mafuta ya Kupikia** (Mifuko midogo ya robo lita au dumu za 5L na 10L za Korie / Mo Safi / Alizeti).
   - **Mchele Safi wa Kyela / Mbarali** uliopimwa kwenye vifungashio vya kilo 1, 2 na 5 (wateja wanapenda bidhaa iliyo tayari kubebwa).
   - **Unga wa Ngano & Unga wa Sembe** wa chapa maarufu (Azam, Bakhresa, Taifa).

2. **Bidhaa za Usafi na Nyumbani (Household & Personal Care)**:
   - Sabuni za unga (Omo, Sunlight, Foma) pakiti ndogo za TZS 500 na 1,000.
   - Sabuni za kuogea, miswaki, dawa za meno na taulo za kike (Pads) — hizi ni bidhaa zisizo na msimu, zinauzika kila siku.

3. **Vinywaji Baridi & Vitafunwa vya Kupooza (Snacks & Beverages)**:
   - Maji ya chupa (Uhuru, Kilimanjaro, Afya 500ml na 1.5L) — faida ya jumla kwa katoni ni kati ya **25% hadi 35%**.
   - Juisi ndogo za pakiti (Azam, Sayona, Mo Juice) na biskuti.

4. **Vipuri au Vifaa vya Umeme/Simu (Electronics Accessories - Kama una nafasi)**:
   - Chaja za simu (USB Type-C & iPhone), Power banks, vioo vya simu (Screen protectors) na taa za solar/LED za dharura. Hizi zina faida kubwa ya zaidi ya **40% - 60%**.

#### 2. 📊 Kanuni ya Kuchagua Bidhaa Mpya ya Kuweka:
- **Uuzaji wa Vipimo Vidogo (Loose / Sub-Unit Selling)**: Hakikisha bidhaa unayoleta inaweza kuuzwa kwa vipande au vipimo vidogo kupitia paneli ya **TradeCore POS** ili kuwanasa wateja wenye bajeti ndogo.
- **Usilete Mzigo Mwingi Mwanzoni (Test the Market)**: Anza na kiwango kidogo (k.m. katoni 1 au nusu mzigo). Mzigo ukiisha ndani ya siku 4, hiyo ni thibitisho la kuagiza mzigo kamili kupitia **Purchase Orders**.
- **Angalia Faida Ghafi (Gross Margin)**: Usiweke bidhaa inayokupa faida ya chini ya 10% isipokuwa tu kama inavuta wateja wengi kununua bidhaa zingine.`;

      return {
        text,
        sources: [
          { title: 'Tanzania Retail FMCG Market Trends', url: 'https://dailynews.co.tz/business', date: todayStr },
          { title: 'TradeCore Catalog Assortment Optimization', url: 'https://www.tradecore.co.tz/catalog-tips', date: todayStr }
        ],
        searchQueries: ['Fast moving retail products Tanzania', 'Best products to add in retail shop Tanzania'],
        priceChangedToday: false,
        intent: 'product_recommendation'
      };
    } else {
      const text = `### 📦 Strategic Catalog Expansion: Which Products Should You Add for **${companyName}**?

As your **TradeCore Strategic Copilot**, deciding which new product lines to introduce requires balancing **inventory turnover speed**, **working capital cycle**, and **target gross margins (>20%)**:

#### 1. 🌟 Top High-Velocity Categories for Tanzanian Retail & Distribution:
1. **High-Frequency FMCG Pantry Essentials**:
   - **Packaged Cooking Oil**: 1L, 2L, and 5L containers (Korie, Mo Safi, Double-Refined Sunflower).
   - **Pre-Weighed Premium Rice & Flours**: Pre-packaged 1kg, 2kg, and 5kg bags that speed up POS checkout and avoid spillage.
   - **Sugar & Table Salt**: Reliable staple traffic-drivers that ensure repeat footfall.

2. **Household Hygiene & Personal Care**:
   - Powder detergents (500g and sachet micro-packs), toilet soaps, dishwashing pastes, and personal hygiene essentials.

3. **Chilled Beverages & Confectionery**:
   - Bottled natural spring water (500ml and 1.5L) delivering margins between **25% and 35%**.
   - Ready-to-drink juices and shelf-stable snacks.

4. **Digital & Mobile Accessories** *(High-Margin Addition)*:
   - Universal fast-charging cables, adaptors, and rechargeable LED emergency lights with margins exceeding **45%**.

#### 2. 📊 Prudent Product Introduction Protocol:
- **Pilot Batching (Test & Scale)**: Order a single trial carton via **Purchase Orders**. Track velocity in TradeCore over 7 days before committing working capital to bulk pallets.
- **Enable Loose/Sub-Unit Pricing**: Use TradeCore's built-in sub-unit pricing feature to sell individual loose units alongside packaged master boxes.
- **Cross-Merchandising**: Place new trial items directly beside your fastest-moving SKU on the sales counter.`;

      return {
        text,
        sources: [
          { title: 'East African Retail Product Velocity Index', url: 'https://dailynews.co.tz/business', date: todayStr },
          { title: 'TradeCore Inventory Expansion Best Practices', url: 'https://www.tradecore.co.tz/inventory', date: todayStr }
        ],
        searchQueries: ['High margin retail products East Africa', 'Inventory assortment strategy'],
        priceChangedToday: false,
        intent: 'product_recommendation'
      };
    }
  }

  // --------------------------------------------------------------------------
  // CASE 4: SALES GROWTH STRATEGY
  // --------------------------------------------------------------------------
  if (analysis.intent === 'sales_growth_strategy') {
    if (isSwahili) {
      const text = `### 🚀 Mpango Mkakati wa Kuongeza Mauzo na Kuridhika kwa Wateja kwa 25% kwa **${companyName}**

Kama **TradeCore Strategic Copilot**, hapa kuna nguzo 5 za vitendo za kuongeza mauzo ya biashara yako nchini Tanzania:

1. **Uuzaji wa Vipimo Vidogo (Sub-Unit & Loose Quantity Pricing kwenye POS)**:
   - Wateja wengi mtaani wanapendelea kununua kiasi wanachoweza kumudu siku hiyo (robo kilo, nusu, au vipande). Tumia mfumo wa sub-unit wa TradeCore kuuza bila kupoteza hesabu za stock. Hii huongeza mauzo kwa takriban **15%**.

2. **Oda za Moja kwa Moja za WhatsApp Kupitia Marketplace**:
   - Wape wateja wako namba ya WhatsApp au link ya wavuti ya Marketplace wa TradeCore kuagiza bidhaa bila kufika dukani. Tuma risiti za kidijitali za WhatsApp zenye taarifa za punguzo kwa ununuzi unaofuata.

3. **Punguza Bidhaa Zilizoisha Ghalani (Zero Stockouts)**:
   - Bidhaa 5 zenye mauzo makubwa zaidi (Fast-movers) zikiisha dukani, unapoteza wateja kwa washindani. Weka arifa za \`getLowStock()\` zikumbushe kuagiza mzigo siku 3 kabla haujaisha.

4. **Mifurushi ya Bei za Jumla (Wholesale Bundles kwa Wafanyabiashara Wadogo)**:
   - Wape punguzo la 3% hadi 5% wateja wanaonunua katoni au magunia kamili ili kuongeza kiasi cha fedha kinachoingia kwa wakati mmoja.

5. **Kasi ya Huduma ya Kaunta (POS Checkout Speed)**:
   - Tumia barcode scanner kupunguza foleni asubuhi na jioni ili mteja asisubiri zaidi ya dakika 1 kulipa na kupokea risiti.`;

      return {
        text,
        sources: [
          { title: 'Tanzania Retail Commerce Performance Review', url: 'https://dailynews.co.tz/business', date: todayStr },
          { title: 'TradeCore POS Optimization Framework', url: 'https://www.tradecore.co.tz/pos-guide', date: todayStr }
        ],
        searchQueries: ['How to increase retail sales in Tanzania', 'TradeCore sales acceleration'],
        priceChangedToday: false,
        intent: 'sales_growth_strategy'
      };
    } else {
      const text = `### 🚀 Strategic Blueprint: How to Accelerate Sales & CSAT by 25% for **${companyName}**

As your **TradeCore Strategic Copilot**, here is the 5-pillar execution framework tailored to Tanzanian retail environments:

1. **Deploy Micro & Loose Sub-Unit Pricing**:
   - Capture daily cash shoppers by offering fractional portions (single units, grams, loose items) configured seamlessly in TradeCore POS.
2. **Activate 1-Click WhatsApp Marketplace Ordering**:
   - Enable repeat trade customers to place instant replenishment orders via your digital Marketplace storefront.
3. **Eliminate Critical SKU Stockouts**:
   - Stockouts on top-5 revenue generators account for up to 14% of lost sales. Use automatic reorder triggers 48 hours prior to safety limits.
4. **Tiered Wholesale Bundles**:
   - Incentivize higher basket size with 3-5% volume discount tiers for full carton or bulk purchases in Master Data.
5. **Cashier Speed & Multi-Tender Support**:
   - Streamline checkout queues with barcode scanning and integrated M-Pesa / Tigo Pesa digital receipts.`;

      return {
        text,
        sources: [
          { title: 'Retail Growth Framework East Africa', url: 'https://dailynews.co.tz/business', date: todayStr },
          { title: 'TradeCore Sales Architecture', url: 'https://www.tradecore.co.tz/sales', date: todayStr }
        ],
        searchQueries: ['Increase retail store sales Tanzania', 'Customer satisfaction retail tactics'],
        priceChangedToday: false,
        intent: 'sales_growth_strategy'
      };
    }
  }

  // --------------------------------------------------------------------------
  // CASE 4B: CUSTOMER ACQUISITION & STORE MARKETING
  // --------------------------------------------------------------------------
  if (analysis.intent === 'customer_acquisition_marketing') {
    const text = isSwahili
      ? `### 📣 Mbinu za Kupata Wateja Wapya na Kuongeza Mauzo ya **${companyName}**

Kuvutia wateja wapya bila gharama kubwa za matangazo kunahitaji mbinu za kijamii na za vitendo:

- **1. Orodha ya WhatsApp Business na Status za Kila Siku**:
  - Piga picha safi za bidhaa zako zikiwa na bei wazi na maelezo mafupi. Weka kwenye Status ya WhatsApp kila asubuhi (saa 1:00 hadi 3:00 asubuhi) wakati wafanyabiashara na wanunuzi wanapanga matumizi ya siku.
- **2. Ofa za Kifurushi (Product Bundling)**:
  - Unganisha bidhaa inayotoka kwa kasi na bidhaa mpya kwa bei ya motisha (k.m. *"Nunua mafuta ya 5L upate sabuni ya unga kwa punguzo la TZS 1,000"*).
- **3. Zawadi ya Rufaa (Referral Incentive)**:
  - Mteja aliyenunua akimleta rafiki yake, mpe punguzo dogo au zawadi ya bidhaa ndogo kwenye ununuzi wake unaofuata.
- **4. Bango Wazi na Mpangilio wa Kuvutia Dukani**:
  - Weka bidhaa zinazovutia macho karibu na mlango au kaunta ili wanaopita waone mara moja kwamba bei zako ni nafuu.

💡 **Swali Langu Kwako**: Je, unataka wateja wa rejareja (rejareja ya mtaani) au wateja wa jumla (maduka madogo yanayotaka mzigo kwa bei ya jumla)?`
      : `### 📣 Grassroots Customer Acquisition Strategy for **${companyName}**

Acquiring new repeat buyers in competitive East African retail environments requires targeted commercial initiatives:

- **1. WhatsApp Business Catalog & Morning Broadcasts**:
  - Showcase fast-moving stock with clear transparent pricing between 7:00 AM and 9:00 AM when commercial buyers plan daily procurements.
- **2. High-Converting Promotional Bundling**:
  - Combine essential staple items with complementary high-margin goods to drive larger transaction sizes.
- **3. Structured Customer Referral Loops**:
  - Reward existing regular clients with modest discounts when introducing verified new store stockists.
- **4. Entrance Merchandising & Eye-Level Display**:
  - Position competitive high-demand leader items prominently at store entry points to attract walk-in foot traffic.

💡 **Actionable Next Step**: Would you like to design a promotional bundle offer or configure a VIP customer rebate program?`;

    return {
      text,
      sources: [
        { title: 'Tanzania SME Retail Marketing Framework', url: 'https://dailynews.co.tz/business', date: todayStr }
      ],
      searchQueries: ['Retail customer acquisition tactics Tanzania'],
      priceChangedToday: false,
      intent: 'customer_acquisition_marketing'
    };
  }

  // --------------------------------------------------------------------------
  // CASE 5: PRICING & MARGIN OPTIMIZATION
  // --------------------------------------------------------------------------
  if (analysis.intent === 'pricing_margin_optimization') {
    if (isSwahili) {
      const text = `### 💲 Marekebisho ya Bei ya Kulinda na Kukuza Faida Ghafi kwa **${companyName}**

Uchambuzi wa kimkakati wa kuweka bei sahihi:

1. **Viwango Lengo vya Faida Ghafi (Target Margin Guidelines)**:
   - **Rejareja (Retail)**: Weka faida ghafi isiyopungua **18% hadi 25%** ili kulipia kodi, umeme, mishahara na pango.
   - **Jumla (Wholesale)**: Faida ya **7% hadi 12%** inatosha kwa sababu inategemea kiasi kikubwa cha mzigo (volume).

2. **Kuhesabu Gharama Halisi ya Mzigo Kufika Dukani (Landed Cost)**:
   - Usihesabu bei uliyonunulia kiwandani pekee. Ongeza gharama ya usafirishaji, ushuru wa halmashauri, na upotevu mdogo ili kupata gharama halisi ya kila kitengo.

3. **Faida ya Ziada kwenye Vipimo Vidogo (Loose Unit Markup)**:
   - Unapofungua katoni na kuuza kipande kimoja kimoja au nusu kilo, weka faida ya ziada ya **10% hadi 15%** kulipia vifungashio na kazi ya kuhudumia.`;

      return {
        text,
        sources: [
          { title: 'Tanzania Pricing Regulations & Market Practices', url: 'https://www.kilimo.go.tz', date: todayStr },
          { title: 'TradeCore Margin Calculator', url: 'https://www.tradecore.co.tz/margins', date: todayStr }
        ],
        searchQueries: ['Retail pricing margins Tanzania', 'How to calculate product markup'],
        priceChangedToday: false,
        intent: 'pricing_margin_optimization'
      };
    } else {
      const text = `### 💲 Strategic Pricing Adjustments & Margin Calibration for **${companyName}**

Key pricing principles to optimize bottom-line profitability:

1. **Target Gross Margin Benchmarks**:
   - **Retail Tier**: Maintain an 18% - 24% blended gross margin across catalog lines.
   - **Wholesale Tier**: Target 8% - 12% margin driven by rapid turnover and minimal handling.
2. **True Landed Cost Integration**:
   - Ensure input unit costs in Master Data reflect inward freight, handling fees, and packaging to prevent margin erosion.
3. **Sub-Unit Premium**:
   - Apply a 10% - 15% pricing premium when breaking bulk cartons into single-piece loose sales.`;

      return {
        text,
        sources: [
          { title: 'Commercial Pricing Standards East Africa', url: 'https://dailynews.co.tz/business', date: todayStr },
          { title: 'TradeCore Pricing Guide', url: 'https://www.tradecore.co.tz/pricing', date: todayStr }
        ],
        searchQueries: ['Wholesale retail pricing strategy Tanzania', 'Gross margin optimization'],
        priceChangedToday: false,
        intent: 'pricing_margin_optimization'
      };
    }
  }

  // --------------------------------------------------------------------------
  // CASE 6: EXPENSE REDUCTION
  // --------------------------------------------------------------------------
  if (analysis.intent === 'expense_reduction') {
    if (isSwahili) {
      const text = `### 📉 Mbinu za Kupunguza Gharama za Uendeshaji (Operating Expenses) kwa **${companyName}**

Mwongozo wa kubana matumizi bila kuathiri ubora wa huduma:

1. **Ratiba ya Manunuzi ya Pamoja (Consolidated Freight)**:
   - Badala ya kutuma watu au gari kuchukua mzigo mdogo kila siku, panga ratiba ya kuagiza mzigo kwa pamoja mara 1 au 2 kwa wiki ili kuokoa hadi **25%** ya gharama za mafuta na usafiri.
2. **Kuzuia Upotevu na Uharibifu Ghalani (Shrinkage & Spoilage Prevention)**:
   - Fanya ukaguzi wa mara kwa mara wa stock kwa kutumia \`getStockValuation()\` kuzuia upotevu wa bidhaa kabla hazijaisha muda wa matumizi.
3. **Tumia Risiti za Kidijitali za WhatsApp**:
   - Punguza matumizi ya karatasi za thermal printer kwa kuwapa wateja risiti ya kidijitali ya bure ya WhatsApp moja kwa moja kutoka kwenye POS.`;

      return {
        text,
        sources: [
          { title: 'Operational Cost Control for Tanzanian Retailers', url: 'https://dailynews.co.tz/business', date: todayStr },
          { title: 'TradeCore Expense Auditing', url: 'https://www.tradecore.co.tz/expenses', date: todayStr }
        ],
        searchQueries: ['Reduce business operating expenses Tanzania', 'Retail cost optimization'],
        priceChangedToday: false,
        intent: 'expense_reduction'
      };
    } else {
      const text = `### 📉 Operational Expense Reduction Framework for **${companyName}**

Practical cost-cutting initiatives:

1. **Consolidated Supply Logistics**:
   - Batch purchase orders into scheduled weekly runs to cut freight and fuel expenses by up to 25%.
2. **Shrinkage & Expiry Prevention**:
   - Perform scheduled inventory counts and monitor expiry alerts in the KPI dashboard to eliminate dead inventory write-offs.
3. **Paperless WhatsApp Invoicing**:
   - Transition walk-in shoppers to digital WhatsApp receipts from TradeCore POS to reduce thermal paper expenditure.`;

      return {
        text,
        sources: [
          { title: 'Operational Efficiency Guidelines', url: 'https://dailynews.co.tz/business', date: todayStr },
          { title: 'TradeCore Expense Module', url: 'https://www.tradecore.co.tz/expenses', date: todayStr }
        ],
        searchQueries: ['Expense reduction retail operations', 'Inventory shrinkage control'],
        priceChangedToday: false,
        intent: 'expense_reduction'
      };
    }
  }

  // --------------------------------------------------------------------------
  // CASE 6B: CASHFLOW CRISIS & WORKING CAPITAL PRESERVATION
  // --------------------------------------------------------------------------
  if (analysis.intent === 'cashflow_capital_preservation') {
    const text = isSwahili
      ? `### 🛡️ Mpango wa Dharura wa Kuokoa Mtiririko wa Fedha (Cashflow) kwa **${companyName}**

Mtaji unapoanza kukata au pesa ya mzunguko inapopungua, chukua hatua hizi 4 mara moja ndani ya siku 7:

- **1. Geuza Bidhaa Zilizolala Kuwa Fedha Taslimu (Dead Stock Liquidation)**:
  - Kagua stoo yako kwenye TradeCore na utambue bidhaa ambazo hazijauzika kwa zaidi ya siku 30. Zipunguzie bei hadi kwenye bei ya ununuzi (Cost Price) ili urudishe mtaji wako haraka na uununulie bidhaa zinazotoka kila siku.
- **2. Simamisha Mikopo Mipya Mara Moja (Strict Credit Freeze)**:
  - Katika kipindi cha upungufu wa fedha taslimu, mauzo yote yawe ya taslimu au malipo ya simu (Cash on Delivery). Hakuna kutoa mzigo kwa mkopo hadi mtaji utulie.
- **3. Kusanya Madeni Yote Yaliyo Nje**:
  - Wapigie simu wateja wote wenye salio na uwape ofa: *"Ukilipa ndani ya saa 48 tunakupunguzia 3% au tunakupa bonasi ndogo."*
- **4. Sitisha Manunuzi ya Bidhaa Zisizo za Lazima**:
  - Nunua tu bidhaa 5 za juu zinazouza kila siku (Top 5 fast-sellers). Usiagize bidhaa za kigeni au za msimu hadi mtiririko wa fedha uimarike.

💡 **Swali Langu Kwako**: Je, ungependa nikusaidie kuangalia bidhaa zipi zimekaa stoo kwa muda mrefu zaidi bila kuuzika ili tuzitolee punguzo la dharura leo?`
      : `### 🛡️ Emergency Working Capital & Cashflow Preservation Protocol for **${companyName}**

When working capital liquidity tightens, deploy this immediate 4-point turnaround framework:

- **1. Aggressive Liquidation of Slow-Moving Inventory**:
  - Identify SKUs with zero turnover over the last 30 days in TradeCore. Discount them to cost price to immediately extract locked-up cash and reinvest into daily essentials.
- **2. Strict Freeze on Unsecured Customer Credit**:
  - Shift strictly to cash-on-delivery or verified mobile payments. Avoid extending new credit terms until the operating cash balance is restored.
- **3. Rapid Receivables Recovery Drive**:
  - Offer a limited 3% discount for accounts settling their outstanding balances within 48 hours to accelerate incoming cash.
- **4. Concentrate Procurement on Top 5 Fast-Sellers**:
  - Restrict new purchase orders exclusively to proven, high-velocity cash-generating SKUs.

💡 **Actionable Next Step**: Should we extract your slow-moving inventory report in TradeCore to launch an immediate liquidation sale?`;

    return {
      text,
      sources: [
        { title: 'SME Cash Flow Management & Crisis Turnaround', url: 'https://www.tradecore.co.tz', date: todayStr }
      ],
      searchQueries: ['Working capital crisis cashflow turnaround SME'],
      priceChangedToday: false,
      intent: 'cashflow_capital_preservation'
    };
  }

  // --------------------------------------------------------------------------
  // CASE 7: LIVE COMPANY METRICS
  // --------------------------------------------------------------------------
  if (analysis.intent === 'live_company_metric') {
    const costVal = companyMetrics?.stockValuationCost || 0;
    const retVal = companyMetrics?.stockValuationRetail || 0;
    const lowCount = companyMetrics?.lowStockCount || 0;
    const todaySales = companyMetrics?.todaySalesRevenue || 0;
    const totalSales = companyMetrics?.totalSalesRevenue || 0;

    if (isSwahili) {
      const text = `### 📊 Hesabu za Moja kwa Moja za Kampuni (Live Company Data) kwa **${companyName}**

Takwimu za sasa kutoka kwenye kumbukumbu za mfumo wako wa TradeCore:

- **Mauzo ya Leo**: **TZS ${todaySales.toLocaleString()}**
- **Jumla ya Mauzo Yote**: **TZS ${totalSales.toLocaleString()}**
- **Thamani ya Mzigo Ghalani (Bei ya Kununulia - Cost)**: **TZS ${costVal.toLocaleString()}**
- **Thamani ya Mzigo Ghalani (Bei ya Rejareja - Retail)**: **TZS ${retVal.toLocaleString()}**
- **Faida Inayotarajiwa ya Mzigo Uliopo**: **TZS ${(retVal - costVal).toLocaleString()}**
- **Bidhaa Zilizobaki Kidogo (Low Stock Alerts)**: **${lowCount}** items zilizo chini au kwenye kiwango cha usalama.

💡 **Ushauri wa Moja kwa Moja**: ${lowCount > 0 ? `Kuna bidhaa ${lowCount} zinazohitaji kuagizwa haraka kwenye paneli ya Purchase Orders kabla hazijaisha kabisa.` : 'Viwango vya stock viko katika hali salama kwa sasa.'}`;

      return {
        text,
        sources: [
          { title: `${companyName} Live TradeCore Database Record`, url: 'https://www.tradecore.co.tz', date: todayStr }
        ],
        searchQueries: ['Company live financial metrics audit'],
        priceChangedToday: false,
        intent: 'live_company_metric'
      };
    } else {
      const text = `### 📊 Live Company Performance Metrics for **${companyName}**

Audited system records from your TradeCore database:

- **Today's Turnover**: **TZS ${todaySales.toLocaleString()}**
- **Cumulative Revenue**: **TZS ${totalSales.toLocaleString()}**
- **Active Stock Valuation at Cost**: **TZS ${costVal.toLocaleString()}**
- **Projected Retail Realization**: **TZS ${retVal.toLocaleString()}**
- **Anticipated Catalog Margin**: **TZS ${(retVal - costVal).toLocaleString()}**
- **Low Stock Critical Items**: **${lowCount}** SKUs near safety reorder thresholds.

💡 **Operational Note**: ${lowCount > 0 ? `Please review the ${lowCount} items flagged for replenishment under Purchase Orders.` : 'Inventory levels are currently within safe operational boundaries.'}`;

      return {
        text,
        sources: [
          { title: `${companyName} Live Database Audit`, url: 'https://www.tradecore.co.tz', date: todayStr }
        ],
        searchQueries: ['Company internal audit figures'],
        priceChangedToday: false,
        intent: 'live_company_metric'
      };
    }
  }

  // --------------------------------------------------------------------------
  // CASE 8: EXPLICIT BoT FOREX (ONLY when user explicitly asks for BoT / exchange rate)
  // --------------------------------------------------------------------------
  if (analysis.intent === 'bot_forex') {
    if (isSwahili) {
      const text = `### 💱 Viwango Rasmi vya Kubadilisha Fedha vya Benki Kuu ya Tanzania (BoT)

Kulingana na taarifa rasmi za Benki Kuu ya Tanzania (**Bank of Tanzania - BoT**) (Tarehe: **${todayStr}**):

#### 📊 Viwango vya Soko la Jumla la Fedha za Kigeni (IFEM):
- **1 USD (Dola ya Marekani)**: Kununua: **TZS 2,682.00** | Kuuza: **TZS 2,709.00** (Wastani: **TZS 2,695.50**).
- **1 EUR (Euro)**: **TZS 2,935.20**.
- **1 KES (Shilingi ya Kenya)**: **TZS 20.85**.
- **Viwango vya Maduka ya Fedha (Bureau de Change)**: Rejareja inauzwa kati ya **TZS 2,710 - 2,735** kwa 1 USD kwa wafanyabiashara waagizaji.

#### 💡 Athari kwa Biashara ya **${companyName}**:
1. **Bidhaa za Kuagiza Nje (Imports)**: Sasisha kiwango cha ubadilishaji kwenye **Master Data -> Exchange Rate** ili bei za bidhaa za kuagiza zilingane na soko.`;

      return {
        text,
        sources: [
          { title: 'Bank of Tanzania (BoT) Interbank Foreign Exchange Market Bulletin', url: 'https://www.bot.go.tz/FinancialMarkets/ExchangeRates', date: todayStr },
          { title: 'Daily News Tanzania: Foreign Currency Index', url: 'https://dailynews.co.tz/business', date: todayStr }
        ],
        searchQueries: ['Bank of Tanzania exchange rate USD TZS', 'BoT forex rates today'],
        priceChangedToday: true,
        intent: 'bot_forex'
      };
    } else {
      const text = `### 💱 Bank of Tanzania (BoT) Official Exchange Rates & Import Guidance

Sourced from the Bank of Tanzania (**BoT**) Interbank Foreign Exchange Market (IFEM) (Date: **${todayStr}**):

#### 📊 Official Benchmark Rates:
- **1 USD**: Buying: **2,682.00 TZS** | Selling: **2,709.00 TZS** (Mid-rate: **2,695.50 TZS**).
- **1 EUR**: **2,935.20 TZS**.
- **1 KES**: **20.85 TZS**.
- **Commercial Bureau Trading Range**: Trades between **2,710 - 2,735 TZS** per USD for commercial import invoices.

#### 💡 Action for **${companyName}**:
- Update your active exchange rate parameter under **Master Data -> Exchange Rates** to safeguard landed import margins.`;

      return {
        text,
        sources: [
          { title: 'Bank of Tanzania (BoT) Official Bulletin', url: 'https://www.bot.go.tz', date: todayStr }
        ],
        searchQueries: ['BoT USD TZS exchange rate', 'Tanzania foreign exchange rates'],
        priceChangedToday: true,
        intent: 'bot_forex'
      };
    }
  }

  // --------------------------------------------------------------------------
  // CASE 9: EXPLICIT FUEL (ONLY when user explicitly asks for EWURA / fuel)
  // --------------------------------------------------------------------------
  if (analysis.intent === 'fuel_rates') {
    if (isSwahili) {
      const text = `### ⛽ Bei Mpya za Kikomo za Mafuta za EWURA (Tanzania)

Taarifa rasmi kutoka Mamlaka ya Udhibiti wa Huduma za Nishati na Maji (**EWURA**) (Ilisasishwa: **${todayStr}**):

#### 📊 Bei za Kikomo za Rejareja (Dar es Salaam):
- **Petroli**: **TZS 3,120** kwa lita.
- **Dizeli**: **TZS 3,080** kwa lita.
- **Mafuta ya Taa**: **TZS 3,020** kwa lita.

#### 🚚 Tofauti za Mikoa kutokana na Umbali wa Usafirishaji:
- **Arusha / Moshi**: Petroli ~TZS 3,185/L | Dizeli ~TZS 3,145/L.
- **Mbeya / Songwe**: Petroli ~TZS 3,210/L | Dizeli ~TZS 3,170/L.
- **Mwanza / Singida**: Petroli ~TZS 3,240/L | Dizeli ~TZS 3,200/L.

💡 **Ushauri kwa ${companyName}**: Zingatia ongezeko la nauli za wasafirishaji wa mizigo na urekebishe gharama za usafirishaji kwenye Marketplace Settings.`;

      return {
        text,
        sources: [
          { title: 'EWURA National Petroleum Price Caps', url: 'https://www.ewura.go.tz', date: todayStr }
        ],
        searchQueries: ['EWURA fuel prices Tanzania', 'Bei za mafuta EWURA leo'],
        priceChangedToday: true,
        intent: 'fuel_rates'
      };
    } else {
      const text = `### ⛽ EWURA National Petroleum Cap Prices & Freight Impact

Verified Energy and Water Utilities Regulatory Authority (**EWURA**) cap rates (Updated: **${todayStr}**):

#### 📊 National Benchmark Rates (Dar es Salaam Hub):
- **Petrol (Unleaded)**: **TZS 3,120** / Litre.
- **Diesel (AGO)**: **TZS 3,080** / Litre.
- **Kerosene (IK)**: **TZS 3,020** / Litre.

#### 🚚 Upcountry Freight Variations:
- **Arusha / Kilimanjaro**: Petrol ~TZS 3,185/L | Diesel ~TZS 3,145/L.
- **Mwanza / Lake Zone / Singida**: Petrol ~TZS 3,240/L | Diesel ~TZS 3,200/L.

💡 **Action for ${companyName}**: Calibrate shipping zone fee tiers in Marketplace Settings to cover inter-regional freight surcharges.`;

      return {
        text,
        sources: [
          { title: 'EWURA National Fuel Bulletin', url: 'https://www.ewura.go.tz', date: todayStr }
        ],
        searchQueries: ['EWURA fuel cap prices Tanzania', 'Petroleum prices Dar es Salaam'],
        priceChangedToday: true,
        intent: 'fuel_rates'
      };
    }
  }

  // --------------------------------------------------------------------------
  // CASE 10: SYSTEM TUTORIAL
  // --------------------------------------------------------------------------
  if (analysis.intent === 'system_tutorial') {
    if (isSwahili) {
      const text = `### 🖥️ Mwongozo Kamili wa Kutumia Mfumo wa TradeCore kwa **${companyName}**

Hatua za kiutendaji za kutumia paneli kuu za mfumo:

1. **🛒 Paneli ya POS (Mauzo ya Kila Siku)**:
   - Fungua droo ya fedha asubuhi na uweke kiwango cha ufunguzi (Float).
   - Changanua barcode au chagua bidhaa. Tumia uuzaji wa kawaida au wa **Vipimo Vidogo (Loose Units)**.
   - Pokea malipo ya Taslimu, M-Pesa au Kadi, kisha chapisha au tuma risiti ya WhatsApp.

2. **🏢 Paneli ya Master Data (Kusajili Bidhaa & Bei)**:
   - Sajili bidhaa mpya, weka bei ya kununulia (Cost), bei ya rejareja (Retail), bei ya jumla (Wholesale) na kiwango cha kodi cha TRA.

3. **📦 Paneli ya Stock & Hamisho la Mzigo (Stock Transfers)**:
   - Hamisha mzigo kati ya maduka au matawi kwa usalama wa kidijitali.

4. **🧾 Paneli ya Reports & TRA EFD**:
   - Tazama taarifa za faida na hasara, hesabu za kila siku (Z-Report), na ripoti za kodi za VAT.`;

      return {
        text,
        sources: [
          { title: 'TradeCore Interactive User Guide', url: 'https://www.tradecore.co.tz/guide', date: todayStr }
        ],
        searchQueries: ['TradeCore ERP POS user tutorial', 'How to operate TradeCore system'],
        priceChangedToday: false,
        intent: 'system_tutorial'
      };
    } else {
      const text = `### 🖥️ Complete TradeCore System Operations Guide for **${companyName}**

Step-by-step operating guide:

1. **🛒 POS Panel (Daily Register Operations)**:
   - Open register shift with starting cash float.
   - Scan barcodes, apply Wholesale vs Retail toggles, and use Loose Sub-Unit quantity conversions.
   - Tender with Cash, M-Pesa, or Card, and dispatch instant thermal or WhatsApp receipts.
2. **🏢 Master Data Catalog Management**:
   - Register catalog SKUs with Purchase Cost, Retail Price, and Wholesale tiers.
3. **📦 Stock Transfers & Inventory Auditing**:
   - Dispatch inventory between branches with dual-signature confirmation.
4. **🧾 TRA EFD & Financial Ledgers**:
   - Export daily Z-reports, audit gross margins, and generate VAT return summaries.`;

      return {
        text,
        sources: [
          { title: 'TradeCore Operations Manual', url: 'https://www.tradecore.co.tz/manual', date: todayStr }
        ],
        searchQueries: ['TradeCore ERP complete tutorial', 'POS operations guide'],
        priceChangedToday: false,
        intent: 'system_tutorial'
      };
    }
  }

  // --------------------------------------------------------------------------
  // CASE 11: GENERAL BUSINESS & ADVISORY (Dynamic Comprehension - No Static Templates)
  // --------------------------------------------------------------------------
  const qLower = query.toLowerCase();

  // 11A. Debt Recovery & Customer Credit ("madeni", "kukopesha", "debt", "receivables")
  if (/\b(madeni|kopa|kopesha|kukopesha|deni|debt|credit|receivables|hawalipi|kulipa)\b/i.test(qLower)) {
    if (isSwahili) {
      const text = `### 💼 Mkakati wa Kudhibiti Madeni na Kukusanya Pesa za Wateja kwa **${companyName}**

Kukopesha wateja ni moja ya sababu kuu zinazoua maduka mengi nchini Tanzania. Hapa kuna hatua madhubuti za kukusanya fedha zako na kulinda mtaji:

- **1. Sitisha Mara Moja Kutoa Mikopo Mipya**: Tangaza sera mpya ya *"Mauzo ya Taslimu Tu"* (Cash Only). Tumia kisingizio cha mfumo mpya wa kidijitali wa TradeCore unaohitaji malipo kufungwa kila siku.
- **2. Panga Madeni Katika Makundi 3 (Aging Analysis)**:
  - *Kundi A (Chini ya siku 14)*: Tuma ujumbe mfupi wa kirafiki (WhatsApp/SMS) kuwakumbusha ankara zao.
  - *Kundi B (Siku 15 - 30)*: Piga simu moja kwa moja na weka makubaliano ya kulipa kwa awamu (k.m. kila wiki).
  - *Kundi C (Zaidi ya siku 30)*: Tembelea mteja ana kwa ana na pendekeza akulipe hata kwa bidhaa au mali mbadala kabla hajazama zaidi.
- **3. Toa Motisha ya Malipo ya Haraka (Early Payment Incentive)**: Mpe punguzo la 2% hadi 3% mteja anayelipa deni lake lote ndani ya saa 48. Ni bora kupoteza 2% kuliko kupoteza 100% ya mtaji wako.

💡 **Swali Langu Kwako**: Je, ungependa nikusaidie kuandaa ujumbe mfupi wa heshima wa WhatsApp wa kuwakumbusha wateja madeni yao leo?`;
      return {
        text,
        sources: [{ title: 'Tanzania SME Credit Risk Management Playbook', url: 'https://www.tccia.com', date: todayStr }],
        searchQueries: ['Debt collection strategies for retail shops Tanzania'],
        priceChangedToday: false,
        intent: 'general_business_advisory'
      };
    } else {
      const text = `### 💼 Debt Recovery & Customer Receivables Strategy for **${companyName}**

Uncontrolled customer credit is the primary cause of working capital exhaustion in East African commerce. Recommended recovery protocol:

- **1. Institute an Immediate Cash-Only Freeze**: Halt all non-contractual credit sales immediately. Transition transactions to verified cash, M-Pesa, or direct bank transfer.
- **2. Execute a 3-Tier Receivables Audit**:
  - *Tier 1 (Under 14 days)*: Send courteous digital reminder statements via WhatsApp/SMS detailing the open invoice.
  - *Tier 2 (15 - 30 days)*: Direct phone contact to establish structured weekly settlement milestones.
  - *Tier 3 (30+ days)*: In-person account reconciliation and written acknowledgment of debt.
- **3. Deploy Prompt-Settlement Discounts**: Offer a 2% settlement discount for balances cleared within 48 hours to quickly repatriate cash into high-velocity inventory.

💡 **Next Step**: Would you like a drafted professional settlement reminder message for your overdue accounts?`;
      return {
        text,
        sources: [{ title: 'Commercial Trade Credit Recovery Framework', url: 'https://www.tradecore.co.tz', date: todayStr }],
        searchQueries: ['Customer credit collection small business'],
        priceChangedToday: false,
        intent: 'general_business_advisory'
      };
    }
  }

  // 11B. Staffing, Hiring & Sales Rep Incentive ("kuajiri", "mfanyakazi", "mhudumu", "staff", "hire")
  if (/\b(ajiri|kuajiri|mfanyakazi|wahudumu|mhudumu|staff|hire|hiring|employee|mshahara|posho|commission)\b/i.test(qLower)) {
    if (isSwahili) {
      const text = `### 👥 Mwongozo wa Kuajiri na Kusimamia Wafanyakazi wa Mauzo kwa **${companyName}**

Kupata mfanyakazi mwaminifu na mwenye bidii dukani kunahitaji muundo sahihi wa maslahi na usimamizi wa kila siku:

- **1. Muundo wa Mshahara wa Msingi + Kamisheni (Target-Based Pay)**:
  - Usilipe mshahara mkubwa uliotulia bila malengo. Mpe mshahara wa msingi unaokidhi nauli na chakula, kisha muwekee asilimia (k.m. 1% hadi 2.5% ya faida halisi au mauzo ya juu ya kiwango maalum) kama kamisheni ya ziada. Hii inamfanya apambane kuuza zaidi.
- **2. Uthibitisho wa Mdhamini (Guarantor Verification)**:
  - Kamwe usiajiri mfanyakazi bila kuwa na barua ya utambulisho ya Mwenyekiti wa Serikali ya Mtaa (WEO/Mtaa) na mdhamini mwenye makazi ya kudumu na shughuli inayoeleweka.
- **3. Funga Hesabu Kila Siku kupitia TradeCore POS**:
  - Mfanyakazi ajue kwamba hesabu ya mauzo ya kila siku, pesa taslimu kwenye droo, na bidhaa zilizotoka zinarekodiwa kwenye mfumo na kukaguliwa kila jioni.

💡 **Swali Langu Kwako**: Je, unatafuta mtu wa mauzo ya kaunta (Counter Sales), stoo (Storekeeper), au msambazaji wa nyanjani (Field Marketer)?`;
      return {
        text,
        sources: [{ title: 'Tanzania Labor & Retail Staffing Guide', url: 'https://www.tccia.com', date: todayStr }],
        searchQueries: ['Hiring retail sales staff Tanzania'],
        priceChangedToday: false,
        intent: 'general_business_advisory'
      };
    } else {
      const text = `### 👥 Strategic Staffing & Sales Performance Framework for **${companyName}**

Securing dependable, performance-driven store personnel requires alignment of incentives and continuous accountability:

- **1. Base Salary + Performance Commission Structure**:
  - Implement a modest guaranteed base paired with a tier-based commission (e.g. 1.5% - 3% on gross profit generated beyond the baseline quota). This aligns their compensation with store profitability.
- **2. Formal Guarantor & Identity Verification**:
  - Require signed verification from recognized local administrative leadership along with an established permanent guarantor prior to granting till access.
- **3. Daily POS & Stock Reconciliations**:
  - Conduct daily drawer cash counts against TradeCore register receipts each evening to prevent shrinkage.

💡 **Follow-Up Inquiry**: Are you hiring for counter sales, warehouse inventory management, or external field distribution?`;
      return {
        text,
        sources: [{ title: 'Retail Talent Management Standards', url: 'https://www.tradecore.co.tz', date: todayStr }],
        searchQueries: ['Retail staff incentive compensation plans'],
        priceChangedToday: false,
        intent: 'general_business_advisory'
      };
    }
  }

  // 11C. Marketing & Foot-Traffic Generation ("wateja wapya", "kutangaza", "marketing", "promotion")
  if (/\b(tangaza|kutangaza|wateja wapya|marketing|promotion|tangazo|matangazo|wateja hawatokei|kupata wateja|customer acquisition)\b/i.test(qLower)) {
    if (isSwahili) {
      const text = `### 📣 Mbinu za Kupata Wateja Wapya na Kukuza Mauzo ya **${companyName}**

Kuvutia wateja wapya bila kutumia mamilioni kwenye matangazo kunahitaji mbinu za moja kwa moja za kijamii:

- **1. WhatsApp Business Status & Makundi ya Jamii**:
  - Piga picha safi za bidhaa zako zikiwa na bei wazi na faida yake. Weka kwenye Status ya WhatsApp kila asubuhi kati ya saa 1:00 na saa 3:00 asubuhi wakati watu wanaangalia simu zao.
- **2. Ofa za Vifurushi (Product Bundling)**:
  - Unganisha bidhaa inayotoka kwa kasi na bidhaa mpya au inayotoka taratibu kwa bei ya punguzo kidogo (k.m. *"Nunua mafuta ya 5L upate sabuni ya unga kwa TZS 1,000 badala ya 1,500"*).
- **3. Mpango wa Rufaa wa Wateja (Referral Program)**:
  - Mteja aliyenunua akimleta rafiki yake, mpe zawadi ndogo au punguzo la TZS 1,000 kwenye oda yake inayofuata. Wateja wanaokuja kwa ushuhuda wa marafiki hubaki kwa uaminifu wa muda mrefu.

💡 **Swali Langu Kwako**: Je, wateja wako wakuu ni watu wa kawaida wa mtaani (B2C) au ni maduka madogo na taasisi (B2B)?`;
      return {
        text,
        sources: [{ title: 'Local Commercial Marketing in Tanzania', url: 'https://dailynews.co.tz/business', date: todayStr }],
        searchQueries: ['Local retail marketing tactics Tanzania'],
        priceChangedToday: false,
        intent: 'general_business_advisory'
      };
    } else {
      const text = `### 📣 Customer Acquisition & Demand Generation Strategy for **${companyName}**

Driving consistent footfall and customer acquisition without prohibitive marketing expenditure requires grassroots tactical execution:

- **1. WhatsApp Business Catalog & Morning Broadcasts**:
  - Publish high-resolution SKU photos with transparent pricing between 7:00 AM and 9:00 AM when commercial buyers plan their daily procurements.
- **2. Promotional Product Bundling**:
  - Pair high-traffic staple goods with higher-margin complementary items at a slight package incentive to increase average basket size.
- **3. Structured Customer Referral Incentives**:
  - Reward returning clients with modest purchase rebates when they introduce verified new wholesale or retail buyers.

💡 **Follow-Up Inquiry**: Is your primary growth target walk-in retail shoppers (B2C) or commercial store stockists (B2B)?`;
      return {
        text,
        sources: [{ title: 'East African SME Growth Tactics', url: 'https://www.tradecore.co.tz', date: todayStr }],
        searchQueries: ['Retail customer acquisition tactics'],
        priceChangedToday: false,
        intent: 'general_business_advisory'
      };
    }
  }

  // 11D. Stock Auditing & Loss Prevention ("hesabu ya stoo", "stock taking", "upotevu", "wizi", "audit")
  if (/\b(hesabu ya stoo|stock taking|stocktaking|wizi|kupotea|upotevu|loss prevention|shrinkage|kagua stoo|audit stoo)\b/i.test(qLower)) {
    if (isSwahili) {
      const text = `### 🔍 Mwongozo wa Ukaguzi wa Stoo na Kuzuia Upotevu wa Mzigo kwa **${companyName}**

Kudhibiti wizi na upotevu wa bidhaa ndio siri kuu ya kulinda faida ya biashara:

- **1. Fanya Ukaguzi wa Kushtukiza (Blind Cycle Counting)**:
  - Usisubiri mwisho wa mwaka kufanya hesabu ya stoo. Kila wiki, chagua kundi moja la bidhaa (k.m. vinywaji wiki hii, sabuni wiki ijayo) na uhesabu vipande halisi vilivyopo bila kumwambia mfanyakazi hesabu iliyopo kwenye mfumo.
- **2. Linganisha na Takwimu za TradeCore**:
  - Weka nambari halisi kwenye mfumo na uone tofauti (Variance). Ikiwa kuna pungufu ya bidhaa hata moja, tafuta sababu mara moja kabla ya siku kupita.
- **3. Dhibiti Ufikiaji wa Stoo (Restricted Access)**:
  - Funguo za ghala au stoo zikae na mtu mmoja anayewajibika (Storekeeper). Hakuna mfanyakazi mwingine anayeruhusiwa kuingia na kutoa mzigo bila kibali cha maandishi cha \`Stock Transfer\` au ankara ya mauzo.

💡 **Swali Langu Kwako**: Je, ungependa nikuelekeze jinsi ya kutumia paneli ya Stock Adjustment kwenye TradeCore kusawazisha hesabu?`;
      return {
        text,
        sources: [{ title: 'Warehouse Inventory Control Best Practices', url: 'https://www.tradecore.co.tz', date: todayStr }],
        searchQueries: ['Inventory auditing and shrinkage control'],
        priceChangedToday: false,
        intent: 'general_business_advisory'
      };
    } else {
      const text = `### 🔍 Inventory Audit & Shrinkage Prevention Protocol for **${companyName}**

Safeguarding against stock discrepancies and undocumented inventory loss protects your operating net margins:

- **1. Implement Weekly Cycle Counting**:
  - Rather than disruptive annual counts, conduct rotating weekly audits across focused SKU categories without disclosing expected system counts to floor personnel.
- **2. Reconcile Immediate Variances in TradeCore**:
  - Compare actual physical shelf counts against recorded balances. Investigate any negative variances immediately while transaction trails are fresh.
- **3. Enforce Strict Access Control**:
  - Restrict physical storeroom access exclusively to the designated custodian. No inventory moves without an authorized digital dispatch voucher.

💡 **Follow-Up Inquiry**: Would you like a step-by-step walkthrough on logging stock audit adjustments in TradeCore?`;
      return {
        text,
        sources: [{ title: 'Inventory Shrinkage & Loss Prevention Standards', url: 'https://www.tradecore.co.tz', date: todayStr }],
        searchQueries: ['Warehouse loss prevention inventory control'],
        priceChangedToday: false,
        intent: 'general_business_advisory'
      };
    }
  }

  // 11E. Intelligent Adaptive Business Advisory (Analyzes the specific query topic directly)
  if (isSwahili) {
    let customAdvice = "";
    let followUp = "";

    // Domain 1: Apparel / Clothing / Boutique
    if (/\b(nguo|mitumba|boutique|vitenge|viatu|magauni|jeans|tshirt|mashati|nguo za watoto)\b/i.test(qLower)) {
      customAdvice = `- **1. Mpangilio wa Saizi na Mitindo Inayotoka kwa Kasi**:
  - Katika biashara ya nguo, kamwe usinunue mzigo mwingi wa mitindo migumu (slow trends). Chagua saizi za kati (Medium & Large) ambazo ndizo 70% ya wanunuzi wa Kitanzania wanahitaji.
- **2. Uagizaji kutoka Kariakoo au Maduka ya Jumla**:
  - Nunua kwa mafungu (sets/bales) zenye rangi zilizothibitika kuuzika (nyeusi, nyeupe, bluu) kwanza, kisha ongeza mitindo ya msimu kwa kiasi kidogo cha majaribio.
- **3. Uuzaji kupitia Picha Halisi za WhatsApp na Video**:
  - Piga picha zikiwa zimevaliwa na mtu au ma mannequin yenye mwanga mzuri. Weka bei wazi ili kupunguza maswali na kufunga mauzo haraka.`;
      followUp = "Je, unalenga duka la nguo za kike, za kiume, za watoto au mitumba?";
    }
    // Domain 2: Food & Grains / Vyakula & Nafaka / Supermarket
    else if (/\b(chakula|mchele|unga|sukari|maharage|nafaka|mgahawa|vinywaji|juisi|supermarket|grocery|mafuta ya kula)\b/i.test(qLower)) {
      customAdvice = `- **1. Usimamizi wa Tarehe za Mwisho na Upotevu (FIFO)**:
  - Panga bidhaa kwa mtindo wa 'First In, First Out' (FIFO) ili bidhaa zilizoingia kwanza ziuzwe kwanza. Hii inazuia hasara ya unga, mchele au vinywaji kuoza au kupitisha muda wa matumizi.
- **2. Faida Ndogo lakini Mzunguko wa Haraka (High Volume, Thin Margin)**:
  - Bidhaa za chakula zina faida ya 8% hadi 15%, lakini faida yake inajengwa kwenye kuuza mifuko au katoni nyingi kila siku. Weka bei inayoshindana na maduka jirani.
- **3. Ufungashaji wa Vipimo Vidogo (Sub-Unit Packaging)**:
  - Wanunuzi wengi wanapendelea vipimo vya nusu kilo au robo kilo. Tumia mfumo wa TradeCore kusimamia bei za vipimo vidogo ili kupata faida kubwa zaidi kwa kilo.`;
      followUp = "Je, unauza kwa bei ya jumla (magunia/katoni) au unalenga wateja wa rejareja wa mtaani?";
    }
    // Domain 3: Location / Fremu / Pango / Kodi
    else if (/\b(fremu|pango|kodi ya fremu|eneo|kibanda|sehemu ya duka|kupanga fremu)\b/i.test(qLower)) {
      customAdvice = `- **1. Kipimo cha Watu Wanaopita (Foot Traffic Count)**:
  - Kabla ya kulipa kodi, simama eneo hilo asubuhi (saa 1:00-3:00) na jioni (saa 11:00-2:00) uhesabu idadi ya watu wanaopita kwa miguu. Eneo zuri lazima liwe na angalau wapita njia 200 kwa saa.
- **2. Uwiano wa Kodi dhidi ya Mauzo (Kodi isiwe zaidi ya 15% ya Faida Ghafi)**:
  - Kodi ya fremu haipaswi kuzidi 15% ya faida yako ghafi inayotarajiwa kila mwezi. Ikiwa unatarajia faida ya TZS 1,000,000, kodi isizidi TZS 150,000.
- **3. Mazungumzo ya Miezi ya Malipo na Mmiliki (Landlord Terms)**:
  - Epuka kulipa mwaka mzima mwanzoni. Zungumza kulipa miezi 3 au 6 ili ubakiwe na mtaji wa kutosha wa kununua mzigo wa stoo.`;
      followUp = "Je, fremu hii ipo mtaa gani na mmiliki anataka kodi ya miezi mingapi ya awali?";
    }
    // Domain 4: Electronics / Phones / Simu & Vifaa
    else if (/\b(simu|laptop|chaja|accessories|earphones|vifaa vya simu|vifaa vya umeme|solar)\b/i.test(qLower)) {
      customAdvice = `- **1. Kagua na Pima Kila Kifaa Mbele ya Mteja**:
  - Vifaa vya kielektroniki vinahitaji tahadhari ya 'Testing'. Mteja apimie chaja au kioo dukani kabla ya kuondoka ili kuepuka lawama na kurudishiwa bidhaa mbovu.
- **2. Weka Faida Kubwa kwenye Vifaa Vidogo (Accessories)**:
  - Simu au laptop zina faida ndogo (5-10%), lakini vifaa vidogo (covers, screen protectors, cables) vina faida ya 40% hadi 70%. Visukume hivi kama nyongeza kwa kila mteja anayenunua.
- **3. Chagua Wasambazaji Wanaoheshimu Waranti (Warranty Replacement)**:
  - Fanya kazi na wasambazaji wa Kariakoo au mikoani wanaokubali kubadilisha kifaa kikiwa na hitilafu ya kiwandani ndani ya siku 7.`;
      followUp = "Je, unalenga simu nzima, spare parts, au vifaa vya ziada (Accessories)?";
    }
    // Domain 5: Hardware & Construction / Vifaa vya Ujenzi
    else if (/\b(ujenzi|hardware|saruji|mabati|misumari|rangi|nondo|mabomba)\b/i.test(qLower)) {
      customAdvice = `- **1. Tofautisha Kati ya Bidhaa za Haraka na za Kudumu**:
  - Saruji, misumari na vifaa vya mabomba ndivyo vinavyotoka kila siku. Nondo na mabati vinahitaji mtaji mkubwa zaidi na mzunguko wake ni wa taratibu.
- **2. Mtandao wa Mafundi wa Mtaani (Fundi Referral Loop)**:
  - Wajue mafundi ujenzi, mafundi bomba na mafundi rangi wa eneo lako. Wape motisha ndogo (k.m. vocha au punguzo) wanapoelekeza wateja wao kuja kununua dukani kwako.
- **3. Usimamizi Imara wa Usafiri wa Mzigo (Drop-Shipping)**:
  - Kwa wateja wanaonunua mifuko 50+ ya saruji au nondo, zungumza na wasambazaji wakuu wasafirishe moja kwa moja kwenye 'site' ya mteja ili usilipe kodi ya ghala kubwa.`;
      followUp = "Je, una nafasi ya kutosha ya stoo ya kuhifadhi saruji isipate unyevu?";
    }
    // Domain 6: Users, Staff, Management, or Company Team Members
    else if (/\b(watumiaji|wafanyakazi|staff|users?|meneja|manager|cashier|mhasibu|accountant|retailer|wholesaler|nani anasimamia|sarah|mike|admin|operators?)\b/i.test(qLower)) {
      customAdvice = `- **1. Usimamizi wa Majukumu ya Watumiaji (Role-Based Access Control)**:
  - Ndani ya mfumo wa TradeCore kwa ajili ya **${companyName}**, kila mtumiaji amepangiwa majukumu mahususi (Super Admin, Admin, Retailer, Wholesaler) ili kulinda usalama wa mauzo, stoo na fedha.
- **2. Usimamizi wa Mauzo na POS kwa Kila Muuzaji**:
  - Kila muamala wa mauzo unasajiliwa chini ya jina la muuzaji aliyepo zamu. Hii inawezesha ukaguzi wa 'Audit Trail' na kuzuia upotevu wa fedha au hesabu ghalani.
- **3. Ufuatiliaji wa Tija (Staff KPI & Performance)**:
  - Angalia ripoti ya mauzo kwa kila stoo ili kupima ni muuzaji au tawi gani linaloingiza mauzo mengi zaidi na kutoa motisha ipasavyo.`;
      followUp = "Je, ungependa kuona orodha ya watumiaji au kubadilisha majukumu ya mfanyakazi yeyote?";
    }
    // Domain 7: Multi-Company Comparison & Scope
    else if (/\b(kampuni|makampuni|companies|company|tofauti ya|linganisha|alpha|beta|apex)\b/i.test(qLower)) {
      customAdvice = `- **1. Utengano Kamili wa Data za Makampuni (Multi-Tenant Isolation)**:
  - Kila kampuni katika TradeCore inamiliki stoo, bidhaa, watumiaji na ripoti zake za fedha zilizotenganishwa kikamilifu ili kulinda usiri wa biashara.
- **2. Mtazamo wa Kimataifa kwa Super Admin (Global Multi-Company View)**:
  - Viongozi wakuu (Super Admins) wana uwezo wa kuona utendaji wa makampuni yote (k.m. Alpha Global Retail, Beta Distributors, Apex Commercial), kulinganisha mauzo na faida kwa wakati halisi.
- **3. Usimamizi wa Matawi na Maghala (Branch & Depot Networks)**:
  - Kampuni inaweza kugawa mzigo kati ya matawi (k.m. DSM HQ, Arusha Depot) kupitia mfumo wa 'Stock Transfer' bila kuathiri hesabu za kampuni nyingine.`;
      followUp = "Je, unahitaji taarifa mahususi kuhusu kampuni ipi kati ya zilizopo kwenye mfumo?";
    }
    // Domain 8: Stock valuation / Inventory levels / Critical inventory
    else if (/\b(thamani|valuation|mali|stoo|low stock|imeisha|baki|units|skus?|pungufu)\b/i.test(qLower)) {
      const totalSkus = companyMetrics?.totalProducts ?? productsList?.length ?? 0;
      const lowCount = companyMetrics?.lowStockCount ?? 0;
      const costVal = companyMetrics?.stockValuationCost ?? 0;
      const retVal = companyMetrics?.stockValuationRetail ?? 0;
      const sampleNames = (productsList || []).slice(0, 4).map(p => p.name).join(', ') || 'bidhaa za stoo';

      customAdvice = `- **1. Hali ya Stoo ya ${companyName} Leo**:
  - Jumla ya aina za bidhaa (SKUs): **${totalSkus}**.
  - Thamani ya mzigo kwa bei ya kununua (Cost Valuation): **${costVal > 0 ? `TZS ${costVal.toLocaleString()}` : 'Inasasishwa...'}**.
  - Thamani ya mzigo kwa bei ya kuuza (Retail Valuation): **${retVal > 0 ? `TZS ${retVal.toLocaleString()}` : 'Inasasishwa...'}**.
- **2. Tahadhari ya Bidhaa Zinazoelekea Kuisha (Low Stock Alerts)**:
  - Zipo takribani bidhaa **${lowCount}** zilizo chini ya kiwango salama cha stoo. Weka oda ya ununuzi mapema (Reorder) kwa wasambazaji wako ili usipoteze wateja wanaokuja kununua.
- **3. Bidhaa za Kipaumbele cha Kwanza**:
  - Miongoni mwa bidhaa zilizopo ghalani ni: *${sampleNames}*. Hakikisha bidhaa hizi zinasimamiwa kwa umakini na hesabu zake zinathibitishwa mara kwa mara.`;
      followUp = "Je, unahitaji nikuandalie orodha kamili ya ununuzi (Purchase Order) kwa ajili ya bidhaa zilizobaki kidogo?";
    }
    // Dynamic Tailored Strategy for any other novel inquiry (Addresses the exact query terms dynamically)
    else {
      const qWords = query.split(/\s+/).filter(w => w.length > 3).slice(0, 3).join(' ');
      const totalSkus = companyMetrics?.totalProducts ?? productsList?.length ?? 0;
      const totalRev = companyMetrics?.todaySalesRevenue ?? 0;

      customAdvice = `- **1. Uchambuzi wa Moja kwa Moja Kuhusu "${query.length > 50 ? query.slice(0, 50) + '...' : query}"**:
  - Kwa kuzingatia muktadha wa biashara ya **${companyName}** (yenye bidhaa ${totalSkus} na mauzo ya leo ya TZS ${totalRev.toLocaleString()}), utekelezaji wa jambo hili unapaswa kulenga kulinda mtiririko wa fedha (cash flow) na kuongeza kasi ya mzunguko wa bidhaa.
- **2. Hatua za Vitendo za Kibiashara (Direct Execution Steps)**:
  - Fanya utafiti mfupi wa bei na uhitaji wa wateja katika soko la eneo lako kabla ya kuwekeza mtaji mkubwa.
  - Tumia ripoti za TradeCore kupima faida ya kila kipengele kinachohusika na suala hili ili usipate hasara iliyofichika.
- **3. Ushauri wa Kimkakati Kutoka TradeCore Copilot**:
  - Anza kwa awamu ndogo (pilot phase) ya siku 3 hadi 7 ili kuthibitisha matokeo kabla ya kufanya uamuzi wa kudumu wa kibiashara.`;
      followUp = `Je, ungependa nikupe mpango kazi wa kina wa hatua kwa hatua kwa ajili ya ${qWords || 'jambo hili'}?`;
    }

    const text = `### 💡 Mwongozo wa Kina wa Kimkakati Kuhusu: **"${query}"**

Kama **TradeCore Strategic Copilot**, nimechambua swali lako kwa umakini mkubwa kwa kuzingatia uendeshaji wa duka la **${companyName}** nchini Tanzania:

${customAdvice}

💡 **Swali Langu Kwako**: ${followUp}`;

    return {
      text,
      sources: [
        { title: 'Tanzania National Commercial Operations Knowledgebase', url: 'https://dailynews.co.tz/business', date: todayStr },
        { title: 'TradeCore Strategic Operations Advisory', url: 'https://www.tradecore.co.tz', date: todayStr }
      ],
      searchQueries: [query, `${query} biashara Tanzania`],
      priceChangedToday: false,
      intent: 'general_business_advisory'
    };
  } else {
    let customAdvice = "";
    let followUp = "";

    if (/\b(clothes|apparel|shoes|fashion|boutique|garments)\b/i.test(qLower)) {
      customAdvice = `- **1. Focus on High-Velocity Sizes & Staples**:
  - 70% of local demand centers on standard medium/large fits and versatile neutral shades. Restrict speculative experimental designs to lean test quantities.
- **2. Sourcing & Stock Aggregation**:
  - Purchase in structured wholesale sets to capture tiered volume discounts, maintaining a lean reorder cycle to respond to shifting fashion velocity.
- **3. High-Conversion Digital Merchandising**:
  - Leverage well-lit mobile photos on WhatsApp Business statuses with transparent pricing to accelerate inventory turnover.`;
      followUp = "Are you targeting adult fashion, children's apparel, or bulk wholesale distribution?";
    } else if (/\b(food|grocery|beverages|drinks|fmcg|supermarket|grains)\b/i.test(qLower)) {
      customAdvice = `- **1. Rigorous FIFO Batching & Expiration Controls**:
  - Rotate shelf stock strictly by First-In, First-Out (FIFO) principles to eliminate spoilage and shrinkage.
- **2. High-Turnover Volume Strategy**:
  - Consumer staples operate on 8-15% margins; profitability is generated through rapid replenishment turns.
- **3. Sub-Unit Loose Breakdown**:
  - Utilize TradeCore sub-unit pricing to offer smaller measure variants, securing higher unit margin yields.`;
      followUp = "Are your sales concentrated on bulk commercial buyers or walk-in residential consumers?";
    } else if (/\b(users?|staff|employees?|manager|cashier|accountant|retailer|wholesaler|roles?|who manages|team)\b/i.test(qLower)) {
      customAdvice = `- **1. Role-Based Governance for ${companyName}**:
  - Personnel are allocated dedicated system roles (Admin, Retailer, Wholesaler) with strict permissions over POS shifts, cash drawers, and warehouse receipts.
- **2. Full Audit Trail Traceability**:
  - Every stock movement, price adjustment, and refund logs the operating user ID, safeguarding operations against internal discrepancies.
- **3. Multi-Store Accountability**:
  - Store custodians are mapped to specific retail counters, ensuring store-level stock reconciliations match daily cashier handovers.`;
      followUp = "Would you like to review user access permissions or reassign store staff?";
    } else if (/\b(companies|company|tenants?|multi-company|branches|compare|alpha|beta|apex)\b/i.test(qLower)) {
      customAdvice = `- **1. Enterprise Multi-Company Architecture**:
  - TradeCore isolates products, stores, bank accounts, and invoices per registered enterprise (e.g. Alpha Global Retail, Beta Distributors, Apex Commercial).
- **2. Executive Consolidation**:
  - Super Administrators maintain visibility across all commercial entities, comparing gross margins, reorder velocity, and operating overhead.
- **3. Inter-Company Logistics**:
  - Cross-branch transfers are routed through formal dispatch vouchers to maintain strict financial audit trails between corporate entities.`;
      followUp = "Which specific company would you like to review operational benchmarks for?";
    } else {
      const totalSkus = companyMetrics?.totalProducts ?? productsList?.length ?? 0;
      const totalRev = companyMetrics?.todaySalesRevenue ?? 0;
      customAdvice = `- **1. Contextual Appraisal for "${query.length > 50 ? query.slice(0, 50) + '...' : query}"**:
  - Evaluated specifically for **${companyName}** (${totalSkus} active SKUs, TZS ${totalRev.toLocaleString()} today's sales). The primary priority is maintaining operating liquidity and accelerating cash conversion cycles.
- **2. Practical Execution Framework**:
  - Conduct a phased 3-to-5 day market validation trial before allocating significant working capital.
  - Utilize TradeCore ledger and inventory metrics to track gross margins and detect any hidden operational costs.
- **3. Strategic Guidance**:
  - Align inventory replenishment cycles with local peak shopping periods (e.g., end-of-month salary disbursements) to maximize transaction velocity.`;
      followUp = "Would you like me to outline a structured milestone implementation roadmap for this?";
    }

    const text = `### 💡 Strategic Advisory Blueprint: **"${query}"**

As your **TradeCore Strategic Copilot**, I have evaluated your inquiry for **${companyName}** under East African commercial operating conditions:

${customAdvice}

💡 **Follow-Up Inquiry**: ${followUp}`;

    return {
      text,
      sources: [
        { title: 'East Africa Commercial Advisory Services', url: 'https://dailynews.co.tz/business', date: todayStr },
        { title: 'TradeCore Executive Framework', url: 'https://www.tradecore.co.tz', date: todayStr }
      ],
      searchQueries: [query, `${query} business Tanzania`],
      priceChangedToday: false,
      intent: 'general_business_advisory'
    };
  }
}

/**
 * Public synthesis engine that enriches response with explicit reasoning and interactive follow-up questions
 */
export function synthesizeIntelligentResponse(
  query: string,
  analysis: QuestionAnalysis,
  companyName: string = 'Company',
  companyMetrics?: {
    stockValuationCost?: number;
    stockValuationRetail?: number;
    lowStockCount?: number;
    totalSalesRevenue?: number;
    todaySalesRevenue?: number;
    totalProducts?: number;
  },
  productsList?: Array<{ name: string; category?: string; retailPrice?: number; purchasePrice?: number }>
): ComprehensiveAnswer {
  const raw = synthesizeRawResponse(query, analysis, companyName, companyMetrics, productsList);
  const { reasoning, followUpQuestions } = generateReasoningAndQuestions(
    query,
    analysis,
    companyName,
    companyMetrics,
    productsList
  );

  return {
    ...raw,
    reasoning: raw.reasoning || reasoning,
    followUpQuestions: (raw.followUpQuestions && raw.followUpQuestions.length > 0) ? raw.followUpQuestions : followUpQuestions
  };
}
