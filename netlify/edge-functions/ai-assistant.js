/**
 * SENSORIUM — Claude AI Zone-Matching Assistant
 * Netlify Edge Function
 * 
 * FILE LOCATION IN YOUR REPO: netlify/edge-functions/ai-assistant.js
 * 
 * This runs on Netlify's edge servers (not in the user's browser).
 * Your Claude API key stays secret — never exposed to the public.
 * Only fires when a vendor actually asks the AI a question.
 * 
 * SETUP:
 * 1. In Netlify dashboard → Site Configuration → Environment Variables
 * 2. Add variable: ANTHROPIC_API_KEY = your key from console.anthropic.com
 * 3. Deploy — done.
 */

export default async function handler(request, context) {

  // Only accept POST requests
  if (request.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405,
      headers: { 'Content-Type': 'application/json' }
    });
  }

  // CORS headers — allows your frontend to call this function
  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Content-Type': 'application/json'
  };

  // Handle preflight OPTIONS request
  if (request.method === 'OPTIONS') {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const body = await request.json();
    const { message, vendorContext } = body;

    if (!message) {
      return new Response(JSON.stringify({ error: 'No message provided' }), {
        status: 400, headers: corsHeaders
      });
    }

    // Build context about the vendor's current state
    const contextSummary = vendorContext ? `
Current vendor profile state:
- Vendor type selected: ${vendorContext.vendorType || 'not yet selected'}
- Zones selected: ${vendorContext.zones?.join(', ') || 'none yet'}
- Theme keywords: ${vendorContext.themeKeywords?.join(', ') || 'none yet'}
- Products/services: ${vendorContext.tags?.join(', ') || 'none yet'}
- Tier interested in: ${vendorContext.tier || 'not selected'}
- Brand name: ${vendorContext.brandName || 'not entered yet'}
` : '';

    // The system prompt — this is what makes the AI know about Sensorium
    const systemPrompt = `You are the Sensorium Vendor Portal AI Assistant — a warm, knowledgeable guide helping wellness vendors, practitioners, and brands find their perfect fit within the Sensorium event ecosystem.

ABOUT SENSORIUM:
Sensorium is a monthly conscious wellness gathering series in Delray Beach, FL — a convergence of practitioners, artisans, educators, and community. Founded by Jameson Shelnut under Frequency Shift Labs.

THE 11 ZONES:
01 - Breath Portal (Root Chakra): Breathwork, grounding, vagus nerve, life force activation
02 - Consciousness Expansion (Sacral Chakra): Meditation, creativity, flow states, shadow work
03 - Sensorium Soundscapes (Solar Plexus): Sound baths, gongs, drums, live ambient, healing instruments
04 - Quantum Reset Pod (Heart Chakra): IV therapy, red light, PEMF, ozone, massage, chiropractic, recovery tech
05 - The Warrior Path (Throat Chakra): Martial arts, discipline, expression, power training
06 - Activation Arena (Third Eye): HIIT, yoga, functional fitness, ecstatic dance, movement brands
07 - Knowledge Pavilion (Crown Chakra): Keynote panels, workshops, talks, thought leadership
08 - Elixir Lounge (Alchemy): Ceremonial cacao, adaptogen elixirs, kava, functional beverages
09 - The Grove (Holistic): Organic food, nourishment vendors, cold-press juice, plant-based meals
10 - The Village (Community): Wellness pop-ups, readers, skincare, apothecary, conscious artisan goods
11 - Starfield (Wonder): Family zone, kids programming, community art

VENDOR TIERS:
- Tier 1 General ($45 inaugural / $75 standard): Booth, 1 IG Story, vendor collage tag, 2 tickets
- Tier 2 Featured ($75 inaugural / $125 standard): + Spotlight Reel, podcast shoutout, Starmap stamp, dedicated IG post, logo on flyer, priority placement, 2 Enlightened tickets
- Tier 3 Presenting Partner ($125 inaugural / $200 standard): + Zone co-branding, podcast intro, guaranteed goodie bag, ceremony acknowledgment, recap feature
- 3-Event Lock-In rates: T1=$40, T2=$65, T3=$110 per event

KEY FACTS:
- 6% of all vendor fees go directly to the nonprofit partner — built into every agreement
- The Starmap passport system routes every attendee to Tier 2+ vendor booths
- Events are boutique format: ~80 tickets, 15 vendor booths max
- Every event is built around a single keynote podcast theme — vendors are matched to events by theme alignment
- Food/beverage vendors can choose flat fee OR revenue share (12-15%)

YOUR ROLE:
- Help vendors identify which zone(s) fit their offering
- Recommend the right booth tier based on their goals and budget
- Explain how the Starmap system guarantees foot traffic
- Help them articulate their theme alignment keywords
- Answer questions about setup, logistics, pricing
- Be warm, clear, and embodied — avoid corporate or clinical language
- Keep responses concise (2-4 sentences max unless they ask for detail)
- Always end with a gentle nudge toward the next step in the form

${contextSummary}

Respond in the voice of Sensorium — warm, conscious, community-first. Never pushy. Always clear.`;

    // Call the Claude API
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': Deno.env.get('ANTHROPIC_API_KEY'),
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 400,
        system: systemPrompt,
        messages: [
          { role: 'user', content: message }
        ]
      })
    });

    if (!response.ok) {
      const errText = await response.text();
      console.error('Claude API error:', errText);
      return new Response(JSON.stringify({ 
        error: 'AI service unavailable',
        reply: "I'm having trouble connecting right now. Please continue filling out the form and our team will personally help match you to the right zone." 
      }), { status: 200, headers: corsHeaders });
    }

    const data = await response.json();
    const reply = data.content?.[0]?.text || "I'm here to help! What questions do you have about finding your zone or choosing your tier?";

    return new Response(JSON.stringify({ reply }), {
      status: 200,
      headers: corsHeaders
    });

  } catch (err) {
    console.error('Edge function error:', err);
    return new Response(JSON.stringify({ 
      reply: "Something went wrong on my end. Keep filling out the form — our team reviews every submission personally and will be in touch within 48 hours." 
    }), { status: 200, headers: corsHeaders });
  }
}

// Tell Netlify this runs on every request to /api/ai-assistant
export const config = {
  path: '/api/ai-assistant'
};
