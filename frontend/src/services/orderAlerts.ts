/**
 * orderAlerts.ts — "Shopping finished" alerts (in-app alert + LOCAL notification)
 *
 * Remote push does not work in Expo Go on Android (SDK 53+), so the app polls the order
 * and fires a local notification when the cart is done.
 *
 * TODO(push): to add remote push later (development build required):
 *   1. After login, call Notifications.getExpoPushTokenAsync({ projectId }) and send the token
 *      to the backend (e.g. PATCH /api/users/me { push_token }) -> store it in a User.push_token column.
 *   2. In backend order_status.set_order_status(), send an Expo push when the order completes.
 */
import { Alert, Platform } from 'react-native';
import type * as NotificationsModule from 'expo-notifications';
import { Order } from '../api/apiService';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { claimOrderAlert } from './orderStorage';
import { formatCartLabel, formatTime, getShoppingState, isShoppingFinished, parseServerDate } from '../utils/orderFormat';

// Only the LOCAL-notification parts of expo-notifications. The package index also loads the
// remote-push topic module (ExpoTopicSubscriptionModule), which does not exist in Expo Go on
// Android (SDK 53+) and throws "Cannot find native module". Importing these files directly avoids it.
type LocalNotificationsApi = Pick<
  typeof NotificationsModule,
  | 'setNotificationHandler'
  | 'setNotificationChannelAsync'
  | 'getPermissionsAsync'
  | 'requestPermissionsAsync'
  | 'scheduleNotificationAsync'
  | 'cancelScheduledNotificationAsync'
  | 'AndroidImportance'
  | 'SchedulableTriggerInputTypes'
>;

let Notifications: LocalNotificationsApi | null = null;
let notificationsUnavailable = false; // remember a failed load so it is not retried (and logged) every call
let configured = false;

const PICKUP_REMINDER_KIND = 'pickup_eta';
const reminderKey = (orderId: number) => `cartmate_pickup_reminder_${orderId}`;

const loadNotifications = (): LocalNotificationsApi | null => {
  if (Platform.OS === 'web' || notificationsUnavailable) return null;
  if (!Notifications) {
    try {
      Notifications = {
        ...require('expo-notifications/build/NotificationsHandler'),
        ...require('expo-notifications/build/NotificationPermissions'),
        ...require('expo-notifications/build/setNotificationChannelAsync'),
        ...require('expo-notifications/build/scheduleNotificationAsync'),
        ...require('expo-notifications/build/cancelScheduledNotificationAsync'),
        ...require('expo-notifications/build/NotificationChannelManager.types'),
        ...require('expo-notifications/build/Notifications.types'),
      } as LocalNotificationsApi;
    } catch (err) {
      notificationsUnavailable = true;
      console.warn('[CartMate] Local notifications unavailable; in-app alerts only.', err);
      return null;
    }
  }
  return Notifications;
};

const configureNotifications = async () => {
  const N = loadNotifications();
  if (!N || configured) return N;
  configured = true;
  try {
    N.setNotificationHandler({
      handleNotification: async (notification) => {
        // While the app is open, the pickup-time reminder is shown as an in-app alert instead
        const isPickupReminder = notification.request.content.data?.kind === PICKUP_REMINDER_KIND;
        return {
          shouldShowBanner: !isPickupReminder,
          shouldShowList: true,
          shouldPlaySound: !isPickupReminder,
          shouldSetBadge: false,
        };
      },
    });
    if (Platform.OS === 'android') {
      await N.setNotificationChannelAsync('order-updates', {
        name: 'Order updates',
        importance: N.AndroidImportance.HIGH,
      });
    }
  } catch (err) {
    console.warn('[CartMate] Notification setup failed', err);
  }
  return N;
};

/** Asks for notification permission (no-op if already decided). Safe to call often. */
export const requestNotificationPermission = async (): Promise<boolean> => {
  try {
    const N = await configureNotifications();
    if (!N) return false;
    const current = await N.getPermissionsAsync();
    if (current.granted) return true;
    if (!current.canAskAgain) return false;
    const requested = await N.requestPermissionsAsync();
    return requested.granted;
  } catch (err) {
    console.warn('[CartMate] Notification permission request failed', err);
    return false;
  }
};

const sendLocalNotification = async (title: string, body: string) => {
  try {
    const N = await configureNotifications();
    if (!N || !(await requestNotificationPermission())) return;
    await N.scheduleNotificationAsync({
      content: { title, body, sound: true },
      trigger: Platform.OS === 'android' ? { channelId: 'order-updates' } : null,
    });
  } catch (err) {
    console.warn('[CartMate] Local notification failed', err);
  }
};

