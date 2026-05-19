import { db } from './config';
import { ref, get, child, update, set } from 'firebase/database';

const PATH_NAME = 'orders';

/**
 * Fetch all orders from Realtime Database.
 * @returns {Promise<Array>} List of orders
 */
export const getOrders = async () => {
  try {
    const dbRef = ref(db);
    const snapshot = await get(child(dbRef, PATH_NAME));
    if (snapshot.exists()) {
      const orders = [];
      snapshot.forEach((childSnapshot) => {
        orders.push({ id: childSnapshot.key, ...childSnapshot.val() });
      });
      return orders;
    }
    return [];
  } catch (error) {
    console.error('Error fetching orders:', error);
    throw error;
  }
};

/**
 * Update the status of an order.
 * If status is "Delayed", delayReason and newDeliveryDate should be provided.
 * @param {string} orderId - ID of the order
 * @param {string} status - Confirmed, Shipped, Delayed, Delivered
 * @param {object} delayDetails - { delayReason: string, estimatedDelivery: string } (optional)
 */
export const updateOrderStatus = async (orderId, status, delayDetails = {}) => {
  try {
    const orderRef = ref(db, `${PATH_NAME}/${orderId}`);
    const updates = { status };

    if (status === 'Delayed') {
      updates.delayReason = delayDetails.delayReason || 'Transit issue resolved shortly';
      updates.estimatedDelivery = delayDetails.estimatedDelivery || new Date(Date.now() + 5 * 24 * 60 * 60 * 1000).toISOString();
    } else {
      // Clear delay info if order status shifts away from Delayed
      updates.delayReason = '';
    }

    await update(orderRef, updates);
    console.log(`Order ${orderId} updated to status ${status} successfully.`);
  } catch (error) {
    console.error(`Error updating order ${orderId} status:`, error);
    throw error;
  }
};

/**
 * Seed orders collection with dummy data.
 * @param {Array} orders - List of orders to seed
 */
export const seedOrders = async (orders) => {
  try {
    const ordersRef = ref(db, PATH_NAME);
    const seedData = {};
    orders.forEach((order) => {
      seedData[order.id] = {
        customerId: order.customerId || 'user123',
        productName: order.productName,
        price: Number(order.price),
        status: order.status,
        orderDate: order.orderDate,
        estimatedDelivery: order.estimatedDelivery,
        delayReason: order.delayReason || '',
        trackingNumber: order.trackingNumber || ''
      };
    });
    await set(ordersRef, seedData);
    console.log('Orders successfully seeded to RTDB!');
  } catch (error) {
    console.error('Error seeding orders:', error);
    throw error;
  }
};

