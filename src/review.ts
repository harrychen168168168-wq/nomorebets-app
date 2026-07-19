import * as StoreReview from 'expo-store-review';
import { loadData, saveData } from './storage';

// App Store rating prompts are a scarce resource: Apple silently caps them at ~3 per user per year,
// so a prompt shown at a bad moment is gone forever. We only ask at genuine high points (a streak
// milestone, a resisted urge) and only once per trigger, ever. Never let it interrupt or throw.
export async function maybeAskReview(key: string) {
  try {
    if (await loadData(key)) return;
    if (!(await StoreReview.hasAction())) return;
    // Persist only after the prompt actually went up: if requestReview throws, the outer catch
    // swallows it, and burning the flag first would spend one of the ~3 yearly asks on a prompt
    // the user never saw.
    await StoreReview.requestReview();
    await saveData(key, '1');
  } catch {
    // A rating prompt must never break the flow it's celebrating.
  }
}

export const REVIEW_STREAK_7 = 'review_asked_streak7';
export const REVIEW_URGE_RESISTED = 'review_asked_urge';
