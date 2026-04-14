const express = require('express');
const cors = require('cors');

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
  "zipCode": "5-digit zip code from the insured address, or null",
  "effectiveDate": "MM/DD/YYYY or Not found",
  "expirationDate": "MM/DD/YYYY or Not found",
  "premium": "Annual or monthly premium with period — e.g. $1,847/year",
  "deductible": "Primary deductible — e.g. $1,000. If multiple deductibles exist, list the main one.",
  "dwellingCoverage": 400000,
  "finishLevel": "Read the policy for replacement cost language. Return exactly one: 'Builder-grade (standard finishes)' OR 'Mid-range (upgraded finishes)' OR 'High-end (custom/luxury finishes)' OR 'Not specified in policy'",
  "coverageSummary": "Write 3-5 sentences directly to the policyholder — use 'you' and 'your' throughout. Be specific: use the actual dollar amounts, coverage names, and any notable features you found. Name the key coverages and their limits. Do not repeat the property address here — it is shown separately. This should feel like a knowledgeable friend telling them exactly what they have. Do not use insurance jargon without explaining it.",
  "valuationMethod": {
    "type": "RCV OR ACV OR Mixed OR Unknown",
    "explanation": "Explain in plain English how this policy pays out on a claim. Does it pay what it costs to replace the item new (RCV), or what the item is worth used today (ACV)? Find the specific language in the document and explain what it means in practice. Give a concrete real-world example using actual numbers and conditions from this policy — e.g. what would happen to a 10-year-old roof that gets destroyed."
  },
  "subLimits": [
    {
      "item": "Category or item that has a cap — e.g. Jewelry, Electronics, Cash, Firearms, Fine Art, Business Property, Watercraft",
      "limit": "The exact dollar cap as written in the policy",
      "explanation": "Plain English: what does this mean for the policyholder? If they own $8,000 worth of jewelry but the sub-limit is $1,500, tell them that clearly. Be specific about the gap and what they should do about it."
    }
  ],
  "andClauses": [
    {
      "title": "Short plain-English title describing what this clause restricts",
      "explanation": "Find exclusion or condition language in this policy that uses qualifying words like 'and', 'but', 'provided that', 'unless', 'except when' in a way that narrows or eliminates coverage. Explain what the clause says and give a realistic scenario where someone might think they're covered but aren't because of this exact language."
    }
  ],
  "endorsements": [
    {
      "name": "Name of the endorsement or rider as written in the policy",
      "explanation": "Plain English: what does this add-on actually do? How does it change or expand the standard policy? Be specific — who benefits from it and when does it apply?"
    }
  ],
  "scenarios": [
    {
      "title": "3 words max — plain noun phrase e.g. 'House fire', 'Burst pipe', 'Car theft'",
      "covered": true,
      "description": "Start with 'If...'. Write 1-3 short sentences in plain English. State clearly whether covered or not, what the limit is, what the deductible applies, and any important condition or catch. Reference actual dollar amounts and conditions from this policy. No jargon."
    }
  ],
  "keyExclusions": [
    {
      "title": "Short plain-English title — e.g. 'Flood damage', 'Earthquake', 'Home business equipment'",
      "description": "1-2 sentences. Be specific to this policy. Explain what is excluded and why it matters — especially if it's something a reasonable person might assume is covered. Make the consequence real and clear."
    }
  ],
  "actionItems": [
    "One sentence. One specific, practical thing this policyholder should know or consider based on what you actually found in their policy. Not generic advice — something directly relevant to their specific situation."
  ]
}

CRITICAL RULES:

scenarios: Include 6-9. Order from most likely to least likely to actually happen to this policyholder. For homeowners think: fire, theft, water damage from plumbing, liability if someone is injured, wind/storm, fallen tree, power outage, flood, earthquake. Include both covered AND not-covered scenarios mixed together — the covered field distinguishes them. Each description must start with 'If...' and reference actual limits from the document.

DEDUPLICATION — CRITICAL: Every scenario title and every exclusion title must be unique. Never list the same peril or event twice even with slightly different wording. Before finalizing your response, review all scenario titles and all exclusion titles and remove any duplicates. 'Flood damage' and 'Flood' are duplicates — keep only one. 'Earthquake' and 'Earthquake damage' are duplicates — keep only one.

keyExclusions: Include 4-6. Only exclusions that are realistic and relevant to this policyholder's actual situation. DO NOT include exclusions for events that are essentially impossible in normal life — such as nuclear hazard, war, government seizure, or ordinance of law unless it is directly relevant to something found in this specific policy. Focus on exclusions the policyholder might genuinely encounter or mistakenly assume are covered — flood, earthquake, sewer backup, home business, short-term rental, vacant property, intentional acts, and similar real-world gaps.

subLimits: Hunt carefully in the personal property, scheduled items, and special limits sections. Common sub-limits include: jewelry and watches, firearms, cash and bank notes, securities, silverware, electronics, business property, watercraft, trailers, and fine arts. If you find them, list them. Only include what you actually find in the document.

