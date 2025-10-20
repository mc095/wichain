// Mobile platform detection and Tauri availability check

export const isMobilePlatform = (): boolean => {
  // Check for Capacitor (Capacitor apps) OR check user agent for mobile
  if (typeof (window as any).Capacitor !== 'undefined') return true;
  
  // Check if running on mobile device (Android/iOS)
  const ua = navigator.userAgent || navigator.vendor || (window as any).opera;
  return /android|iphone|ipad|ipod/i.test(ua);
};

export const isTauriAvailable = (): boolean => {
  return typeof (window as any).__TAURI__ !== 'undefined';
};

// Safe Tauri imports that won't break on mobile
export const safeTauriListen = isTauriAvailable() 
  ? require('@tauri-apps/api/event').listen 
  : null;

export const safeTauriInvoke = isTauriAvailable()
  ? require('@tauri-apps/api/core').invoke
  : null;

// Mock identity for mobile (temporary until backend is connected)
export const getMockIdentity = () => ({
  alias: 'Mobile-User-' + Math.random().toString(36).substr(2, 6),
  private_key_b64: '',
  public_key_b64: 'mobile-' + Date.now(),
});

// Check if we should show onboarding
export const shouldShowOnboarding = (alias: string): boolean => {
  // Check localStorage first (for any platform)
  if (localStorage.getItem('onboarding_completed')) {
    return false;
  }
  
  // On mobile, check mobile-specific flag
  if (isMobilePlatform()) {
    return !localStorage.getItem('mobile_onboarding_done');
  }
  
  // On desktop, show if alias is anonymous
  return alias.startsWith('Anon-');
};

// Mark onboarding as complete
export const markOnboardingComplete = () => {
  // Save for ALL platforms
  localStorage.setItem('onboarding_completed', 'true');
  
  // Also save mobile-specific flag
  if (isMobilePlatform()) {
    localStorage.setItem('mobile_onboarding_done', 'true');
  }
};
