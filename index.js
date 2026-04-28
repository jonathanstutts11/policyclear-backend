const express = require('express');
const cors = require('cors');
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);

const app = express();
app.use(cors());
app.use(express.json({ limit: '50mb' }));

const SYSTEM = `You are helping a real person understand their homeowners or umbrella insurance policy. They are not an insurance professional. They just want to know what they're actually covered for, what could go wrong, and what the fine print means in plain terms.

Most U.S. homeowners policies are built on standardized ISO forms — typically HO-3 (Special Form) or HO-5 (Comprehensive Form). Use this knowledge to read the document efficiently. The Declarations Page is your starting point — it contains the "Big 5" coverages (Coverage A through E), the deductibles, the form type, and the effective dates. Read the full document including definitions, perils, exclusions, conditions, and all endorsements before returning your analysis.

Everything you return must come directly from this document. Do not substitute generic insurance knowledge for actual policy content.

Return ONLY valid JSON. No markdown, no backticks, no explanation outside the JSON.

{
  "policyHolder": "Full name as it appears on the policy, or Unknown",
  "policyNumber": "Policy number as shown, or Not found",
  "insurer": "Insurance company name exactly as written",
  "policyType": "Return plain English only — e.g. 'Homeowners', 'Umbrella', 'Condo', 'Renters'. Do not include ISO form numbers here.",
  "propertyAddress": "Full insured property address as shown on the declarations page, or null if not found",
  "propertyCity": "City name only from the insured property address — e.g. 'Redondo Beach' or 'Austin'. Return just the city name, no state, no zip, no street. Or null if not found.",
  "zipCode": "5-digit zip code from the insured address, or null",
  "squareFootage": "Living area square footage as shown in the document — return as a plain number e.g. 2100, or null if not found",
  "effectiveDate": "MM/DD/YYYY or Not found",
  "expirationDate": "MM/DD/YYYY or Not found",
  "premium": "Annual or monthly premium with period — e.g. $1,847/year",
  "deductible": "Primary all-perils deductible — e.g. $1,000. If multiple deductibles exist, list the primary one here and capture the others in andClauses.",
  "dwellingCoverage": 400000,
  "finishLevel": "Return exactly one: 'Builder-grade (standard finishes)' OR 'Mid-range (upgraded finishes)' OR 'High-end (custom/luxury finishes)' OR 'Not specified in policy'",
  "coverageSummary": "Write 3-5 sentences directly to the policyholder using 'you' and 'your'. Be specific and complete — include dwelling coverage and any endorsements that extend it (name the endorsement and the exact dollar amount it adds), personal property limit and valuation method, loss of use limit and duration, liability limit, deductible. Do NOT include Coverage A/B/C/D/E/F labels — just use plain English terms like 'dwelling', 'personal property', 'loss of use', 'liability'. If there are separate policies mentioned (earthquake, flood), call them out with their limits and deductibles. Name standout features. Read like a sharp complete briefing. Do not repeat the property address.",
  "valuationMethod": {
    "type": "RCV OR ACV OR Mixed OR Unknown",
    "explanation": "Explain in plain English how this policy pays out on a claim — for both dwelling and personal property if they differ. Give a concrete real-world example using actual numbers from this policy."
  },
  "subLimits": [
    {
      "item": "Category with a cap — e.g. Jewelry, Electronics, Cash, Firearms, Fine Art, Business Property",
      "limit": "The exact dollar cap as written",
      "explanation": "Plain English: what does this mean in practice? Be specific about the gap."
    }
  ],
  "andClauses": [
    {
      "title": "Short plain-English title describing what this clause restricts",
      "explanation": "Explain the qualifying language and give a realistic scenario where someone thinks they're covered but isn't. Include any percentage-based deductibles here (e.g. separate wind, hail, or hurricane deductibles) with the dollar amount they would represent on this specific dwelling value."
    }
  ],
  "endorsements": [
    {
      "name": "Endorsement name and form number as written",
      "explanation": "Plain English: what does this add-on do? Who benefits and when does it apply?"
    }
  ],
  "scenarios": [
    {
      "title": "3 words max — e.g. 'House fire', 'Burst pipe', 'Flood damage'",
      "covered": true,
      "description": "Start with 'If...'. 1-3 short sentences. State whether covered or not, the specific dollar limit that applies, the deductible, and any key condition."
    }
  ],
  "keyExclusions": [
    {
      "title": "Short plain-English title",
      "description": "1-2 sentences. What is excluded and why it matters to this specific policyholder."
    }
  ],
  "keyFindings": [
    {
      "type": "warning OR positive",
      "title": "3-6 words — the finding itself in plain English",
      "insight": "One sentence. The consequence in plain English — what this means for the policyholder's wallet or protection. Use actual dollar amounts. Never use acronyms without explaining them."
    }
  ],
  "actionItems": [
    "One sentence. One specific, practical thing based on what you found in this policy."
  ]
}

POLICY TYPE GUIDANCE:

Homeowners (HO-3, HO-5): Full analysis — all sections apply. This is the richest policy type.

Landlord / Dwelling Fire (DP-1, DP-2, DP-3): Full analysis applies. Note that loss of use is replaced by loss of rents. Scenarios should reflect landlord risks — tenant damage, loss of rental income, liability for tenant injuries. Personal property coverage may be limited or absent.

Condo (HO-6): Full analysis applies. Pay special attention to the distinction between unit coverage and what the HOA master policy covers. Flag gaps between the two in keyFindings if identifiable.

Umbrella: These are intentionally simple excess liability documents. The analysis will be shorter by design — there is no property coverage, no dwelling, no personal property. Focus entirely on the liability limit, what underlying policies are required, any exclusions, and any gaps. In the coverageSummary, note clearly that umbrella policies provide excess liability coverage above the user's underlying home and auto policies, and that this analysis is most useful when read alongside those underlying policies. Do not generate rebuild check data. Scenarios should focus exclusively on liability events.

Renters (HO-4): Full analysis applies. There is no dwelling coverage since the tenant doesn't own the building — do not generate rebuild check data. Focus on personal property coverage and valuation method (RCV vs ACV is especially important for renters), liability limits, loss of use, and all sub-limits. Key scenarios should reflect renter-specific risks: theft, fire damage to belongings, guest injuries, dog bite liability, temporary housing if unit becomes uninhabitable. Sub-limits on jewelry, electronics, and cash are especially relevant. Flag if liability coverage seems low for someone renting.

READING STRATEGY: Start with the Declarations Page. Identify the ISO form type (HO-3, HO-5, etc.), Coverage A through F amounts, all deductibles including percentage-based ones, and the policy period. Then read the perils, exclusions, conditions, and endorsements sections in full. Check the back pages for endorsements — they often override or expand the main policy text.

keyFindings: Generate 2-4 findings maximum — the most important things that will affect this policyholder's finances or protection. Prioritize surprising, alarming, or notably strong findings specific to this policy.

Strong candidates:
- Valuation method: always include this. RCV is a positive finding. ACV on dwelling or personal property is a warning — explain that depreciation means they won't get enough to replace what they lose.
- Loss of use adequacy: Coverage D should be at least 20-30% of Coverage A. Flag if it falls short.
- Percentage-based deductibles: if there is a separate wind, hail, or hurricane deductible expressed as a percentage, calculate the dollar amount it represents and flag it — most people don't realize a "2% deductible" on a $543,000 home means $10,860 out of pocket.
- Missing flood or earthquake coverage in high-risk zip codes (California = earthquake risk, coastal = flood risk).
- Extended replacement cost endorsement: positive finding if present, warning if absent in California or coastal areas.
- Significant sub-limits that represent a meaningful gap.
- HO-5 form: positive finding — broader open-perils coverage on personal property.

Never use acronyms without explaining them in the same sentence. type must be exactly "warning" or "positive".

scenarios: Be exhaustive — 16-22 total. Cover every meaningful peril, exclusion, condition, and endorsement. Do not curate. Never say "up to your policy limits" — always state the actual dollar amount. If an endorsement applies to a scenario (like Water Backup, Mold coverage, Ordinance & Law), you MUST state the specific sub-limit from that endorsement — not the main dwelling limit. For example if Water Backup coverage has a $10,000 limit, the sewer backup scenario must say "covered up to $10,000" not "covered up to $543,000." Always state the deductible. If a scenario has a sub-limit that is significantly lower than the main dwelling limit, make that gap clear — that is critical information for the policyholder.

IMPORTANT: Every endorsement found in the policy must generate at least one scenario. If the policy has a Water Backup endorsement, there must be a sewer/drain backup scenario. If it has a Wildfire Response endorsement, include a wildfire scenario. If it has Workers Compensation, include a household employee injury scenario. Endorsements represent coverage the policyholder specifically paid for — they must appear in the scenarios.

BAD: "Water damage coverage requires the water release to be sudden and accidental."
GOOD: "If a pipe suddenly bursts, the damage is covered after your $2,000 deductible. Slow leaks or gradual seepage are not — it has to be sudden and accidental."

BAD: "Sewer backup is covered under your policy."
GOOD: "If sewage backs up into your home, the Water Backup endorsement covers cleanup and repairs up to $10,000 after your $2,000 deductible — not your full dwelling limit."

BAD: "Loss of use coverage provides additional living expenses."
GOOD: "If a fire makes your home unlivable, USAA covers hotel and temporary housing up to $108,600 for up to 12 months."

DEDUPLICATION: Every scenario title and exclusion title must be unique. Never list the same event twice with slightly different wording.

keyExclusions: 4-6 realistic exclusions relevant to this policyholder. Skip impossible events like nuclear hazard, war, government seizure unless directly relevant.

subLimits: Hunt carefully through every section of the policy — personal property, special limits of liability, scheduled property, endorsements. Do not stop at the obvious ones. Common sub-limits to look for: jewelry/watches/furs, firearms, cash/coins/bank notes, securities/checks/negotiable instruments, silverware/goldware, business property, computers/electronics, fine arts, collectibles/memorabilia, watercraft, trailers, musical instruments, grave markers, credit cards. Return every sub-limit you find with its exact dollar cap and a plain-English explanation of the gap it creates. Only include what you actually find in this document.

andClauses: Include percentage-based deductibles (wind, hail, hurricane) with their calculated dollar amounts. Also look for qualifying language like 'sudden and accidental', 'residence premises' restrictions, vacancy clauses, business use exclusions, and sharing economy restrictions.

endorsements: Check all pages carefully — endorsements are often at the back and override the main policy text. List every endorsement with form number and plain-English explanation.

actionItems: Maximum 3. Specific to this policy. Not generic advice.

dwellingCoverage: Plain number, no formatting — e.g. 400000. Null if not a property policy.

Language standard: Write like a smart friend who knows insurance deeply but explains it in plain terms. Helpful and knowledgeable. Reassuring without being wordy or fluffy. Never condescending, never stiff, never corporate. Always use the actual numbers, limits, and conditions from this policy. If you can say it in two sentences, do not use three.

NEVER use sensationalized or alarmist language. Do not say things like "financially devastate you," "catastrophic," "devastating," "could ruin you," or similar dramatic phrases. State the facts and let the numbers speak for themselves. BAD: "this could financially devastate you." GOOD: just state the dollar amount and move on.

If a section has nothing — return an empty array. Never invent content.`;


