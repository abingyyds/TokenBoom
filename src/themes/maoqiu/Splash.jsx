import React, { useEffect, useState } from 'react';
import tokenBoomLogo from '../../assets/tokenboomai-logo.png';

export default function MaoqiuSplash() {
  const [visible, setVisible] = useState(true);
  const [leaving, setLeaving] = useState(false);

  useEffect(() => {
    const leaveTimer = window.setTimeout(() => setLeaving(true), 1450);
    const hideTimer = window.setTimeout(() => setVisible(false), 2000);

    return () => {
      window.clearTimeout(leaveTimer);
      window.clearTimeout(hideTimer);
    };
  }, []);

  if (!visible) return null;

  return (
    <div className={`maoqiu-splash ${leaving ? 'maoqiu-splash--leaving' : ''}`}>
      <div className="maoqiu-splash__halo" />
      <div className="maoqiu-splash__mark">
        <img src={tokenBoomLogo} alt="TokenBoomAi" />
      </div>
      <div className="maoqiu-splash__title">TokenBoom</div>
      <div className="maoqiu-splash__subtitle">Tokens, models, and controlled blast</div>
      <div className="maoqiu-splash__beam" />
    </div>
  );
}
