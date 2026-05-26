/**
 * bot.js
 * Central bot module for CareSphere. All Gemini API calls go through here.
 *
 * Exports:
 *  - handleMessage(customerMessage, conversationHistory, context) → { reply, showFlashDeal, escalated }
 *
 * Context shape:
 *  {
 *    mode: "human" | "direct",
 *    customerId: "user123",
 *    productContext: { id, name, ... } | null
 *  }
 */

import { getProducts } from '../firebase/products';
import { getOrders } from '../firebase/orders';
import { buildMasterPrompt } from './masterPrompt';
import { hasFlashDeal, hasEscalate, stripTags, getRedirectPath } from './tagDetection';
import { db } from '../firebase/config';
import { ref, get } from 'firebase/database';

const GEMINI_MODEL = 'gemini-3.1-flash-lite';
const GEMINI_API_BASE =
  'https://generativelanguage.googleapis.com/v1beta/models';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Promise timeout helper to make database fetches resilient
 */
const withTimeout = (promise, ms, fallback) =>
  Promise.race([
    promise,
    new Promise((resolve) => setTimeout(() => resolve(fallback), ms))
  ]);

/**
 * Fetch all coupons from RTDB via REST API.
 * Uses direct HTTP fetch instead of Firebase SDK to bypass stale local cache.
 */
async function fetchCoupons() {
  try {
    const projectId = import.meta.env.VITE_FIREBASE_PROJECT_ID || 'care-sphere-bot';
    const databaseURL = import.meta.env.VITE_FIREBASE_DATABASE_URL ||
      `https://${projectId}-default-rtdb.firebaseio.com/`;
    const res = await fetch(`${databaseURL}coupons.json`);
    if (!res.ok) {
      console.warn('[fetchCoupons] REST API error:', res.status);
      return [];
    }
    const data = await res.json();
    if (!data) {
      console.warn('[fetchCoupons] No coupons found via REST');
      return [];
    }
    const result = Object.entries(data).map(([key, val]) => ({ id: key, code: key, ...val }));
    console.log('[fetchCoupons] Fetched', result.length, 'coupon(s) via REST:',
      result.map(c => ({ code: c.code, isActive: c.isActive, expiryDate: c.expiryDate })));
    return result;
  } catch (err) {
    console.error('[fetchCoupons] Error:', err);
    return [];
  }
}

/**
 * Filter orders to only those belonging to our demo customer.
 */
function filterCustomerOrders(orders, customerId) {
  if (!customerId) return [];
  return orders.filter(o => o.customerId === customerId);
}

async function fetchCart(customerId) {
  if (!customerId) return [];
  try {
    const cartRef = ref(db, `carts/${customerId}`);
    const snap = await get(cartRef);
    if (!snap.exists()) return [];
    const items = [];
    snap.forEach((child) => {
      items.push({ id: child.key, ...child.val() });
    });
    return items;
  } catch {
    return [];
  }
}

// ---------------------------------------------------------------------------
// Gemini API call
// ---------------------------------------------------------------------------

/**
 * Send a conversation to Gemini and return the raw text response.
 *
 * @param {string}   systemPrompt - The master prompt (system instruction)
 * @param {Array}    history      - [{role:"user"|"model", parts:[{text:"..."}]}]
 * @returns {Promise<string>}
 */
async function callGemini(systemPrompt, history) {
  const apiKey = import.meta.env.VITE_GEMINI_API_KEY;

  if (!apiKey || apiKey === 'your_gemini_api_key_here') {
    console.warn('Gemini API key not set. Returning placeholder response.');
    return "I'm CareSphere! (Demo mode — Gemini API key not configured yet. Add VITE_GEMINI_API_KEY to .env)";
  }

  const url = `${GEMINI_API_BASE}/${GEMINI_MODEL}:generateContent?key=${apiKey}`;

  const body = {
    contents: history,
    system_instruction: {
      parts: [{ text: systemPrompt }],
    },
    generationConfig: {
      temperature: 0.7,
      maxOutputTokens: 2048,
    },
  };

  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const errText = await response.text();
    console.error('Gemini API error:', response.status, errText);
    throw new Error(`Gemini API error ${response.status}: ${errText}`);
  }

  const data = await response.json();

  // Extract text from response
  const text = data?.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!text) throw new Error('Gemini returned an empty response.');

  return text;
}

// ---------------------------------------------------------------------------
// Escalation handler
// ---------------------------------------------------------------------------

/**
 * Normalizes raw Gemini history format into flat ticket escalations history format
 */
