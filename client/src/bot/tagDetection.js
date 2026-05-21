/**
 * tagDetection.js
 * Pure utility functions to detect and strip special Gemini response tags.
 * [FLASH_DEAL] — triggers the quiz UI in ChatWidget
 * [ESCALATE]   — triggers human handoff flow
 *
 * No Firebase calls here. Called by bot.js after every Gemini response.
 */

const FLASH_DEAL_TAG = '[FLASH_DEAL]';
const ESCALATE_TAG = '[ESCALATE]';

/**
 * Check if Gemini's reply contains the Flash Deal trigger tag.
 * @param {string} reply
 * @returns {boolean}
 */
export function hasFlashDeal(reply) {
  return typeof reply === 'string' && reply.includes(FLASH_DEAL_TAG);
}

/**
 * Check if Gemini's reply contains the Escalation trigger tag.
 * @param {string} reply
 * @returns {boolean}
 */
export function hasEscalate(reply) {
  return typeof reply === 'string' && reply.includes(ESCALATE_TAG);
}

export function stripTags(reply) {
  if (typeof reply !== 'string') return '';
  return reply
    .replace(/\[FLASH_DEAL\]/g, '')
    .replace(/\[ESCALATE\]/g, '')
    .replace(/\[REDIRECT:\s*[^\]]+\]/gi, '')
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
