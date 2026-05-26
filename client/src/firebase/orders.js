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
        itemCount: order.items?.length || 1,
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

/**
 * Create a new order in RTDB.
 * @param {object} params - { customerId, items, total, address }
 * @returns {Promise<string>} The new order ID
 */
export const createOrder = async ({ customerId, items, total, address = '', couponCode = '', couponDiscount = 0 }) => {
  const now = new Date();
  const random = Math.random().toString(36).substring(2, 6);
  const orderId = `ord_${Date.now()}_${random}`;
  const orderRef = ref(db, `${PATH_NAME}/${orderId}`);

  const trackingNumber = `TRK-${orderId.slice(0, 8).toUpperCase()}`;

  const productName = items.length === 1
    ? items[0].name
    : `${items[0].name} + ${items.length - 1} more`;

  await set(orderRef, {
    customerId,
    productId: items[0]?.productId || '',
    productName,
    price: Number(total) || 0,
    couponCode,
    couponDiscount: Number(couponDiscount) || 0,
    status: 'Confirmed',
    orderDate: now.toISOString(),
    estimatedDelivery: new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000).toISOString(),
    newDate: '',
    delayReason: '',
    trackingNumber,
    shippingAddress: address,
    items: items.map((i) => ({
      productId: i.productId,
      name: i.name,
      price: i.price,
      quantity: i.quantity || 1,
    })),
    timeline: [
      { status: 'Confirmed', date: now.toISOString(), completed: true },
    ],
  });

  return orderId;
};

