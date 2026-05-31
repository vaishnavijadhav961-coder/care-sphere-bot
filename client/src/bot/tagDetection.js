/**
 * tagDetection.js
 * Pure utility functions to detect and strip special Gemini response tags.
 * [FLASH_DEAL] — triggers the quiz UI in ChatWidget
 * [ESCALATE]   — triggers human handoff flow
 * [CART_REMOVE: ids] — triggers cart item removal
 * [CART_UPDATE: id,qty] — triggers cart quantity update
 * [FAILURE]    — signals bot couldn't find requested information
 *
 * No Firebase calls here. Called by bot.js after every Gemini response.
 */

const FLASH_DEAL_TAG = '[FLASH_DEAL]';
const ESCALATE_TAG = '[ESCALATE]';
const FAILURE_TAG = '[FAILURE]';

function hasTag(reply, tag) {
  return typeof reply === 'string' && reply.includes(tag);
}

export const hasFlashDeal = (reply) => hasTag(reply, FLASH_DEAL_TAG);
export const hasEscalate = (reply) => hasTag(reply, ESCALATE_TAG);
export const hasFailure = (reply) => hasTag(reply, FAILURE_TAG);

export function stripTags(reply) {
  if (typeof reply !== 'string') return '';
  return reply
    .replace(/\[FLASH_DEAL\]/g, '')
    .replace(/\[ESCALATE\]/g, '')
    .replace(/\[FAILURE\]/g, '')
    .replace(/\[REDIRECT:\s*[^\]]+\]/gi, '')
    .replace(/\[CART_REMOVE:\s*[^\]]+\]/gi, '')
    .replace(/\[CART_UPDATE:\s*[^\]]+\]/gi, '')
    .trim();
}

/**
 * Extract path from [REDIRECT: /path] tag if present.
 * @param {string} reply
 * @returns {string|null}
 */
export function getRedirectPath(reply) {
  if (typeof reply !== 'string') return null;
  const match = reply.match(/\[REDIRECT:\s*([^\]]+)\]/i);
  return match ? match[1].trim() : null;
}

/**
 * Extract product IDs from [CART_REMOVE: id1,id2] tag if present.
 * @param {string} reply
 * @returns {string[]|null}
 */
export function getCartRemoveIds(reply) {
  if (typeof reply !== 'string') return null;
  const match = reply.match(/\[CART_REMOVE:\s*([^\]]+)\]/i);
  if (!match) return null;
  return match[1].split(',').map((s) => s.trim()).filter(Boolean);
}

/**
 * Extract product ID and target quantity from [CART_UPDATE: productId,quantity] tag.
 * @param {string} reply
 * @returns {{ productId: string, quantity: number } | null}
 */
export function getCartUpdate(reply) {
  if (typeof reply !== 'string') return null;
  const match = reply.match(/\[CART_UPDATE:\s*([^,]+)\s*,\s*(\d+)\s*\]/i);
  if (!match) return null;
  return {
    productId: match[1].trim(),
    quantity: parseInt(match[2], 10),
  };
}
