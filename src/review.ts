import * as StoreReview from 'expo-store-review';
import { loadData, saveData } from './storage';

// App Store rating prompts are a scarce resource: Apple silently caps them at ~3 per user per year,
// so a prompt shown at a bad moment is gone forever. We only ask at genuine high points (a streak
// milestone, a resisted urge) and only once per trigger, ever. Never let it interrupt or throw.
export async function maybeAskReview(key: string) {
  try {
    if (await loadData(key)) return;
    if (!(await StoreReview.hasAction())) return;
    await saveData(key, '1');
    await StoreReview.requestReview();
  } catch {
    // A rating prompt must never break the flow it's celebrating.
  }
}

export const REVIEW_STREAK_7 = 'review_asked_streak7';
export const REVIEW_URGE_RESISTED = 'review_asked_urge';
