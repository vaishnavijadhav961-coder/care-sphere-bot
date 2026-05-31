import { db } from './config';
import { ref, set, remove, get, runTransaction } from 'firebase/database';
import { snapshotToArray } from './utils';

const CART_PATH = 'carts';

export const addToCart = async (uid, product, quantity = 1) => {
  const productRef = ref(db, `products/${product.id}`);
  const productSnap = await get(productRef);
  if (!productSnap.exists()) throw new Error('Product not found');
  const prodData = productSnap.val();
  const availableStock = prodData.stock || 0;
  if (availableStock < 1) throw new Error('This product is currently out of stock');

  const itemRef = ref(db, `${CART_PATH}/${uid}/${product.id}`);
  await runTransaction(itemRef, (current) => {
    const existing = current || {};
    const currentQty = existing.quantity || 0;
    const newQty = currentQty + quantity;
    if (newQty > availableStock) {
      return undefined;
    }
    return {
      productId: product.id,
      name: product.name,
      price: product.price || 0,
      image: product.image || '',
      quantity: newQty,
      addedAt: Date.now(),
    };
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
  return snapshotToArray(snap);
};
