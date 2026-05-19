import { db } from './config';
import { ref, get, set } from 'firebase/database';

const COUPONS_PATH = 'coupons';
const FLASH_DEALS_PATH = 'flashDealCodes';

/**
 * Validate a coupon code.
 * @param {string} code - The coupon code to validate
 * @returns {Promise<object|null>} Coupon details if valid, null otherwise
 */
export const validateCoupon = async (code) => {
  try {
    const couponRef = ref(db, `${COUPONS_PATH}/${code.toUpperCase()}`);
    const snapshot = await get(couponRef);
    if (snapshot.exists()) {
      const data = snapshot.val();
      const now = new Date();
      const expiry = new Date(data.expiryDate);
      if (data.isActive && expiry > now) {
        return { code: code.toUpperCase(), ...data };
      }
    }
    return null;
  } catch (error) {
    console.error('Error validating coupon:', error);
    throw error;
  }
};

/**
 * Create a new coupon.
 * @param {object} coupon - Coupon details
 */
export const createCoupon = async (coupon) => {
  try {
    const code = coupon.code.toUpperCase();
    const couponRef = ref(db, `${COUPONS_PATH}/${code}`);
    await set(couponRef, {
      discountPercent: Number(coupon.discountPercent),
      isActive: coupon.isActive !== undefined ? coupon.isActive : true,
      expiryDate: coupon.expiryDate || new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString()
    });
    console.log(`Coupon ${code} successfully created!`);
  } catch (error) {
    console.error('Error creating coupon:', error);
    throw error;
  }
};

/**
 * Seed coupons collection.
 * @param {Array} coupons - List of coupons
 */
export const seedCoupons = async (coupons) => {
  try {
    const couponsRef = ref(db, COUPONS_PATH);
    const seedData = {};
    coupons.forEach((coupon) => {
      seedData[coupon.code.toUpperCase()] = {
        discountPercent: Number(coupon.discountPercent),
        isActive: coupon.isActive,
        expiryDate: coupon.expiryDate
      };
    });
    await set(couponsRef, seedData);
    console.log('Coupons successfully seeded to RTDB!');
  } catch (error) {
    console.error('Error seeding coupons:', error);
    throw error;
  }
};

/**
 * Seed flashDealCodes collection.
 * @param {Array} flashDeals - List of flash deals
 */
export const seedFlashDeals = async (flashDeals) => {
  try {
    const flashDealsRef = ref(db, FLASH_DEALS_PATH);
    const seedData = {};
    flashDeals.forEach((deal) => {
      seedData[deal.code.toUpperCase()] = {
        discountPercent: Number(deal.discountPercent),
        isActive: deal.isActive,
        expiresAt: deal.expiresAt
      };
    });
    await set(flashDealsRef, seedData);
    console.log('Flash deal codes successfully seeded to RTDB!');
  } catch (error) {
    console.error('Error seeding flash deal codes:', error);
    throw error;
  }
};

