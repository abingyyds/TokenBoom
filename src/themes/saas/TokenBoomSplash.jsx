import React, { useEffect, useState } from 'react';
import tokenBoomLogo from '../../assets/tokenboomai-logo.png';

export default function TokenBoomSplash() {
  const [visible, setVisible] = useState(() => {
    if (typeof window === 'undefined') return false;
    return !window.sessionStorage.getItem('tokenboom-splash-seen');
  });
  const [leaving, setLeaving] = useState(false);

  useEffect(() => {
    if (!visible || typeof window === 'undefined') return undefined;
    window.sessionStorage.setItem('tokenboom-splash-seen', 'true');
    const leaveTimer = window.setTimeout(() => setLeaving(true), 1420);
    const hideTimer = window.setTimeout(() => setVisible(false), 1880);

    return () => {
      window.clearTimeout(leaveTimer);
      window.clearTimeout(hideTimer);
    };
  }, [visible]);

  if (!visible) return null;

  return (
    <div className={`tokenboom-splash ${leaving ? 'tokenboom-splash--leaving' : ''}`}>
      <div className="tokenboom-splash__grid" />
      <div className="tokenboom-splash__blast" />
      <div className="tokenboom-splash__coin">
        <img src={tokenBoomLogo} alt="TokenBoomAi" />
      </div>
      <div className="tokenboom-splash__title">TokenBoomAi</div>
      <div className="tokenboom-splash__subtitle">TOKENS LOADED. MODELS READY.</div>
      <div className="tokenboom-splash__fuse">
        <span />
      </div>
    </div>
  );
}
