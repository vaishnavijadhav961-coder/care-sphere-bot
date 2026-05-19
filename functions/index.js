/**
 * COSMIC QUERY - Cloud Functions Control Center
 * 
 * This file contains the automated backend routines for the CareSphere AI system.
 * It uses Firebase Functions v2 for optimal scalability and performance.
 */

const { onSchedule } = require('firebase-functions/v2/scheduler');
const { logger } = require('firebase-functions');
const { initializeApp } = require('firebase-admin/app');
const { getFirestore } = require('firebase-admin/firestore');

// Initialize Admin SDK to interact with Firestore
initializeApp();
const db = getFirestore();

/**
 * Scheduled CRON Function: Runs every 6 hours.
 * Automatically scans the Firestore 'orders' collection.
 * 
 * Rule: If an order has a status of "Shipped" and the order placement time
 * (orderDate) is older than 3 days, transition it to "Delayed" with automated reasons.
 */
exports.detectDelayedOrders = onSchedule('every 6 hours', async (event) => {
  logger.info('Running automated delayed-order detection routine...', { structuredData: true });

  try {
    const now = new Date();
    const threeDaysAgo = new Date();
    threeDaysAgo.setDate(now.getDate() - 3);

    // Query Firestore for orders that are currently "Shipped"
    const ordersRef = db.collection('orders');
    const snapshot = await ordersRef.where('status', '==', 'Shipped').get();

    if (snapshot.empty) {
      logger.info('No shipped orders in transit. Routine complete.', { structuredData: true });
      return null;
    }

    const batch = db.batch();
    let updatedCount = 0;

    snapshot.forEach((doc) => {
      const orderData = doc.data();
      const orderDate = new Date(orderData.orderDate);

      // Check if the order placement date is older than 3 days
      if (orderDate < threeDaysAgo) {
        const docRef = ordersRef.doc(doc.id);
        
        // 5 days from today as the new delivery target
        const newDeliveryDate = new Date();
        newDeliveryDate.setDate(now.getDate() + 5);

        // Stage the status update, delay reason, and new estimated date in the batch
        batch.update(docRef, {
          status: 'Delayed',
          delayReason: 'Automated Check: Transit window exceeded (3 days Shipped threshold).',
          estimatedDelivery: newDeliveryDate.toISOString(),
          updatedAt: now.toISOString()
        });

        logger.info(`Staged order ${doc.id} for delay update. Date placed: ${orderData.orderDate}`, {
          orderId: doc.id
        });
        updatedCount++;
      }
    });

    // Commit all changes in a single write operation for efficiency
    if (updatedCount > 0) {
      await batch.commit();
      logger.info(`Automated check complete. Successfully transitioned ${updatedCount} orders to 'Delayed'.`, {
        totalUpdated: updatedCount
      });
    } else {
      logger.info('No shipped orders exceeded the 3-day transit limit. No actions taken.', {
        structuredData: true
      });
    }

    return null;
  } catch (error) {
    logger.error('CRITICAL: Error executing detectDelayedOrders routine:', error);
    throw error;
  }
});
