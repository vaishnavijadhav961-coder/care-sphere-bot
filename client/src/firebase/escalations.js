import { db } from './config';
import { ref, get, child, update, set } from 'firebase/database';

const PATH_NAME = 'escalations';

/**
 * Fetch all escalations.
 * @returns {Promise<Array>} List of escalations
 */
export const getEscalations = async () => {
  try {
    const dbRef = ref(db);
    const snapshot = await get(child(dbRef, PATH_NAME));
    if (snapshot.exists()) {
      const escalations = [];
      snapshot.forEach((childSnapshot) => {
        escalations.push({ id: childSnapshot.key, ...childSnapshot.val() });
      });
      return escalations;
    }
    return [];
  } catch (error) {
    console.error('Error fetching escalations:', error);
    throw error;
  }
};

/**
 * Mark an escalation as resolved.
 * @param {string} escalationId - ID of the escalation doc
 */
export const resolveEscalation = async (escalationId) => {
  try {
    const docRef = ref(db, `${PATH_NAME}/${escalationId}`);
    await update(docRef, {
      status: 'resolved',
      urgency: 'resolved'
    });
    console.log(`Escalation ${escalationId} marked as resolved.`);
  } catch (error) {
    console.error(`Error resolving escalation ${escalationId}:`, error);
    throw error;
  }
};

/**
 * Create a new escalation ticket (useful for simulation).
 * @param {object} escalation - The escalation document payload
 */
export const createEscalation = async (escalation) => {
  try {
    const docId = escalation.id || `esc_${Math.floor(1000 + Math.random() * 9000)}`;
    const docRef = ref(db, `${PATH_NAME}/${docId}`);
    await set(docRef, {
      customerId: escalation.customerId || 'user123',
      customerName: escalation.customerName || 'Anonymous Customer',
      urgency: escalation.urgency || 'unresolved',
      summary: escalation.summary || 'Human assistance requested',
      chatHistory: escalation.chatHistory || [],
      status: escalation.status || 'unresolved',
      createdAt: escalation.createdAt || new Date().toISOString()
    });
    console.log(`Created new escalation ${docId}`);
    return docId;
  } catch (error) {
    console.error('Error creating escalation:', error);
    throw error;
  }
};

/**
 * Seed escalations collection with mock data.
 * @param {Array} escalations - List of escalations to seed
 */
export const seedEscalations = async (escalations) => {
  try {
    const escalationsRef = ref(db, PATH_NAME);
    const seedData = {};
    escalations.forEach((esc) => {
      seedData[esc.id] = {
        customerId: esc.customerId || 'user123',
        customerName: esc.customerName,
        urgency: esc.urgency,
        summary: esc.summary,
        chatHistory: esc.chatHistory || [],
        status: esc.status,
        createdAt: esc.createdAt || new Date().toISOString()
      };
    });
    await set(escalationsRef, seedData);
    console.log('Escalations successfully seeded to RTDB!');
  } catch (error) {
    console.error('Error seeding escalations:', error);
    throw error;
  }
};

/**
 * Append a new message to an escalation's chat history.
 * @param {string} escalationId - ID of the escalation doc
 * @param {string} sender - 'bot' | 'customer' | 'agent'
 * @param {string} message - Message text
 */
export const addMessageToEscalation = async (escalationId, sender, message) => {
  try {
    const chatHistoryRef = ref(db, `${PATH_NAME}/${escalationId}/chatHistory`);
    const snapshot = await get(chatHistoryRef);
    let currentHistory = [];
    if (snapshot.exists()) {
      currentHistory = snapshot.val();
      if (!Array.isArray(currentHistory)) {
        currentHistory = Object.values(currentHistory);
      }
    }
    const newMessage = {
      sender,
      message,
      timestamp: new Date().toISOString()
    };
    await set(chatHistoryRef, [...currentHistory, newMessage]);
    console.log(`Added message by ${sender} to escalation ${escalationId}`);
  } catch (error) {
    console.error(`Error adding message to escalation ${escalationId}:`, error);
    throw error;
  }
};


