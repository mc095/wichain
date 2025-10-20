import { useEffect, useState } from 'react';

export function TauriDebug() {
  const [debugInfo, setDebugInfo] = useState<any>({});

  useEffect(() => {
    const info: any = {
      platform: navigator.platform,
      userAgent: navigator.userAgent,
      windowTauri: typeof (window as any).__TAURI__,
      windowTauriInternals: typeof (window as any).__TAURI_INTERNALS__,
      windowCapacitor: typeof (window as any).Capacitor,
      tauriAvailable: false,
      tauriCoreAvailable: false,
      tauriInvokeAvailable: false,
    };

    if ((window as any).__TAURI__) {
      info.tauriAvailable = true;
      info.tauriCore = typeof (window as any).__TAURI__.core;
      info.tauriCoreAvailable = !!((window as any).__TAURI__.core);
      
      if ((window as any).__TAURI__.core) {
        info.tauriInvoke = typeof (window as any).__TAURI__.core.invoke;
        info.tauriInvokeAvailable = typeof (window as any).__TAURI__.core.invoke === 'function';
      }
    }

    setDebugInfo(info);
    console.log('🔍 Tauri Debug Info:', info);
  }, []);

  return (
    <div className="fixed bottom-4 left-4 bg-black/90 text-white p-4 rounded-lg text-xs font-mono max-w-sm z-[10000] border border-white/20">
      <h3 className="font-bold mb-2">🔍 Debug Info</h3>
      
      <div className="space-y-1">
        <div>Platform: {debugInfo.platform}</div>
        <div>UA: {debugInfo.userAgent?.substring(0, 30)}...</div>
        <div>
          Tauri: {debugInfo.tauriAvailable ? '✅ Loaded' : '❌ Not Loaded'}
        </div>
        <div>
          Tauri Core: {debugInfo.tauriCoreAvailable ? '✅' : '❌'}
        </div>
        <div>
          Tauri Invoke: {debugInfo.tauriInvokeAvailable ? '✅' : '❌'}
        </div>
        <div>
          Capacitor: {debugInfo.windowCapacitor !== 'undefined' ? '✅' : '❌'}
        </div>
      </div>

      <div className="mt-2 pt-2 border-t border-white/20">
        {debugInfo.tauriInvokeAvailable ? (
          <div className="text-green-400">✅ Backend should work!</div>
        ) : (
          <div className="text-red-400">❌ Backend won't work!</div>
        )}
      </div>
    </div>
  );
}
