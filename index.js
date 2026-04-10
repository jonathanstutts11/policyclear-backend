const express = require('express');
const cors = require('cors');

const app = express();
app.use(cors());
app.use(express.json({ limit: '50mb' }));

const SYSTEM = `You are an expert insurance policy advisor helping everyday people understand their insurance coverage clearly and completely. Your job is to read the policy document and return a structured JSON dashboard.

Return ONLY valid JSON — no markdown, no backticks, no explanation whatsoever. Use exactly this structure:

{
  "policyHolder": "Full name or Unknown",
  "policyNumber": "Policy number or Not found",
  "insurer": "Insurance company name",
  "policyType": "Auto / Homeowners / Health / Life / Renters / Umbrella / etc",
  "zipCode": "5-digit zip code extracted from the document, or null if not found",
  "effectiveDate": "MM/DD/YYYY or Not found",
  "expirationDate": "MM/DD/YYYY or Not found",
  "premium": "$X,XXX/year or /month — include the period",
  "deductible": "Primary deductible e.g. $1,000",
  "dwellingCoverage": "The dwelling coverage limit as a number only e.g. 400000, or null if not applicable",
  "finishLevel": "Read the policy carefully and identify the rebuild/finish quality level. Return one of: 'Builder-grade (standard finishes)', 'Mid-range (upgraded finishes)', 'High-end (custom/luxury finishes)', or 'Not specified in policy'",
  "coverageSummary": "3-4 sentence plain-English summary of what this policy covers, written directly to the policyholder using 'you' and 'your'. Be warm, clear, and specific to this actual policy.",
  "scenarios": [
    {
      "title": "Short scenario title e.g. House fire",
      "likelihood": "common OR occasional OR rare",
      "covered": true or false,
      "description": "Plain English explanation starting with 'If...' — explain what is covered, the limit, and any important conditions or exceptions. Be specific to this policy."
    }
  ],
  "keyExclusions": [
    {
      "title": "Short exclusion title",
      "description": "Plain English explanation of what is NOT covered and why this matters. Mention situations where someone might wrongly assume they are covered."
    }
  ],
  "importantDates": [{ "label": "Short label", "date": "Date or deadline or description" }],
  "actionItems": ["Specific, practical, concrete thing this policyholder should know or do based on what you actually read in their policy"],
  "overallScore": 78
}

CRITICAL RULES:

For scenarios — order them from MOST likely to affect the average policyholder to LEAST likely. Include 7-10 scenarios. For homeowners policies think: theft/break-in, water damage from plumbing, fire, liability if someone is injured on property, storm/wind damage, fallen tree, power outage, flood, earthquake. Adapt based on actual policy type. Each description must start with "If..." and be written in plain conversational English.

For keyExclusions — include 4-6 of the most important exclusions that a normal person might wrongly assume are covered. Be specific about the gap this creates.

For overallScore — honest 0-100 score of how comprehensive this policy is. 80+ = strong, 60-79 = decent with some gaps, below 60 = notable gaps worth addressing.

For finishLevel — read carefully for language about replacement cost, extended replacement cost, actual cash value, custom finishes, standard construction. This tells you what quality level the policy will pay to rebuild at.

Write everything as if you are a trusted knowledgeable friend explaining this to someone who has never read an insurance policy before.`;

app.post('/analyze', async (req, res) => {
  try {
    const { pdfBase64, homeValue } = req.body;
    if (!pdfBase64) return res.status(400).json({ error: 'No PDF provided' });

    const userPrompt = homeValue
      ? `Analyze this insurance policy and generate the dashboard JSON. The policyholder has told us their estimated home value is $${Number(homeValue).toLocaleString()}. Use this along with their dwelling coverage limit and finish level from the policy to inform your analysis. Return ONLY the JSON object.`
      : `Analyze this insurance policy and generate the dashboard JSON. Return ONLY the JSON object.`;

    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': process.env.ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 3000,
        system: SYSTEM,
        messages: [{
          role: 'user',
          content: [
            { type: 'document', source: { type: 'base64', media_type: 'application/pdf', data: pdfBase64 } },
            { type: 'text', text: userPrompt }
          ]
        }]
      })
    });

    if (!response.ok) {
      const err = await response.json().catch(() => ({}));
      return res.status(response.status).json({ error: err.error?.message || 'Anthropic API error' });
    }

    const data = await response.json();
    const raw = (data.content?.[0]?.text || '').replace(/```json|```/g, '').trim();
    const policy = JSON.parse(raw);

    // Rebuild cost analysis — runs on the server, no external API needed
    if (homeValue && policy.dwellingCoverage) {
      const zip = policy.zipCode ? parseInt(policy.zipCode) : null;

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
        else if (zip >= 30000 && zip <= 31999) { rebuildRatio = 0.65; regionName = 'Georgia'; }
        else if (zip >= 85000 && zip <= 86999) { rebuildRatio = 0.70; regionName = 'Arizona'; }
        else if (zip >= 19000 && zip <= 19999) { rebuildRatio = 0.75; regionName = 'Pennsylvania'; }
        else if (zip >= 20000 && zip <= 20599) { rebuildRatio = 0.82; regionName = 'Washington DC area'; }
        else if (zip >= 78000 && zip <= 78999) { rebuildRatio = 0.65; regionName = 'Texas'; }
        else if (zip >= 48000 && zip <= 49999) { rebuildRatio = 0.65; regionName = 'Michigan'; }
        else if (zip >= 55000 && zip <= 56999) { rebuildRatio = 0.67; regionName = 'Minnesota'; }
      }

      let finishMultiplier = 1.0;
      if (policy.finishLevel?.includes('Mid-range')) finishMultiplier = 1.15;
      if (policy.finishLevel?.includes('High-end')) finishMultiplier = 1.40;

      const hv = parseInt(homeValue);
      const estimatedRebuildCost = Math.round(hv * rebuildRatio * finishMultiplier);
      const coverageAmount = parseInt(policy.dwellingCoverage);
      const gap = estimatedRebuildCost - coverageAmount;

      if (gap > 10000) {
        const lowGap = Math.round(gap * 0.85 / 5000) * 5000;
        const highGap = Math.round(gap * 1.15 / 5000) * 5000;
        policy.rebuildAnalysis = {
          status: 'gap',
          regionName,
          estimatedRebuildCost,
          coverageAmount,
          lowGap,
          highGap,
          finishLevel: policy.finishLevel || 'Not specified'
        };
      } else if (gap < -10000) {
        policy.rebuildAnalysis = {
          status: 'adequate',
          regionName,
          estimatedRebuildCost,
          coverageAmount,
          finishLevel: policy.finishLevel || 'Not specified'
        };
      } else {
        policy.rebuildAnalysis = {
          status: 'close',
          regionName,
          estimatedRebuildCost,
          coverageAmount,
          finishLevel: policy.finishLevel || 'Not specified'
        };
      }
    }

    res.json(policy);

  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

app.get('/health', (req, res) => res.json({ status: 'ok' }));

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`PolicyClear backend running on port ${PORT}`));
