const express = require('express');
const cors = require('cors');

const app = express();
app.use(cors());
app.use(express.json({ limit: '50mb' }));

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
        max_tokens: 2000,
        system: `You are an expert insurance advisor. Read the uploaded policy document carefully and extract information to generate a structured JSON dashboard.

Return ONLY valid JSON — no markdown, no backticks, no explanation. Use exactly this structure:
{
  "policyHolder": "Full name or Unknown",
  "policyNumber": "Policy number or Not found",
  "insurer": "Insurance company name",
  "policyType": "e.g. Auto / Homeowners / Health / Life / Renters / Umbrella",
  "effectiveDate": "MM/DD/YYYY or Not found",
  "expirationDate": "MM/DD/YYYY or Not found",
  "premium": "$X,XXX/year or /month — include period",
  "deductible": "Primary deductible e.g. $1,000",
  "coverageSummary": "3-4 sentence plain-English summary of what this policy covers, written directly to the policyholder as you",
  "coverageItems": [
    { "name": "Coverage area name", "limit": "Dollar limit or description", "status": "covered OR limited OR excluded" }
  ],
  "keyExclusions": ["Plain-English description of what is NOT covered — be specific and helpful"],
  "importantDates": [{ "label": "Short label", "date": "Date or deadline" }],
  "actionItems": ["Specific, practical thing the policyholder should know or do — be concrete"],
  "overallScore": 78
}

Rules:
- coverageItems: include 6-10 entries covering all major areas of this specific policy type
- keyExclusions: 4-7 of the most important exclusions a layperson might assume are covered but aren't
- actionItems: 3-5 genuinely useful insights or action items — not generic advice
- overallScore: your honest 0-100 assessment of how comprehensive this policy is
- Write everything from the perspective of helping the policyholder, not a legal document`,
        messages: [{
          role: 'user',
          content: [
            {
              type: 'document',
              source: { type: 'base64', media_type: 'application/pdf', data: pdfBase64 }
            },
            {
              type: 'text',
              text: 'Generate the dashboard JSON for this insurance policy document. Return ONLY the JSON object.'
            }
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
    res.json(policy);

  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

app.get('/health', (req, res) => res.json({ status: 'ok' }));

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`PolicyClear backend running on port ${PORT}`));