app.post('/analyze', async (req, res) => {
  try {
    const { pdfBase64 } = req.body;
    if (!pdfBase64) return res.status(400).json({ error: 'No PDF provided' });

    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': process.env.ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01',
        'anthropic-beta': 'prompt-caching-2024-07-31'
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 6000,
        system: [{ type: 'text', text: SYSTEM, cache_control: { type: 'ephemeral' } }],
        messages: [{
          role: 'user',
          content: [
            { type: 'document', source: { type: 'base64', media_type: 'application/pdf', data: pdfBase64 } },
            { type: 'text', text: 'Read this insurance policy carefully from beginning to end. Extract everything the policyholder needs. Deduplicate all scenario and exclusion titles. Return ONLY the JSON object.' }
          ]
        }]
      })
    });

    if (!response.ok) {
      const err = await response.json().catch(() => ({}));
      return res.status(response.status).json({ error: err.error?.message || 'API error' });
    }

    const data = await response.json();
    const raw = (data.content?.[0]?.text || '').replace(/```json|```/g, '').trim();
    const policy = JSON.parse(raw);

    // Server-side dedup — catches near-duplicates by comparing first significant word
    const dedup = arr => {
      if (!Array.isArray(arr)) return arr;
      const seen = new Set();
      const seenFirst = new Set();
      return arr.filter(item => {
        const title = (item.title || item).toLowerCase().replace(/[^a-z\s]/g, '').trim();
        const words = title.split(/\s+/).filter(w => w.length > 2);
        if (!words.length) return true;
        const fullKey = words.join('');
        if (seen.has(fullKey)) return false;
        // Block on first word for common ambiguous terms — check BEFORE adding fullKey
        const blockOnFirst = ['nuclear','earthquake','flood','maintenance','business','war','mold','water','fire','swimming','pool','earth','gradual'];
        const firstWord = words[0];
        if (blockOnFirst.includes(firstWord)) {
          if (seenFirst.has(firstWord)) return false;
          seenFirst.add(firstWord);
        }
        seen.add(fullKey);
        return true;
      });
    };
    policy.scenarios = dedup(policy.scenarios);
    policy.keyExclusions = dedup(policy.keyExclusions);
    if (!Array.isArray(policy.keyFindings)) policy.keyFindings = [];

    res.json(policy);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

