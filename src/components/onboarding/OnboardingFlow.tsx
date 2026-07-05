import { useAuth } from '@/auth';
import FirstProfileSetup, { ProfileStepData } from '@/components/FirstProfileSetup';
import PaywallModal from '@/components/PaywallModal';
import AnalyzingStep from '@/components/onboarding/AnalyzingStep';
import CommitmentStep from '@/components/onboarding/CommitmentStep';
import PlanPreviewStep from '@/components/onboarding/PlanPreviewStep';
import QuizStep from '@/components/onboarding/QuizStep';
import ResultsStep from '@/components/onboarding/ResultsStep';
import { ensurePermission, getReminderSettings, setReminderSettings, syncReminders } from '@/notifications';
import { monthlyLossFromAnswer, QuizAnswers } from '@/onboardingQuiz';
import { loadData, saveData, setBaselineMonthlySpend } from '@/storage';
import { useEffect, useState } from 'react';
import { View } from 'react-native';

// The QUITTR-style "hot moment" funnel that runs while user.profileComplete === false:
// profile → quiz → analyzing → results → plan preview → commitment → paywall.
// profileComplete is only flipped to true when the paywall is dismissed, so _layout keeps this
// component mounted through the paywall (setting it earlier would unmount us mid-flow).
const STEP = { PROFILE: 0, QUIZ: 1, ANALYZING: 2, RESULTS: 3, PLAN: 4, COMMIT: 5, PAYWALL: 6 } as const;

export default function OnboardingFlow() {
  const { updateProfile } = useAuth();
  const [ready, setReady] = useState(false);
  const [step, setStep] = useState<number>(STEP.PROFILE);
  const [profile, setProfile] = useState<ProfileStepData | null>(null);
  const [answers, setAnswers] = useState<QuizAnswers>({});

  // Resume guard: if the quiz was already finished last session (user quit ON the paywall), jump
  // straight back to the paywall instead of re-asking everything.
  useEffect(() => {
    let active = true;
    loadData('quizAnswers')
      .then((raw) => {
        if (!active) return;
        if (raw) {
          try {
            setAnswers(JSON.parse(raw));
            setStep(STEP.PAYWALL);
          } catch {
            // malformed — just start fresh
          }
        }
        setReady(true);
      })
      .catch(() => active && setReady(true));
    return () => {
      active = false;
    };
  }, []);

  // Persist everything AFTER the commitment, right before the paywall. Does NOT set profileComplete.
  async function finalizeBeforePaywall(finalAnswers: QuizAnswers) {
    const p = profile;
    if (p) {
      await saveData('quitStartDate', p.quitStartDate);
      if (p.whyQuit) await saveData('whyQuit', p.whyQuit);
      if (p.birthday) await saveData('birthday', p.birthday);
    }
    // Quiz → money baseline (省钱计数器).
    await setBaselineMonthlySpend(monthlyLossFromAnswer(finalAnswers));
    await saveData('quizAnswers', JSON.stringify(finalAnswers));
    // Name/avatar now (but not profileComplete — see comment above).
    if (p) await updateProfile({ displayName: p.name, avatarUri: p.avatarUri });
    // Reminders are a best-effort side effect — a permission/scheduling error must never abort the
    // funnel (it would strand the user on the commitment screen right before the paywall).
    try {
      const triggers = Array.isArray(finalAnswers.triggers) ? (finalAnswers.triggers as string[]) : [];
      if (triggers.includes('payday')) {
        const settings = await getReminderSettings();
        await setReminderSettings({ ...settings, paydayEnabled: true });
      }
      await ensurePermission();
      await syncReminders();
    } catch (error) {
      console.warn('[onboarding] reminder setup skipped:', error);
    }
  }

  async function completeOnboarding() {
    await updateProfile({ profileComplete: true }); // _layout swaps to the main app
  }

  if (!ready) return <View style={{ flex: 1, backgroundColor: '#F8FAF7' }} />;

  const monthlyLoss = monthlyLossFromAnswer(answers);
  const name = profile?.name || '';
  const motivation = typeof answers.motivation === 'string' ? answers.motivation : '';

  switch (step) {
    case STEP.PROFILE:
      return <FirstProfileSetup onComplete={(d) => { setProfile(d); setStep(STEP.QUIZ); }} />;
    case STEP.QUIZ:
      return <QuizStep onComplete={(a) => { setAnswers(a); setStep(STEP.ANALYZING); }} />;
    case STEP.ANALYZING:
      return <AnalyzingStep onDone={() => setStep(STEP.RESULTS)} />;
    case STEP.RESULTS:
      return <ResultsStep answers={answers} onNext={() => setStep(STEP.PLAN)} />;
    case STEP.PLAN:
      return <PlanPreviewStep answers={answers} onNext={() => setStep(STEP.COMMIT)} />;
    case STEP.COMMIT:
      return (
        <CommitmentStep
          name={name}
          motivation={motivation}
          onComplete={async () => {
            // finally: a failure while persisting must still advance to the paywall, otherwise the
            // commitment button locks (done.current) and the user is stranded for the session.
            try {
              await finalizeBeforePaywall(answers);
            } finally {
              setStep(STEP.PAYWALL);
            }
          }}
        />
      );
    case STEP.PAYWALL:
    default:
      return (
        <View style={{ flex: 1, backgroundColor: '#F8FAF7' }}>
          <PaywallModal
            visible
            defaultPlan="LIFETIME"
            onboardingPrompt
            monthlyLoss={monthlyLoss}
            onClose={completeOnboarding}
            onSuccess={completeOnboarding}
          />
        </View>
      );
  }
}
