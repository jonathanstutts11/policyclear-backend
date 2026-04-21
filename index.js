const express = require('express');
const cors = require('cors');
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);

const app = express();
app.use(cors());
app.use(express.json({ limit: '50mb' }));

const SYSTEM = `You are helping a real person understand their homeowners or umbrella insurance policy. They are not an insurance professional. They just want to know what they're actually covered for, what could go wrong, and what the fine print means in plain terms.

Read the entire policy document carefully — the declarations page, definitions, perils, exclusions, conditions, and any endorsements. Everything you return must come directly from this document. Do not substitute generic insurance knowledge for actual policy content.

Your goal: translate this legal document into the clearest, most useful plain-English explanation possible. Write the way a trusted, knowledgeable friend would explain it — not the way an insurance company would write it.

Return ONLY valid JSON. No markdown, no backticks, no explanation outside the JSON.

{
  "policyHolder": "Full name as it appears on the policy, or Unknown",
  "policyNumber": "Policy number as shown, or Not found",
  "insurer": "Insurance company name exactly as written",
  "policyType": "Homeowners / Umbrella / Condo / Renters / Dwelling Fire — return the most accurate description based on what you read",
  "propertyAddress": "Full insured property address as shown on the declarations page, or null if not found",
  "propertyCity": "City name only from the insured property address — e.g. 'Redondo Beach' or 'Austin'. Return just the city name, no state, no zip, no street. Or null if not found.",
  "zipCode": "5-digit zip code from the insured address, or null",
  "squareFootage": "Living area square footage as shown in the document — return as a plain number e.g. 2100, or null if not found",
  "effectiveDate": "MM/DD/YYYY or Not found",
  "expirationDate": "MM/DD/YYYY or Not found",
  "premium": "Annual or monthly premium with period — e.g. $1,847/year",
  "deductible": "Primary deductible — e.g. $1,000",
  "dwellingCoverage": 400000,
  "finishLevel": "Return exactly one: 'Builder-grade (standard finishes)' OR 'Mid-range (upgraded finishes)' OR 'High-end (custom/luxury finishes)' OR 'Not specified in policy'",
  "coverageSummary": "Write 3-5 sentences directly to the policyholder using 'you' and 'your'. Be specific — use actual dollar amounts, coverage names, and notable features. Do not repeat the property address. Feel like a knowledgeable friend summarizing exactly what they have. No jargon without explanation.",
  "valuationMethod": {
    "type": "RCV OR ACV OR Mixed OR Unknown",
    "explanation": "Explain in plain English how this policy pays out on a claim. Give a concrete real-world example using actual numbers from this policy — e.g. what happens to a 10-year-old roof that gets destroyed."
  },
  "subLimits": [
    {
      "item": "Category with a cap — e.g. Jewelry, Electronics, Cash, Firearms, Fine Art, Business Property",
      "limit": "The exact dollar cap as written",
      "explanation": "Plain English: what does this mean? Be specific about the gap and what they should do about it."
    }
  ],
  "andClauses": [
    {
      "title": "Short plain-English title describing what this clause restricts",
      "explanation": "Explain the qualifying language and give a realistic scenario where someone thinks they're covered but isn't."
    }
  ],
  "endorsements": [
    {
      "name": "Endorsement name as written in the policy",
      "explanation": "Plain English: what does this add-on do? Who benefits and when does it apply?"
    }
  ],
  "scenarios": [
    {
      "title": "3 words max — e.g. 'House fire', 'Burst pipe', 'Flood damage'",
      "covered": true,
      "description": "Start with 'If...'. 1-3 short sentences. State whether covered or not, the limit, deductible, and any important catch. Use actual dollar amounts from this policy."
    }
  ],
  "keyExclusions": [
    {
      "title": "Short plain-English title",
      "description": "1-2 sentences. What is excluded and why it matters to this specific policyholder."
    }
  ],
  "actionItems": [
    "One sentence. One specific, practical thing based on what you found in this policy. Not generic — relevant to this person's situation."
  ]
}

CRITICAL RULES:

scenarios: This is the most important section of the report. Be exhaustive — produce every meaningful scenario you can identify from this policy, typically 16-22 total. Read through every peril, every exclusion, every condition, and every endorsement and turn each one into a plain-English scenario. Do not curate or shortlist — the policyholder deserves to know everything.

For each scenario description: write like a knowledgeable friend texting you what they found in your policy. Not formal. Not stiff. Conversational and direct. Use "you" and "your" throughout. Start with "If..." and get straight to the point. Use actual dollar amounts. Explain the real-world consequence in plain terms.

BAD example: "Water damage coverage requires the water release to be sudden and accidental. Gradual leaks or seepage over time would not be covered."
GOOD example: "If a pipe suddenly bursts and floods your kitchen, you're covered — USAA will pay to repair the damage after your $2,000 deductible. But if water has been slowly seeping through a wall for months, that's not covered. It has to be sudden."

BAD example: "If a covered peril causes your dwelling to become uninhabitable, loss of use coverage provides up to $108,600 for additional living expenses."
GOOD example: "If a fire or other covered disaster makes your home unlivable, USAA will pay your hotel bills, meals, and temporary housing for up to 12 months — up to $108,600 total. That's real money if you're displaced for a while."

Every scenario gets that same quality of explanation regardless of position in the list.

DEDUPLICATION: Every scenario title and exclusion title must be unique. Never list the same event twice with slightly different wording. Review all titles before returning and remove duplicates.

keyExclusions: 4-6 realistic exclusions relevant to this policyholder. Skip impossible events like nuclear hazard, war, government seizure unless directly relevant. Focus on gaps the policyholder might actually encounter or mistakenly assume are covered.

subLimits: Hunt carefully in personal property and scheduled items sections. Common ones: jewelry, watches, firearms, cash, securities, silverware, electronics, business property, watercraft, fine arts. Only include what you actually find.

andClauses: Look for qualifying language like 'sudden and accidental', 'residence premises', vacancy clauses, business use exclusions that narrow coverage in ways a layperson would miss. Only include what you actually find.

endorsements: Check final pages carefully. List every endorsement with a plain-English explanation.

actionItems: Maximum 3. Genuinely useful and specific to this policy.

dwellingCoverage: Plain number, no formatting — e.g. 400000. Null if not a property policy.

Language standard: Every field must be readable by someone with no insurance background. Short sentences. Active voice. Direct address.

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

    // Server-side dedup on scenarios and exclusions
    const dedup = arr => {
      if (!Array.isArray(arr)) return arr;
      const seen = new Set();
      return arr.filter(item => {
        const key = (item.title || item).toLowerCase().replace(/[^a-z]/g, '');
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      });
    };
    policy.scenarios = dedup(policy.scenarios);
    policy.keyExclusions = dedup(policy.keyExclusions);

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
    let costLow = 180, costMid = 250, costHigh = 380, regionName = 'your area';

    if (zip) {
      if (zip >= 90200 && zip <= 90299) { costLow=320; costMid=450; costHigh=650; regionName='Los Angeles area'; }
      else if (zip >= 90000 && zip <= 96999) { costLow=280; costMid=400; costHigh=580; regionName='California'; }
      else if (zip >= 92000 && zip <= 92999) { costLow=300; costMid=420; costHigh=600; regionName='San Diego area'; }
      else if (zip >= 10000 && zip <= 14999) { costLow=260; costMid=370; costHigh=520; regionName='New York'; }
      else if (zip >= 98000 && zip <= 99499) { costLow=240; costMid=340; costHigh=480; regionName='Washington State'; }
      else if (zip >= 97000 && zip <= 97999) { costLow=220; costMid=310; costHigh=440; regionName='Oregon'; }
      else if (zip >= 80000 && zip <= 81999) { costLow=200; costMid=285; costHigh=400; regionName='Colorado'; }
      else if (zip >= 33000 && zip <= 34999) { costLow=190; costMid=270; costHigh=380; regionName='Florida'; }
      else if (zip >= 60000 && zip <= 62999) { costLow=175; costMid=245; costHigh=345; regionName='Illinois'; }
      else if (zip >= 77000 && zip <= 79999) { costLow=165; costMid=230; costHigh=320; regionName='Texas'; }
      else if (zip >= 78000 && zip <= 78999) { costLow=165; costMid=230; costHigh=320; regionName='Texas'; }
      else if (zip >= 30000 && zip <= 31999) { costLow=160; costMid=225; costHigh=315; regionName='Georgia'; }
      else if (zip >= 85000 && zip <= 86999) { costLow=175; costMid=245; costHigh=345; regionName='Arizona'; }
      else if (zip >= 20000 && zip <= 20599) { costLow=250; costMid=350; costHigh=490; regionName='DC area'; }
      else if (zip >= 48000 && zip <= 49999) { costLow=160; costMid=225; costHigh=315; regionName='Michigan'; }
      else if (zip >= 55000 && zip <= 56999) { costLow=165; costMid=235; costHigh=330; regionName='Minnesota'; }
      else if (zip >= 19000 && zip <= 19999) { costLow=200; costMid=285; costHigh=400; regionName='Pennsylvania'; }
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
    let status = 'adequate';
    if (gap > 10000) status = 'gap';
    else if (gap > -10000) status = 'close';

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
