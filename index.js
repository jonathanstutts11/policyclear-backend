const express = require('express');
const cors = require('cors');

const app = express();
app.use(cors());
app.use(express.json({ limit: '50mb' }));

const SYSTEM = `You are an insurance expert explaining a policy to a friend who knows nothing about insurance. Be short, direct, and human. No jargon. No long sentences. Get to the point.

Return ONLY valid JSON — no markdown, no backticks, nothing else.

{
  "policyHolder": "Full name or Unknown",
  "policyNumber": "Number or Not found",
  "insurer": "Company name",
  "policyType": "Auto / Homeowners / Health / Life / Renters / Umbrella",
  "zipCode": "5-digit zip from the document or null",
  "effectiveDate": "MM/DD/YYYY or Not found",
  "expirationDate": "MM/DD/YYYY or Not found",
  "premium": "$X,XXX/year or /month",
  "deductible": "$X,XXX",
  "dwellingCoverage": 400000,
  "finishLevel": "Builder-grade (standard finishes) OR Mid-range (upgraded finishes) OR High-end (custom/luxury finishes) OR Not specified",
  "coverageSummary": "3-5 sentences. Be specific — use the actual dollar amounts, coverage names, and location from the policy. Write directly to the policyholder using 'you' and 'your'. This should read like a knowledgeable friend summarizing exactly what they have. Include the key coverage limits (dwelling, liability, personal property, loss of use etc). No jargon.",
  "scenarios": [
    {
      "title": "Short title — 3 words max",
      "covered": true,
      "description": "1-3 sentences. Start with 'If...'. Say exactly what happens, what the limit is, what they need to know. Nothing extra."
    }
  ],
  "keyExclusions": [
    {
      "title": "Short title",
      "description": "1-2 sentences. What's not covered and why it matters. Be specific."
    }
  ],
  "actionItems": ["One sentence. One concrete thing they should know or do. No fluff."],
  "overallScore": 78
}

RULES:
- scenarios: 6-8 max. Order by most likely to happen first. Think: what does this person actually worry about? For homeowners: fire, theft, water damage, liability, storm, flood, earthquake. Each must start with "If..."
- keyExclusions: 4-5 max. Only the ones that would genuinely surprise someone.
- actionItems: 3 max. Only if genuinely useful.
- overallScore: 0-100. Honest. 80+ = solid, 60-79 = ok, below 60 = gaps.
- dwellingCoverage: number only, no dollar sign. null if not a homeowners/property policy.
- Keep everything short. If you can say it in 10 words instead of 20, use 10.`;

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
        max_tokens: 2500,
        system: SYSTEM,
        messages: [{
          role: 'user',
          content: [
            { type: 'document', source: { type: 'base64', media_type: 'application/pdf', data: pdfBase64 } },
            { type: 'text', text: 'Analyze this insurance policy. Return ONLY the JSON object.' }
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