app.post('/rebuild', async (req, res) => {
  try {
    const { homeValue, dwellingCoverage, zipCode, finishLevel, squareFootage, propertyCity } = req.body;
    if (!homeValue || !dwellingCoverage) return res.status(400).json({ error: 'Missing required fields' });

    const zip = zipCode ? parseInt(zipCode) : null;
    let costLow = 175, costMid = 240, costHigh = 360, regionName = 'your area';

    if (zip) {
      // California — metro specific
      if (zip >= 90200 && zip <= 90899) { costLow=320; costMid=450; costHigh=650; regionName='Los Angeles area'; }
      else if (zip >= 91000 && zip <= 91999) { costLow=300; costMid=430; costHigh=620; regionName='Los Angeles area'; }
      else if (zip >= 90000 && zip <= 90199) { costLow=300; costMid=430; costHigh=620; regionName='Los Angeles area'; }
      else if (zip >= 94100 && zip <= 94199) { costLow=380; costMid=520; costHigh=750; regionName='San Francisco'; }
      else if (zip >= 94000 && zip <= 94999) { costLow=340; costMid=480; costHigh=700; regionName='Bay Area'; }
      else if (zip >= 95000 && zip <= 95999) { costLow=280; costMid=390; costHigh=560; regionName='Sacramento area'; }
      else if (zip >= 92000 && zip <= 92999) { costLow=300; costMid=420; costHigh=600; regionName='San Diego area'; }
      else if (zip >= 93000 && zip <= 93999) { costLow=260; costMid=360; costHigh=520; regionName='Central California'; }
      else if (zip >= 96000 && zip <= 96999) { costLow=240; costMid=330; costHigh=480; regionName='Northern California'; }
      // Pacific Northwest
      else if (zip >= 98000 && zip <= 98199) { costLow=260; costMid=360; costHigh=520; regionName='Seattle area'; }
      else if (zip >= 98200 && zip <= 99499) { costLow=220; costMid=310; costHigh=440; regionName='Washington State'; }
      else if (zip >= 97000 && zip <= 97299) { costLow=240; costMid=330; costHigh=480; regionName='Portland area'; }
      else if (zip >= 97300 && zip <= 97999) { costLow=200; costMid=285; costHigh=410; regionName='Oregon'; }
      // Mountain West
      else if (zip >= 80000 && zip <= 80299) { costLow=220; costMid=310; costHigh=440; regionName='Denver area'; }
      else if (zip >= 80300 && zip <= 81999) { costLow=195; costMid=275; costHigh=390; regionName='Colorado'; }
      else if (zip >= 89100 && zip <= 89199) { costLow=185; costMid=265; costHigh=380; regionName='Las Vegas area'; }
      else if (zip >= 89000 && zip <= 89999) { costLow=175; costMid=250; costHigh=360; regionName='Nevada'; }
      else if (zip >= 85000 && zip <= 85399) { costLow=185; costMid=265; costHigh=380; regionName='Phoenix area'; }
      else if (zip >= 85400 && zip <= 86999) { costLow=170; costMid=240; costHigh=345; regionName='Arizona'; }
      else if (zip >= 84000 && zip <= 84999) { costLow=185; costMid=260; costHigh=375; regionName='Utah'; }
      else if (zip >= 83000 && zip <= 83999) { costLow=175; costMid=245; costHigh=355; regionName='Idaho'; }
      else if (zip >= 59000 && zip <= 59999) { costLow=165; costMid=230; costHigh=330; regionName='Montana'; }
      else if (zip >= 82000 && zip <= 82999) { costLow=160; costMid=225; costHigh=325; regionName='Wyoming'; }
      else if (zip >= 87000 && zip <= 87999) { costLow=165; costMid=235; costHigh=335; regionName='New Mexico'; }
      // Texas
      else if (zip >= 77000 && zip <= 77099) { costLow=175; costMid=245; costHigh=350; regionName='Houston area'; }
      else if (zip >= 75200 && zip <= 75299) { costLow=170; costMid=240; costHigh=345; regionName='Dallas area'; }
      else if (zip >= 75000 && zip <= 76999) { costLow=165; costMid=235; costHigh=335; regionName='North Texas'; }
      else if (zip >= 78200 && zip <= 78299) { costLow=165; costMid=235; costHigh=335; regionName='San Antonio area'; }
      else if (zip >= 73300 && zip <= 73399) { costLow=165; costMid=235; costHigh=335; regionName='Austin area'; }
      else if (zip >= 77100 && zip <= 79999) { costLow=160; costMid=225; costHigh=320; regionName='Texas'; }
      else if (zip >= 73000 && zip <= 74999) { costLow=155; costMid=215; costHigh=310; regionName='Oklahoma'; }
      // Southeast
      else if (zip >= 30300 && zip <= 30399) { costLow=180; costMid=255; costHigh=365; regionName='Atlanta area'; }
      else if (zip >= 30000 && zip <= 31999) { costLow=165; costMid=230; costHigh=330; regionName='Georgia'; }
      else if (zip >= 33100 && zip <= 33199) { costLow=200; costMid=280; costHigh=400; regionName='Miami area'; }
      else if (zip >= 32800 && zip <= 32899) { costLow=185; costMid=260; costHigh=375; regionName='Orlando area'; }
      else if (zip >= 33000 && zip <= 34999) { costLow=185; costMid=260; costHigh=375; regionName='Florida'; }
      else if (zip >= 36000 && zip <= 36999) { costLow=155; costMid=215; costHigh=310; regionName='Alabama'; }
      else if (zip >= 38600 && zip <= 38699) { costLow=155; costMid=215; costHigh=310; regionName='Mississippi'; }
      else if (zip >= 38000 && zip <= 38599) { costLow=160; costMid=220; costHigh=315; regionName='Tennessee'; }
      else if (zip >= 37000 && zip <= 37999) { costLow=165; costMid=230; costHigh=330; regionName='Tennessee'; }
      else if (zip >= 40000 && zip <= 42999) { costLow=160; costMid=225; costHigh=320; regionName='Kentucky'; }
      else if (zip >= 25000 && zip <= 26999) { costLow=155; costMid=215; costHigh=310; regionName='West Virginia'; }
      else if (zip >= 29000 && zip <= 29999) { costLow=160; costMid=225; costHigh=320; regionName='South Carolina'; }
      else if (zip >= 27000 && zip <= 28999) { costLow=165; costMid=235; costHigh=335; regionName='North Carolina'; }
      else if (zip >= 23000 && zip <= 24999) { costLow=170; costMid=240; costHigh=345; regionName='Virginia'; }
      else if (zip >= 70000 && zip <= 71499) { costLow=165; costMid=230; costHigh=330; regionName='Louisiana'; }
      else if (zip >= 71500 && zip <= 72999) { costLow=155; costMid=215; costHigh=310; regionName='Arkansas'; }
      // Mid-Atlantic & Northeast
      else if (zip >= 20000 && zip <= 20599) { costLow=260; costMid=365; costHigh=520; regionName='DC area'; }
      else if (zip >= 20600 && zip <= 21999) { costLow=220; costMid=310; costHigh=445; regionName='Maryland'; }
      else if (zip >= 19000 && zip <= 19999) { costLow=210; costMid=295; costHigh=425; regionName='Pennsylvania'; }
      else if (zip >= 15000 && zip <= 18999) { costLow=185; costMid=260; costHigh=375; regionName='Pennsylvania'; }
      else if (zip >= 10000 && zip <= 10299) { costLow=350; costMid=490; costHigh=700; regionName='New York City'; }
      else if (zip >= 10300 && zip <= 11999) { costLow=280; costMid=390; costHigh=560; regionName='New York metro'; }
      else if (zip >= 12000 && zip <= 14999) { costLow=210; costMid=295; costHigh=425; regionName='Upstate New York'; }
      else if (zip >= 6000 && zip <= 6999) { costLow=230; costMid=320; costHigh=460; regionName='Connecticut'; }
      else if (zip >= 2000 && zip <= 2999) { costLow=280; costMid=390; costHigh=560; regionName='Boston area'; }
      else if (zip >= 1000 && zip <= 1999) { costLow=230; costMid=325; costHigh=465; regionName='Massachusetts'; }
      else if (zip >= 7000 && zip <= 8999) { costLow=240; costMid=335; costHigh=480; regionName='New Jersey'; }
      else if (zip >= 17000 && zip <= 17999) { costLow=185; costMid=260; costHigh=375; regionName='Pennsylvania'; }
      // Midwest
      else if (zip >= 60600 && zip <= 60699) { costLow=200; costMid=280; costHigh=400; regionName='Chicago area'; }
      else if (zip >= 60000 && zip <= 62999) { costLow=175; costMid=245; costHigh=350; regionName='Illinois'; }
      else if (zip >= 43000 && zip <= 45999) { costLow=165; costMid=235; costHigh=335; regionName='Ohio'; }
      else if (zip >= 46000 && zip <= 47999) { costLow=165; costMid=230; costHigh=330; regionName='Indiana'; }
      else if (zip >= 48000 && zip <= 49999) { costLow=165; costMid=235; costHigh=335; regionName='Michigan'; }
      else if (zip >= 55000 && zip <= 56999) { costLow=175; costMid=245; costHigh=350; regionName='Minnesota'; }
      else if (zip >= 53000 && zip <= 54999) { costLow=170; costMid=240; costHigh=345; regionName='Wisconsin'; }
      else if (zip >= 50000 && zip <= 52999) { costLow=155; costMid=220; costHigh=315; regionName='Iowa'; }
      else if (zip >= 63000 && zip <= 65999) { costLow=160; costMid=225; costHigh=320; regionName='Missouri'; }
      else if (zip >= 57000 && zip <= 57999) { costLow=155; costMid=215; costHigh=310; regionName='South Dakota'; }
      else if (zip >= 58000 && zip <= 58999) { costLow=155; costMid=215; costHigh=310; regionName='North Dakota'; }
      else if (zip >= 68000 && zip <= 69999) { costLow=155; costMid=215; costHigh=310; regionName='Nebraska'; }
      else if (zip >= 66000 && zip <= 67999) { costLow=155; costMid=215; costHigh=310; regionName='Kansas'; }
      // Hawaii & Alaska
      else if (zip >= 96700 && zip <= 96899) { costLow=380; costMid=520; costHigh=750; regionName='Hawaii'; }
      else if (zip >= 99500 && zip <= 99999) { costLow=320; costMid=450; costHigh=650; regionName='Alaska'; }
      // Remaining New England
      else if (zip >= 3000 && zip <= 3999) { costLow=210; costMid=295; costHigh=425; regionName='New Hampshire'; }
      else if (zip >= 4000 && zip <= 4999) { costLow=200; costMid=280; costHigh=400; regionName='Maine'; }
      else if (zip >= 5000 && zip <= 5999) { costLow=210; costMid=295; costHigh=425; regionName='Vermont'; }
      else if (zip >= 2800 && zip <= 2999) { costLow=230; costMid=320; costHigh=460; regionName='Rhode Island'; }
      else if (zip >= 19700 && zip <= 19999) { costLow=200; costMid=280; costHigh=400; regionName='Delaware'; }
    }

    let finishMultiplier = 1.0, finishLabel = 'standard';
    if (finishLevel?.includes('Mid-range')) { finishMultiplier = 1.15; finishLabel = 'mid-range'; }
    if (finishLevel?.includes('High-end')) { finishMultiplier = 1.40; finishLabel = 'high-end'; }

    const coverage = parseInt(dwellingCoverage);
    const sqft = squareFootage ? parseInt(squareFootage) : null;
    let estimatedRebuild, estimatedRebuildLow, estimatedRebuildHigh, usedSqft = false;

    if (sqft && sqft > 200 && sqft < 20000) {
      estimatedRebuildLow = Math.round(sqft * costLow * finishMultiplier);
      estimatedRebuildHigh = Math.round(sqft * costHigh * finishMultiplier);
      estimatedRebuild = Math.round(sqft * costMid * finishMultiplier);
      usedSqft = true;
    } else {
      const hv = parseInt(homeValue);
      let rebuildRatio = 0.70;
      if (zip) {
        if (zip >= 90200 && zip <= 90299) rebuildRatio = 0.88;
        else if (zip >= 90000 && zip <= 96999) rebuildRatio = 0.85;
        else if (zip >= 92000 && zip <= 92999) rebuildRatio = 0.86;
        else if (zip >= 10000 && zip <= 14999) rebuildRatio = 0.80;
        else if (zip >= 98000 && zip <= 99499) rebuildRatio = 0.82;
        else if (zip >= 97000 && zip <= 97999) rebuildRatio = 0.78;
        else if (zip >= 80000 && zip <= 81999) rebuildRatio = 0.75;
        else if (zip >= 33000 && zip <= 34999) rebuildRatio = 0.72;
        else if (zip >= 60000 && zip <= 62999) rebuildRatio = 0.68;
        else if (zip >= 77000 && zip <= 79999) rebuildRatio = 0.65;
        else if (zip >= 30000 && zip <= 31999) rebuildRatio = 0.65;
        else if (zip >= 85000 && zip <= 86999) rebuildRatio = 0.70;
        else if (zip >= 20000 && zip <= 20599) rebuildRatio = 0.82;
        else if (zip >= 48000 && zip <= 49999) rebuildRatio = 0.65;
        else if (zip >= 55000 && zip <= 56999) rebuildRatio = 0.67;
        else if (zip >= 19000 && zip <= 19999) rebuildRatio = 0.75;
      }
      estimatedRebuild = Math.round(hv * rebuildRatio * finishMultiplier);
      estimatedRebuildLow = Math.round(estimatedRebuild * 0.85);
      estimatedRebuildHigh = Math.round(estimatedRebuild * 1.15);
    }

    const gap = estimatedRebuild - coverage;
    const gapPct = gap / estimatedRebuild;
    let status = 'adequate';
    if (gapPct > 0.05) status = 'gap';           // more than 5% short = gap
    else if (gapPct > -0.05) status = 'close';   // within 5% either way = close
    // otherwise adequate (covered by more than 5%)

    res.json({
      status,
      regionName: propertyCity || regionName,
      estimatedRebuild,
      estimatedRebuildLow: Math.round(estimatedRebuildLow / 5000) * 5000,
      estimatedRebuildHigh: Math.round(estimatedRebuildHigh / 5000) * 5000,
      coverage, finishLevel: finishLevel || 'Not specified', finishLabel,
      sqft: usedSqft ? sqft : null,
      costLow, costMid, costHigh,
      lowGap: gap > 0 ? Math.round(gap * 0.85 / 5000) * 5000 : 0,
      highGap: gap > 0 ? Math.round(gap * 1.15 / 5000) * 5000 : 0
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/create-payment-intent', async (req, res) => {
  try {
    const { amount } = req.body;
    const paymentIntent = await stripe.paymentIntents.create({
      amount: amount || 1500,
      currency: 'usd',
      description: 'CoveredIf Policy Analysis',
      payment_method_types: ['card']
    });
    res.json({ clientSecret: paymentIntent.client_secret });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/health', (req, res) => res.json({ status: 'ok' }));

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`CoveredIf backend running on port ${PORT}`));
