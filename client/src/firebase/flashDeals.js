import { db } from './config';
import { ref, get, set, update, push, query, orderByChild, equalTo } from 'firebase/database';

const PATH = 'flashDealCodes';

/**
 * Create a new Flash Deal code for a customer.
 * Saves to flashDealCodes/{pushId} in RTDB.
 * @param {string} customerId
 * @param {string} code - e.g. "QUIZ47"
 * @param {number} discountPercent - e.g. 15
 * @returns {Promise<string>} The generated RTDB key
 */
export const createFlashDealCode = async (customerId, code, discountPercent = 15) => {
  try {
    const codesRef = ref(db, PATH);
    const newRef = push(codesRef);
    const now = Date.now();
    await set(newRef, {
      code,
      customerId,
      discountPercent,
      used: false,
      createdAt: new Date(now).toISOString(),
      expiresAt: new Date(now + 2 * 60 * 60 * 1000).toISOString(), // 2 hours
    });
    console.log(`Flash deal code ${code} created for ${customerId}`);
    return newRef.key;
  } catch (error) {
    console.error('Error creating flash deal code:', error);
    throw error;
  }
};

/**
 * Check if a customer already has an active (unused, non-expired) Flash Deal.
 * @param {string} customerId
 * @returns {Promise<object|null>} The active deal object or null
 */
export const checkExistingFlashDeal = async (customerId) => {
  try {
    const codesRef = ref(db, PATH);
    const q = query(codesRef, orderByChild('customerId'), equalTo(customerId));
    const snapshot = await get(q);
    if (!snapshot.exists()) return null;

    const now = new Date();
    let activeDeal = null;
    snapshot.forEach((child) => {
      const deal = { id: child.key, ...child.val() };
      if (!deal.used && new Date(deal.expiresAt) > now) {
        activeDeal = deal;
      }
    });
    return activeDeal;
  } catch (error) {
    console.error('Error checking existing flash deal:', error);
    return null; // fail silently — don't block the chat
  }
};

/**
 * Mark a Flash Deal code as used.
 * @param {string} codeId - The RTDB key of the flash deal entry
 */
export const markFlashDealUsed = async (codeId) => {
  try {
    const codeRef = ref(db, `${PATH}/${codeId}`);
    await update(codeRef, { used: true });
    console.log(`Flash deal ${codeId} marked as used.`);
  } catch (error) {
    console.error('Error marking flash deal as used:', error);
    throw error;
  }
};
