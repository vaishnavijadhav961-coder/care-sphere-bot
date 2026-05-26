import { db } from './config';
import { ref, set, remove, get } from 'firebase/database';

const CART_PATH = 'carts';

export const addToCart = async (uid, product, quantity = 1) => {
  const itemRef = ref(db, `${CART_PATH}/${uid}/${product.id}`);
  const snap = await get(itemRef);
  const existing = snap.val();
  const qty = existing ? (existing.quantity || 0) + quantity : quantity;
  await set(itemRef, {
    productId: product.id,
    name: product.name,
    price: product.price || 0,
    image: product.image || '',
    quantity: qty,
    addedAt: Date.now(),
  });
};

export const updateCartQuantity = async (uid, productId, quantity) => {
  const itemRef = ref(db, `${CART_PATH}/${uid}/${productId}`);
  if (quantity <= 0) {
    await remove(itemRef);
    return;
  }
  const snap = await get(itemRef);
  if (snap.exists()) {
    const item = snap.val();
    await set(itemRef, {
      ...item,
      quantity,
    });
  }
};

export const removeFromCart = async (uid, productId) => {
  const itemRef = ref(db, `${CART_PATH}/${uid}/${productId}`);
  await remove(itemRef);
};

export const clearCart = async (uid) => {
  const cartRef = ref(db, `${CART_PATH}/${uid}`);
  await remove(cartRef);
};

export const getCart = async (uid) => {
  const cartRef = ref(db, `${CART_PATH}/${uid}`);
  const snap = await get(cartRef);
  if (!snap.exists()) return [];
  const items = [];
  snap.forEach((child) => {
    items.push({ id: child.key, ...child.val() });
  });
  return items;
};
