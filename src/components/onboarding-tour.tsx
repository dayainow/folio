/**
 * @deprecated Prefer WelcomeModal — 호환용 래퍼
 */
'use client'

export {
  WelcomeModal as OnboardingTour,
  hasSeenWelcome as isOnboardingDone,
  markWelcomeSeen as markOnboardingDone,
  resetWelcomeSeen as resetOnboarding,
} from '@/components/welcome-modal'
