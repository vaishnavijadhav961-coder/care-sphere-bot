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
  * If status is "Delayed", delayReason and estimatedDelivery should be provided.
  * Also updates the timeline array with the new step.
  * @param {string} orderId - ID of the order
  * @param {string} status - Confirmed, Shipped, Delayed, Delivered
  * @param {object} delayDetails - { delayReason: string, estimatedDelivery: string } (optional)
  */
export const updateOrderStatus = async (orderId, status, delayDetails = {}) => {
  try {
    const orderRef = ref(db, `${PATH_NAME}/${orderId}`);
    const now = new Date();
    const dateStr = now.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
    const updates = { status };

    if (status === 'Delayed') {
      updates.delayReason = delayDetails.delayReason || 'Transit issue resolved shortly';
      updates.estimatedDelivery = delayDetails.estimatedDelivery || new Date(Date.now() + 5 * 24 * 60 * 60 * 1000).toISOString();
      updates.newDate = dateStr;
    } else {
      updates.delayReason = '';
    }

    // Update timeline
    const snapshot = await get(orderRef);
    let timeline = [];
    if (snapshot.exists() && snapshot.val().timeline) {
      timeline = snapshot.val().timeline;
    }
    timeline.push({
      status,
      date: dateStr,
      completed: status === 'Delivered'
    });
    updates.timeline = timeline;

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
        productId: order.productId || '',
        productName: order.productName,
        price: Number(order.price) || 0,
        status: order.status,
        orderDate: order.orderDate,
        shippedDate: order.shippedDate || '',
        estimatedDelivery: order.estimatedDelivery || '',
        newDate: order.newDate || '',
        delayReason: order.delayReason || '',
        trackingNumber: order.trackingNumber || '',
        timeline: order.timeline || [
          { status: 'Confirmed', date: order.orderDate || '', completed: true },
          { status: order.status, date: new Date().toISOString(), completed: order.status === 'Delivered' }
        ]
      };
    });
    await set(ordersRef, seedData);
    console.log('Orders successfully seeded to RTDB!');
  } catch (error) {
    console.error('Error seeding orders:', error);
    throw error;
  }
};

