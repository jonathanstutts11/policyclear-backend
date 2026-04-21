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
  "squareFootage": "Living area square footage of the home as shown on the declarations page or elsewhere in the document — return as a number only e.g. 2100, or null if not found",
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

scenarios: Produce 14-18 scenarios total. Order them strictly by likelihood of happening to this specific policyholder — do NOT group all covered together and all not-covered together. Instead, interleave them naturally: the most likely event first (whether covered or not), second most likely second, and so on. This means the list will naturally mix green checkmarks and red X's throughout based on what's actually most likely. Among the first 10 scenarios, ensure there are at least 3 not-covered items and at least 4 covered items so the initial view shows a meaningful mix. Every scenario gets the same quality description regardless of position — full plain-English explanation with actual dollar amounts and conditions from the policy, starting with 'If...'

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
        'anthropic-version': '2023-06-01',
        'anthropic-beta': 'prompt-caching-2024-07-31'
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 4000,
        system: [
          {
            type: 'text',
            text: SYSTEM,
            cache_control: { type: 'ephemeral' }
          }
        ],
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
    const { homeValue, dwellingCoverage, zipCode, finishLevel, squareFootage, propertyCity } = req.body;
    if (!homeValue || !dwellingCoverage) return res.status(400).json({ error: 'Missing required fields' });

    const zip = zipCode ? parseInt(zipCode) : null;

    // Per sq ft rebuild cost ranges by region [low, mid, high] in dollars
    let costLow = 180, costMid = 250, costHigh = 380;
    let regionName = 'your area';

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

    // Adjust for finish level
    let finishMultiplier = 1.0;
    let finishLabel = 'standard';
    if (finishLevel?.includes('Mid-range')) { finishMultiplier = 1.15; finishLabel = 'mid-range'; }
    if (finishLevel?.includes('High-end')) { finishMultiplier = 1.40; finishLabel = 'high-end'; }

    const coverage = parseInt(dwellingCoverage);
    const sqft = squareFootage ? parseInt(squareFootage) : null;

    let estimatedRebuildLow, estimatedRebuildHigh, estimatedRebuild, usedSqft = false;

    if (sqft && sqft > 200 && sqft < 20000) {
      // Use sq footage method — more transparent
      estimatedRebuildLow = Math.round(sqft * costLow * finishMultiplier);
      estimatedRebuildHigh = Math.round(sqft * costHigh * finishMultiplier);
      estimatedRebuild = Math.round(sqft * costMid * finishMultiplier);
      usedSqft = true;
    } else {
      // Fall back to home value ratio method
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
      amount: amount || 1499,
      currency: 'usd',
      description: 'CoveredIf Policy Analysis',
      payment_method_types: ['card']
    });
    res.json({ clientSecret: paymentIntent.client_secret });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/audio-summary', async (req, res) => {
  try {
    const { policyData } = req.body;
    if (!policyData) return res.status(400).json({ error: 'No policy data provided' });

    // Build a rich, conversational audio script from the policy data
    const d = policyData;
    const name = d.policyHolder && d.policyHolder !== 'Unknown' ? d.policyHolder.split(' ')[0] : null;
    const greeting = name ? `Here's a summary of ${name}'s policy.` : "Here's a summary of your policy.";

    // Trim helper — keep descriptions concise for audio
    const trim = (str, max=200) => str && str.length > max ? str.slice(0, str.lastIndexOf(' ', max)) + '.' : str;

    const coveredScenarios = (d.scenarios || []).filter(s => s.covered).slice(0, 2);
    const notCoveredScenarios = (d.scenarios || []).filter(s => !s.covered).slice(0, 1);
    const topAction = d.actionItems && d.actionItems[0] ? d.actionItems[0] : null;
    const hasGap = d.subLimits && d.subLimits.length > 0;

    let script = `${greeting} `;
    script += `${trim(d.coverageSummary, 300)} `;

    if (coveredScenarios.length > 0) {
      script += `Here are a couple of things you're covered for. `;
      coveredScenarios.forEach(s => { script += `${trim(s.description)} `; });
    }

    if (notCoveredScenarios.length > 0) {
      script += `One important gap to be aware of: `;
      notCoveredScenarios.forEach(s => { script += `${trim(s.description)} `; });
    }

    if (d.valuationMethod && d.valuationMethod.explanation) {
      script += `On how claims are paid: ${trim(d.valuationMethod.explanation, 200)} `;
    }

    if (hasGap) {
      script += `Your policy also has sub-limits — dollar caps on categories like jewelry or electronics — worth reviewing in your full report. `;
    }

    if (topAction) {
      script += `One key thing to act on: ${trim(topAction)} `;
    }

    script += `Your full CoveredIf report has all the details, including your insurer's ratings and a rebuild cost estimate for your property.`;

    // Hard cap at 2000 characters for ElevenLabs free tier efficiency
    if (script.length > 2000) script = script.slice(0, script.lastIndexOf(' ', 2000)) + '. Your full report has more details.';

    if (topAction) {
      script += `One key thing to act on: ${topAction} `;
    }

    script += `Your full CoveredIf report has all the details, including your insurer's ratings and a rebuild cost estimate for your property.`;

    // Call ElevenLabs API — Rachel voice
    const VOICE_ID = '21m00Tcm4TlvDq8ikWAM';
    const elRes = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${VOICE_ID}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'xi-api-key': process.env.ELEVENLABS_API_KEY
      },
      body: JSON.stringify({
        text: script,
        model_id: 'eleven_turbo_v2',
        voice_settings: {
          stability: 0.5,
          similarity_boost: 0.75,
          style: 0.3,
          use_speaker_boost: true
        }
      })
    });

    if (!elRes.ok) {
      const err = await elRes.json().catch(() => ({}));
      return res.status(elRes.status).json({ error: err.detail || 'ElevenLabs error' });
    }

    // Stream audio back to client
    const audioBuffer = await elRes.arrayBuffer();
    res.set({
      'Content-Type': 'audio/mpeg',
      'Content-Length': audioBuffer.byteLength
    });
    res.send(Buffer.from(audioBuffer));

  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});



const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`CoveredIf backend running on port ${PORT}`));
