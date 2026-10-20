/**
 * orderStorage.ts — Remembers which order alerts were already shown (AsyncStorage)
 *
 * The pickup OTP is NOT stored on the device: it is fetched from GET /api/orders/<id>/otp.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';

const alertKey = (orderId: number, state: string) => `cartmate_alerted_${orderId}_${state}`;

/** Returns true the first time it is called for an order + state, false afterwards. */
export const claimOrderAlert = async (orderId: number, state: string): Promise<boolean> => {
  try {
    const key = alertKey(orderId, state);
    if (await AsyncStorage.getItem(key)) return false;
    await AsyncStorage.setItem(key, new Date().toISOString());
    return true;
  } catch {
    return true; // Storage unavailable: prefer alerting over silently dropping it
  }
};
