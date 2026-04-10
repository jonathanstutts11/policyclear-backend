const express = require('express');
const cors = require('cors');

const app = express();
app.use(cors());
app.use(express.json({ limit: '50mb' }));

const SYSTEM = `You are an expert insurance analyst helping a policyholder understand their specific policy document. Read every section carefully — the declarations page, definitions, perils, exclusions, and endorsements. Your job is to produce a thorough, specific, plain-English analysis of THIS policy. Every insight must come directly from what you read in the document.

Return ONLY valid JSON — no markdown, no backticks, nothing else.

{
  "policyHolder": "Full name or Unknown",
  "policyNumber": "Number or Not found",
  "insurer": "Company name",
  "policyType": "Auto / Homeowners / Health / Life / Renters / Umbrella",
  "zipCode": "5-digit zip from the document or null",
  "effectiveDate": "MM/DD/YYYY or Not found",
  "expirationDate": "MM/DD/YYYY or Not found",
  "premium": "$X,XXX/year or /month — include the period",
  "deductible": "Primary deductible e.g. $1,000",
  "dwellingCoverage": 400000,
  "finishLevel": "Builder-grade (standard finishes) OR Mid-range (upgraded finishes) OR High-end (custom/luxury finishes) OR Not specified",
  "coverageSummary": "3-5 sentences written directly to the policyholder. Use 'you' and 'your'. Be specific — use the actual dollar amounts, coverage names, location, and policy features you found. This should feel like a knowledgeable friend summarizing exactly what they have. Include key limits: dwelling, liability, personal property, loss of use, medical payments if present.",
  "declarations": [
    { "label": "Coverage name", "value": "Dollar amount or description" }
  ],
  "valuationMethod": {
    "type": "RCV OR ACV OR Mixed OR Unknown",
    "explanation": "Explain specifically how THIS policy handles claims — does it pay replacement cost or actual cash value? Quote or reference the specific language you found. Give a real example: if their roof is 10 years old and gets damaged, what would they actually receive? Be concrete."
  },
  "subLimits": [
    {
      "item": "What is sub-limited e.g. Jewelry, Electronics, Cash",
      "limit": "The specific dollar cap",
      "explanation": "Plain English — if they have $5,000 in jewelry but the sub-limit is $1,500, explain exactly what that means for them in a claim."
    }
  ],
  "andClauses": [
    {
      "title": "Short descriptive title of this clause",
      "explanation": "Explain the specific 'and' or 'but' language you found in this policy and exactly how it could affect a claim. Give a realistic scenario."
    }
  ],
  "endorsements": [
    {
      "name": "Endorsement name",
      "explanation": "Plain English explanation of what this add-on does for the policyholder. Be specific about what it changes or adds."
    }
  ],
  "scenarios": [
    {
      "title": "3 words max",
      "covered": true,
      "description": "Start with 'If...'. 1-3 sentences. Specific to this policy — use actual limits, actual conditions from the document. No generic language."
    }
  ],
  "keyExclusions": [
    {
      "title": "Short title",
      "description": "1-2 sentences. Specific to this policy. What's excluded and why it matters to this particular policyholder."
    }
  ],
  "actionItems": ["One concrete, specific thing this policyholder should know or do based on what you read. No generic advice."],
  "overallScore": 78
}

RULES:
- declarations: list all major coverage limits from the dec page — dwelling, other structures, personal property, loss of use, liability, medical payments, etc. 6-10 items.
- valuationMethod: this is critical. Read carefully for RCV, ACV, actual cash value, replacement cost, extended replacement cost. Explain the real-world impact with a specific example relevant to their policy.
- subLimits: read the personal property section carefully for per-item or per-category caps. These are often buried. Include only what you actually find.
- andClauses: look for exclusion language with 'and' or 'but' that narrows or voids coverage. Explain the real consequence.
- endorsements: check the back of the policy for riders, add-ons, or endorsement pages. List what you find.
- scenarios: 6-8. Order most likely first. Each must reference actual policy limits or conditions.
- keyExclusions: 4-5. Only the most important ones that would surprise the policyholder.
- actionItems: 3 max. Genuinely useful and specific to this policy.
- overallScore: honest 0-100. 80+ solid, 60-79 decent, below 60 notable gaps.
- If a section genuinely has nothing (e.g. no endorsements found), return an empty array — do not make things up.
- Everything must come from the document. No generic insurance knowledge substituted for actual policy content.`;

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
        max_tokens: 3500,
        system: SYSTEM,
        messages: [{
          role: 'user',
          content: [
            { type: 'document', source: { type: 'base64', media_type: 'application/pdf', data: pdfBase64 } },
            { type: 'text', text: 'Read this insurance policy carefully and generate the full dashboard JSON. Every finding must come directly from this document. Return ONLY the JSON object.' }
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
      if (zip >= 90000 && zip <= 96999) { rebuildRatio = 0.85; regionName = 'California'; }
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
      else if (zip >= 90200 && zip <= 90299) { rebuildRatio = 0.88; regionName = 'Los Angeles area'; }
      else if (zip >= 92000 && zip <= 92999) { rebuildRatio = 0.86; regionName = 'San Diego area'; }
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
      status,
      regionName,
      estimatedRebuild,
      coverage,
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
app.listen(PORT, () => console.log(`PolicyClear backend running on port ${PORT}`));