const showInAppAlert = (title: string, message: string) => {
  if (Platform.OS === 'web') {
    alert(`${title}\n\n${message}`);
  } else {
    Alert.alert(title, message);
  }
};

/**
 * Shows the alert + local notification when order.shopping_state becomes completed / needs_attention,
 * once per order and state
 * (remembered in AsyncStorage). Returns true when an alert was shown.
 */
export const alertOrderStatusOnce = async (order: Order): Promise<boolean> => {
  const state = getShoppingState(order);
  let title: string;
  let message: string;
  if (state === 'completed') {
    const cart = formatCartLabel(order.cart_id);
    title = 'Your shopping is finished!';
    message = `Your shopping is finished, go to ${cart} and match your OTP.`;
  } else if (state === 'needs_attention') {
    title = 'Order needs attention';
    message = 'Some items could not be collected, please see staff.';
  } else {
    return false;
  }

  cancelPickupReminder(order.id); // the estimate reminder is no longer needed
  if (!(await claimOrderAlert(order.id, state))) return false;
  showInAppAlert(title, message);
  await sendLocalNotification(title, message);
  return true;
};

// ─────────────────────────────────────────────────────────────────────────────
// Estimated pickup time reminder
// A local notification is scheduled for order.pickup_eta so it arrives even when the app
// is closed. It is cancelled once shopping finishes (the "finished" alert replaces it).
// ─────────────────────────────────────────────────────────────────────────────
interface StoredReminder {
  id: string;
  eta: string;
}

export const cancelPickupReminder = async (orderId: number) => {
  try {
    const raw = await AsyncStorage.getItem(reminderKey(orderId));
    if (!raw) return;
    await AsyncStorage.removeItem(reminderKey(orderId));
    const N = loadNotifications();
    if (N) await N.cancelScheduledNotificationAsync((JSON.parse(raw) as StoredReminder).id);
  } catch (err) {
    console.warn('[CartMate] Could not cancel pickup reminder', err);
  }
};

/** Schedules (or re-schedules when the estimate changed) the reminder for a paid, unfinished order. */
export const schedulePickupReminder = async (order: Order) => {
  try {
    const eta = parseServerDate(order.pickup_eta);
    if (order.payment_status !== 'paid' || isShoppingFinished(getShoppingState(order))) {
      await cancelPickupReminder(order.id);
      return;
    }
    if (!eta || eta.getTime() <= Date.now() || !order.pickup_eta) return;

    const raw = await AsyncStorage.getItem(reminderKey(order.id));
    if (raw && (JSON.parse(raw) as StoredReminder).eta === order.pickup_eta) return; // already scheduled
    if (raw) await cancelPickupReminder(order.id);

    const N = await configureNotifications();
    if (!N || !(await requestNotificationPermission())) return;
    const id = await N.scheduleNotificationAsync({
      content: {
        title: 'Your order is ready to pick up',
        body: `It is ${formatTime(order.pickup_eta)}. Go to ${formatCartLabel(order.cart_id)} and match your OTP.`,
        sound: true,
        data: { kind: PICKUP_REMINDER_KIND, orderId: order.id },
      },
      trigger: {
        type: N.SchedulableTriggerInputTypes.DATE,
        date: eta,
        ...(Platform.OS === 'android' ? { channelId: 'order-updates' } : {}),
      },
    });
    await AsyncStorage.setItem(reminderKey(order.id), JSON.stringify({ id, eta: order.pickup_eta } as StoredReminder));
  } catch (err) {
    console.warn('[CartMate] Could not schedule pickup reminder', err);
  }
};

/**
 * In-app alert when the estimated pickup time passes while the screen is open (once per order).
 * The message depends on what the cart is doing at that moment.
 */
export const alertPickupTimePassedOnce = async (order: Order): Promise<boolean> => {
  const state = getShoppingState(order);
  if (order.payment_status !== 'paid' || isShoppingFinished(state)) return false;
  if (!(await claimOrderAlert(order.id, 'eta_passed'))) return false;
  const cart = formatCartLabel(order.cart_id);
  showInAppAlert(
    'Your order is ready to pick up',
    `Your estimated pickup time (${formatTime(order.pickup_eta)}) has passed. Go to ${cart} and match your OTP.`
  );
  return true;
};
