import { db } from './config';
import { ref, get, child, update, set } from 'firebase/database';

const PATH_NAME = 'products';

/**
 * Fetch all products from Realtime Database.
 * @returns {Promise<Array>} List of products
 */
export const getProducts = async () => {
  try {
    const dbRef = ref(db);
    const snapshot = await get(child(dbRef, PATH_NAME));
    if (snapshot.exists()) {
      const products = [];
      snapshot.forEach((childSnapshot) => {
        products.push({ id: childSnapshot.key, ...childSnapshot.val() });
      });
      return products;
    }
    return [];
  } catch (error) {
    console.error('Error fetching products:', error);
    throw error;
  }
};

/**
  * Update stock count for a specific product.
  * @param {string} productId - ID of the product
  * @param {number} newStock - New stock quantity
  */
export const updateProductStock = async (productId, newStock) => {
  try {
    const productRef = ref(db, `${PATH_NAME}/${productId}`);
    const updates = { stock: Number(newStock) };
    // Sync inStock boolean — stock > 0 means in stock
    updates.inStock = Number(newStock) > 0;
    await update(productRef, updates);
    console.log(`Stock updated for product ${productId} to ${newStock}`);
  } catch (error) {
    console.error(`Error updating stock for product ${productId}:`, error);
    throw error;
  }
};

/**
 * Add a customer to a product's notify list for back-in-stock alerts.
 * @param {string} productId
 * @param {string} customerId
 */
export const addToNotifyList = async (productId, customerId) => {
  try {
    const productRef = ref(db, `${PATH_NAME}/${productId}/notifyList`);
    const snapshot = await get(productRef);
    const list = snapshot.exists() ? snapshot.val() : [];
    if (!list.includes(customerId)) {
      list.push(customerId);
      await set(productRef, list);
    }
    return true;
  } catch (error) {
    console.error('Error adding to notify list:', error);
    return false;
  }
};

/**
 * Remove a customer from a product's notify list.
 * @param {string} productId
 * @param {string} customerId
 */
export const removeFromNotifyList = async (productId, customerId) => {
  try {
    const productRef = ref(db, `${PATH_NAME}/${productId}/notifyList`);
    const snapshot = await get(productRef);
    const list = snapshot.exists() ? snapshot.val() : [];
    const filtered = list.filter(id => id !== customerId);
    await set(productRef, filtered);
    console.log(`${customerId} removed from notifyList for ${productId}`);
  } catch (error) {
    console.error('Error removing from notify list:', error);
    throw error;
  }
};

/**
  * Add a new product to RTDB.
  * @param {object} product - Product details
  */
export const createProduct = async (product) => {
  try {
    const id = product.id || `prod_${Date.now()}`;
    const productRef = ref(db, `${PATH_NAME}/${id}`);
    const payload = {
      name: product.name,
      price: Number(product.price),
      stock: Number(product.stock) || 0,
      inStock: product.inStock !== undefined ? product.inStock : Number(product.stock) > 0,
      category: product.category,
      description: product.description || '',
      discount: Number(product.discount) || 0,
      pageUrl: product.pageUrl || id,
      specs: product.specs || {},
      rating: Number(product.rating) || 0,
      notifyList: product.notifyList || [],
      image: product.image || ''
    };
    await set(productRef, payload);
    console.log(`Product ${id} successfully created!`);
    return id;
  } catch (error) {
    console.error('Error creating product:', error);
    throw error;
  }
};

/**
 * Seed products collection with dummy data.
 * @param {Array} products - List of products to seed
 */
export const seedProducts = async (products) => {
  try {
    const productsRef = ref(db, PATH_NAME);
    const seedData = {};
    products.forEach((prod) => {
      seedData[prod.id] = {
        name: prod.name,
        price: Number(prod.price),
        stock: Number(prod.stock) || 0,
        inStock: prod.inStock !== undefined ? prod.inStock : (Number(prod.stock) || 0) > 0,
        category: prod.category,
        description: prod.description || '',
        discount: Number(prod.discount) || 0,
        pageUrl: prod.pageUrl || prod.id,
        specs: prod.specs || {},
        rating: Number(prod.rating) || 0,
        notifyList: prod.notifyList || [],
        image: prod.image || ''
      };
    });
    await set(productsRef, seedData);
    console.log('Products successfully seeded to RTDB!');
  } catch (error) {
    console.error('Error seeding products:', error);
    throw error;
  }
};

