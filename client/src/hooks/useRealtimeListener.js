import { useState, useEffect } from 'react';
import { db } from '../firebase/config';
import { ref, onValue, query, orderByChild } from 'firebase/database';

/**
 * Reusable React Hook for listening to a Firebase Realtime Database path in Realtime.
 * 
 * @param {string} path - The database path (e.g., 'products', 'orders', 'coupons')
 * @param {string} [orderByField] - Optional child key to order by
 * @param {'asc'|'desc'} [direction='desc'] - Sorting direction
 * @returns {object} { data, loading, error }
 */
export const useRealtimeListener = (path, orderByField = null, direction = 'desc') => {
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!path) {
      setData([]);
      setLoading(false);
      setError(null);
      return;
    }

    setLoading(true);
    setError(null);

    const dbRef = ref(db, path);
    let q = dbRef;
    
    if (orderByField) {
      q = query(dbRef, orderByChild(orderByField));
    }

    const handleData = (snapshot) => {
      const items = [];
      snapshot.forEach((childSnapshot) => {
        items.push({ id: childSnapshot.key, ...childSnapshot.val() });
      });
      
      // Since RTDB returns in ascending order, if we want desc, we reverse it
      if (direction === 'desc') {
        items.reverse();
      }
      
      setData(items);
      setLoading(false);
    };

    const handleError = (err) => {
      console.error(`useRealtimeListener Error on RTDB path [${path}]:`, err);
      setError(err);
      setLoading(false);
    };

    const unsubscribe = onValue(q, handleData, handleError);

    return unsubscribe;
  }, [path, orderByField, direction]);

  return { data, loading, error };
};

export default useRealtimeListener;