export function normalizeHistoryToEscalation(history) {
  return history.map((item, idx) => {
    let sender = 'bot';
    if (item.role === 'user') sender = 'customer';
    
    let message = '';
    if (item.parts && Array.isArray(item.parts)) {
      message = item.parts.map(p => p.text || '').join('\n');
    } else if (typeof item.parts === 'string') {
      message = item.parts;
    }
    
    if (sender === 'bot') {
      message = stripTags(extractResponseText(message));
    }

    return {
      sender,
      message,
      timestamp: new Date(Date.now() - (history.length - idx) * 1000).toISOString()
    };
  });
}

// ---------------------------------------------------------------------------
// Main export
// ---------------------------------------------------------------------------

/**
 * Handle a single customer message.
 *
 * @param {string} customerMessage       - The text the customer just sent
 * @param {Array}  conversationHistory   - Full history EXCLUDING the new message
 *                                         [{role:"user"|"model", parts:[{text}]}]
 * @param {object} context               - { mode, customerId, productContext }
 *
 * @returns {Promise<{reply: string, showFlashDeal: boolean, escalated: boolean}>}
 */
export async function handleMessage(customerMessage, conversationHistory, context) {
  const { mode = 'human', customerId = 'user123', productContext = null } = context;

  try {
    // 1. Fetch live data from RTDB with timeouts to prevent hanging the UI
    const [products, allOrders, coupons, cart] = await Promise.all([
      withTimeout(getProducts(), 4000, []),
      withTimeout(getOrders(), 4000, []),
      withTimeout(fetchCoupons(), 4000, []),
      withTimeout(fetchCart(customerId), 4000, []),
    ]);
    const orders = filterCustomerOrders(allOrders, customerId);

    // 2. Build master prompt with injected data
    const systemPrompt = buildMasterPrompt({ products, orders, coupons, cart, mode, productContext, customerId });

    // 3. Append new customer message to history for this call
    const fullHistory = [
      ...conversationHistory,
      {
        role: 'user',
        parts: [
          {
            text: `${customerMessage}\n\n(System Format Instruction: Wrap your final, polished customer-facing reply inside <response>...</response> XML tags at the very end of your response. Any thoughts, reasoning steps, rule evaluations, or drafts must go outside these tags. The <response> tags must contain ONLY the actual text meant for the customer.)`
          }
        ]
      },
    ];

    // 5. Call Gemini
    const rawReply = await callGemini(systemPrompt, fullHistory);

    // 6. Detect special tags from the raw output
    const showFlashDeal = hasFlashDeal(rawReply);
    const escalated = hasEscalate(rawReply);
    const redirectPath = getRedirectPath(rawReply);

    // 7. Programmatically extract only the final customer-facing text
    const cleanExtracted = extractResponseText(rawReply);

    // 8. Strip special tags from the clean response
    const reply = stripTags(cleanExtracted);

    return { reply, showFlashDeal, escalated, redirectPath };
  } catch (error) {
    console.error('handleMessage error:', error);
    return {
      reply:
        "I'm having a little trouble right now. Please try again in a moment, or I can connect you with a human agent.",
      showFlashDeal: false,
      escalated: false,
      redirectPath: null,
    };
  }
}

// ---------------------------------------------------------------------------
// Utility
// ---------------------------------------------------------------------------

/**
 * Programmatically extracts the customer-facing message inside <response> tags.
 * Falls back to extracting sections or quoting text to guarantee clean outputs.
 */
function extractResponseText(rawReply) {
  // 1. Try extracting content inside <response>...</response> tags
  const match = rawReply.match(/<response>([\s\S]*?)<\/response>/i);
  if (match) {
    return match[1].trim();
  }

  // 2. Fallback: Check if there is a "Final Polish:" or similar section
  const finalPolishMatch = rawReply.match(/\*Final Polish:\*\s*([\s\S]+)/i);
  if (finalPolishMatch) {
    return finalPolishMatch[1].trim();
  }

  // 3. Fallback: If the response is wrapped in double quotes at the end
  const quoteMatch = rawReply.match(/"([^"]+)"\s*$/);
  if (quoteMatch) {
    return quoteMatch[1].trim();
  }

  // 4. Fallback: If reasoning was outputted as bullet points, filter them out
  const lines = rawReply.split('\n');
  const nonBulletLines = lines.filter(line => {
    const trimmed = line.trim();
    // Exclude thought bullet points, planning steps, drafting steps, or mode notes
    return !trimmed.startsWith('* ') && 
           !trimmed.startsWith('- ') && 
           !trimmed.toLowerCase().includes('draft') && 
           !trimmed.toLowerCase().includes('reasoning') &&
           !trimmed.toLowerCase().includes('customer id:') &&
           !trimmed.toLowerCase().includes('user asks:') &&
           !trimmed.toLowerCase().includes('current mode:');
  });

  if (nonBulletLines.length > 0) {
    const cleanLines = nonBulletLines.join('\n').trim();
    if (cleanLines.length > 10) {
      return cleanLines;
    }
  }

  return rawReply.trim();
}