andClauses: Look specifically for exclusion or condition language that uses qualifying words that narrow coverage in ways a layperson would miss. These are the traps. Common ones: 'sudden and accidental' (excludes gradual damage), 'residence premises' restrictions, vacancy clauses, business use exclusions. Only include what you actually find.

endorsements: Check the final pages of the policy carefully. List every endorsement or rider with a plain-English explanation of what it adds or changes.

actionItems: Maximum 3. Only include genuinely useful, policy-specific insights. These should feel like advice from a friend who just read the whole policy — specific, practical, and relevant to THIS person's situation.

dwellingCoverage: Return as a plain number with no formatting — e.g. 400000. Return null if not a property policy.

Language standard: Every field must be written so that a person with no insurance background can read it and immediately understand what it means for them. Short sentences. Active voice. Direct address.

If a section genuinely has nothing — no endorsements found, no sub-limits found — return an empty array. Never invent content.`;

app.post('/analyze', async (req, res) => {
  try {
    const { pdfBase64 } = req.body;
    if (!pdfBase64) return res.status(400).json({ error: 'No PDF provided' });

    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': process.env.ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 4000,
        system: SYSTEM,
        messages: [{
          role: 'user',
          content: [
            {
              type: 'document',
              source: { type: 'base64', media_type: 'application/pdf', data: pdfBase64 }
            },
            {
              type: 'text',
              text: 'Read this insurance policy carefully from beginning to end. Extract everything the policyholder needs to understand their coverage. Remember: deduplicate all scenario titles and exclusion titles before returning. Return ONLY the JSON object — nothing else.'
            }
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

    // Frontend safety net: deduplicate scenarios and exclusions by normalized title
    const dedup = (arr) => {
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
    const { homeValue, dwellingCoverage, zipCode, finishLevel } = req.body;
    if (!homeValue || !dwellingCoverage) return res.status(400).json({ error: 'Missing required fields' });

    const zip = zipCode ? parseInt(zipCode) : null;
    let rebuildRatio = 0.70;
    let regionName = 'your area';

    if (zip) {
      if (zip >= 90200 && zip <= 90299) { rebuildRatio = 0.88; regionName = 'Los Angeles area'; }
      else if (zip >= 90000 && zip <= 96999) { rebuildRatio = 0.85; regionName = 'California'; }
      else if (zip >= 92000 && zip <= 92999) { rebuildRatio = 0.86; regionName = 'San Diego area'; }
      else if (zip >= 10000 && zip <= 14999) { rebuildRatio = 0.80; regionName = 'New York'; }
      else if (zip >= 98000 && zip <= 99499) { rebuildRatio = 0.82; regionName = 'Washington State'; }
      else if (zip >= 97000 && zip <= 97999) { rebuildRatio = 0.78; regionName = 'Oregon'; }
      else if (zip >= 80000 && zip <= 81999) { rebuildRatio = 0.75; regionName = 'Colorado'; }
      else if (zip >= 33000 && zip <= 34999) { rebuildRatio = 0.72; regionName = 'Florida'; }
      else if (zip >= 60000 && zip <= 62999) { rebuildRatio = 0.68; regionName = 'Illinois'; }
      else if (zip >= 77000 && zip <= 79999) { rebuildRatio = 0.65; regionName = 'Texas'; }
      else if (zip >= 78000 && zip <= 78999) { rebuildRatio = 0.65; regionName = 'Texas'; }
      else if (zip >= 30000 && zip <= 31999) { rebuildRatio = 0.65; regionName = 'Georgia'; }
      else if (zip >= 85000 && zip <= 86999) { rebuildRatio = 0.70; regionName = 'Arizona'; }
      else if (zip >= 20000 && zip <= 20599) { rebuildRatio = 0.82; regionName = 'DC area'; }
      else if (zip >= 48000 && zip <= 49999) { rebuildRatio = 0.65; regionName = 'Michigan'; }
      else if (zip >= 55000 && zip <= 56999) { rebuildRatio = 0.67; regionName = 'Minnesota'; }
      else if (zip >= 19000 && zip <= 19999) { rebuildRatio = 0.75; regionName = 'Pennsylvania'; }
    }

    let finishMultiplier = 1.0;
    if (finishLevel?.includes('Mid-range')) finishMultiplier = 1.15;
    if (finishLevel?.includes('High-end')) finishMultiplier = 1.40;

    const hv = parseInt(homeValue);
    const estimatedRebuild = Math.round(hv * rebuildRatio * finishMultiplier);
    const coverage = parseInt(dwellingCoverage);
    const gap = estimatedRebuild - coverage;

    let status = 'adequate';
    if (gap > 10000) status = 'gap';
    else if (gap > -10000) status = 'close';

    res.json({
      status, regionName, estimatedRebuild, coverage,
      finishLevel: finishLevel || 'Not specified',
      lowGap: gap > 0 ? Math.round(gap * 0.85 / 5000) * 5000 : 0,
      highGap: gap > 0 ? Math.round(gap * 1.15 / 5000) * 5000 : 0
    });

  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/health', (req, res) => res.json({ status: 'ok' }));

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`CoveredIf backend running on port ${PORT}`));
