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
    await update(productRef, { stock: Number(newStock) });
    console.log(`Stock updated for product ${productId} to ${newStock}`);
  } catch (error) {
    console.error(`Error updating stock for product ${productId}:`, error);
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
      stock: Number(product.stock),
      category: product.category,
      description: product.description
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
        stock: Number(prod.stock),
        category: prod.category,
        description: prod.description
      };
    });
    await set(productsRef, seedData);
    console.log('Products successfully seeded to RTDB!');
  } catch (error) {
    console.error('Error seeding products:', error);
    throw error;
  }
};

