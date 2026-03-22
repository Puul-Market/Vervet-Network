/* ═══════════════════════════════════════════════════
   Vervet Network — Interactive Demo
   Same visual design as the animated demo, but the
   user drives every step.
   ═══════════════════════════════════════════════════ */

(function () {
  'use strict';

  /* ── Simulated verification data pool ── */
  const VERIFICATION_DATA = {
    '0x': [
      { platform: 'Trust Wallet', recipient: 'T*** A.', walletType: 'Personal wallet', badge: 'T', gradient: 'linear-gradient(135deg,#0500FF,#06d6a0)' },
      { platform: 'MetaMask', recipient: 'J*** K.', walletType: 'Personal wallet', badge: 'M', gradient: 'linear-gradient(135deg,#f5841f,#e2761b)' },
      { platform: 'Coinbase Wallet', recipient: 'S*** R.', walletType: 'Self-custody', badge: 'C', gradient: 'linear-gradient(135deg,#0052ff,#4d90fe)' },
    ],
    'bc1': [
      { platform: 'BlueWallet', recipient: 'R*** M.', walletType: 'Personal wallet', badge: 'B', gradient: 'linear-gradient(135deg,#1b6bff,#3d8bfd)' },
    ],
    'T': [
      { platform: 'Binance', recipient: 'A*** L.', walletType: 'Exchange wallet', badge: 'B', gradient: 'linear-gradient(135deg,#f0b90b,#d4a50a)' },
    ],
    'default': [
      { platform: 'Trust Wallet', recipient: 'V*** N.', walletType: 'Personal wallet', badge: 'T', gradient: 'linear-gradient(135deg,#0500FF,#06d6a0)' },
    ],
  };

  function getVerifData(address) {
    const addr = (address || '').trim();
    if (addr.startsWith('0x')) return VERIFICATION_DATA['0x'][Math.floor(Math.random() * VERIFICATION_DATA['0x'].length)];
    if (addr.startsWith('bc1')) return VERIFICATION_DATA['bc1'][0];
    if (addr.startsWith('T')) return VERIFICATION_DATA['T'][0];
    return VERIFICATION_DATA['default'][0];
  }

  /* ── Assets / Networks ── */
  const ASSETS = [
    { symbol: 'USDC', name: 'USD Coin', color: '#2775ca', gradient: 'linear-gradient(135deg,#2775ca,#3b99fc)', icon: '$' },
    { symbol: 'USDT', name: 'Tether', color: '#26a17b', gradient: 'linear-gradient(135deg,#26a17b,#50d9a0)', icon: '₮' },
    { symbol: 'ETH', name: 'Ethereum', color: '#627eea', gradient: 'linear-gradient(135deg,#627eea,#8fa8ff)', icon: 'Ξ' },
    { symbol: 'BTC', name: 'Bitcoin', color: '#f7931a', gradient: 'linear-gradient(135deg,#f7931a,#ffc04d)', icon: '₿' },
  ];

  const NETWORKS = [
    { name: 'Base', color: '#0052ff', icon: '◎' },
    { name: 'Ethereum', color: '#627eea', icon: 'Ξ' },
    { name: 'Polygon', color: '#8247e5', icon: '⬡' },
    { name: 'Solana', color: '#9945ff', icon: '◉' },
    { name: 'Arbitrum', color: '#28a0f0', icon: 'A' },
  ];

  /* ── CSS keyframes ── */
  const style = document.createElement('style');
  style.textContent = `
    @keyframes idemo-float   { 0%,100%{transform:scale(1)}   50%{transform:scale(1.15)} }
    @keyframes idemo-fade-in { from{opacity:0} to{opacity:1} }
    @keyframes idemo-slide-up{ from{opacity:0;transform:translateY(16px)} to{opacity:1;transform:translateY(0)} }
    @keyframes idemo-fade-in-scale{ from{opacity:0;transform:scale(0.92)} to{opacity:1;transform:scale(1)} }
    @keyframes idemo-blink   { 0%,100%{opacity:1} 50%{opacity:0} }
    @keyframes idemo-spin    { to{transform:rotate(360deg)} }
    @keyframes idemo-pulse   { 0%,100%{opacity:0.4;transform:scale(1)} 50%{opacity:0.8;transform:scale(1.4)} }
    @keyframes idemo-ring    { from{opacity:0;transform:scale(0.5)} to{opacity:1;transform:scale(1)} }
    @keyframes idemo-check   { from{transform:scale(0.4);opacity:0} to{transform:scale(1);opacity:1} }
    @keyframes idemo-shimmer { from{background-position:-200% 0} to{background-position:200% 0} }

    .idemo-input {
      width:100%; box-sizing:border-box;
      background:transparent; border:none; outline:none;
      color:#fff; font-size:16px; font-weight:600;
      font-family:'Space Grotesk',-apple-system,sans-serif;
      padding:0; margin:0;
    }
    .idemo-input::placeholder { color:rgba(255,255,255,0.15); font-weight:500; }
    .idemo-input-mono {
      width:100%; box-sizing:border-box;
      background:transparent; border:none; outline:none;
      color:#fff; font-size:13px; font-weight:500;
      font-family:'IBM Plex Mono','SF Mono',monospace;
      letter-spacing:-0.02em;
      padding:0; margin:0; word-break:break-all;
    }
    .idemo-input-mono::placeholder { color:rgba(255,255,255,0.15); font-family:-apple-system,sans-serif; }

    .idemo-select-item {
      display:flex; align-items:center; gap:10px;
      padding:12px 16px; cursor:pointer;
      transition: background 0.15s ease;
      border-bottom:1px solid rgba(255,255,255,0.04);
    }
    .idemo-select-item:hover { background:rgba(255,255,255,0.06); }
    .idemo-select-item:last-child { border-bottom:none; }
  `;
  document.head.appendChild(style);

  /* ── mount ── */
  const mount = document.getElementById('interactive-demo-mount');
  if (!mount) return;

  /* ── helpers ── */
  function el(tag, css, children) {
    const e = document.createElement(tag);
    if (css) Object.assign(e.style, css);
    if (typeof children === 'string') e.innerHTML = children;
    else if (Array.isArray(children)) children.forEach(c => c && e.appendChild(c));
    else if (children) e.appendChild(children);
    return e;
  }

  function wait(ms) { return new Promise(r => setTimeout(r, ms)); }

  /* ── state ── */
  let selectedAsset = null;   // { symbol, name, color, gradient, icon }
  let amount = '';
  let selectedNetwork = null; // { name, color, icon }
  let address = '';
  let verifData = null;       // from getVerifData
  let phase = 'form';         // form | dropdown-asset | dropdown-network | inferring | verifying | verified | sending | success
  let inferredPlatform = null;

  /* ── phone shell ── */
  const phone = el('div', {
    position: 'relative', width: '320px', height: '660px',
    borderRadius: '48px',
    background: 'linear-gradient(145deg, #111827 0%, #0a0f1c 50%, #080c14 100%)',
    border: '1px solid rgba(255,255,255,0.08)',
    boxShadow: '0 0 0 1px rgba(255,255,255,0.04), 0 60px 120px rgba(0,0,0,0.8), 0 0 100px rgba(52,211,153,0.04)',
    overflow: 'hidden', userSelect: 'none',
    fontFamily: "'Space Grotesk', -apple-system, sans-serif",
  });

  /* dynamic island */
  const island = el('div', {
    position: 'absolute', top: '12px', left: '50%', transform: 'translateX(-50%)',
    width: '100px', height: '28px', borderRadius: '20px',
    background: '#000', zIndex: '50',
  }, el('div', {
    position: 'absolute', top: '50%', right: '22px', transform: 'translateY(-50%)',
    width: '8px', height: '8px', borderRadius: '50%',
    background: 'radial-gradient(circle at 35% 35%, #1e293b, #0f172a)',
    border: '1px solid rgba(52,211,153,0.08)',
  }));
  phone.appendChild(island);

  /* status bar */
  function getClock() { return new Date().toLocaleTimeString([], { hour: 'numeric', minute: '2-digit', hour12: false }); }
  const clockSpan = el('span', { fontSize: '13px', fontWeight: '600', color: 'rgba(255,255,255,0.7)', letterSpacing: '0.02em' });
  clockSpan.textContent = getClock();
  setInterval(() => { clockSpan.textContent = getClock(); }, 10000);

  const statusBar = el('div', {
    position: 'absolute', top: '14px', left: '0', right: '0',
    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
    padding: '0 28px', zIndex: '40',
  }, [
    clockSpan,
    el('div', { display: 'flex', alignItems: 'center', gap: '6px' }, `
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.5)" stroke-width="2"><path d="M2 20h.01"/><path d="M7 20v-4"/><path d="M12 20v-8"/><path d="M17 20V8"/></svg>
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.5)" stroke-width="2"><path d="M5 12.55a11 11 0 0 1 14.08 0"/><path d="M1.42 9a16 16 0 0 1 21.16 0"/><path d="M8.53 16.11a6 6 0 0 1 6.95 0"/><line x1="12" y1="20" x2="12.01" y2="20"/></svg>
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none"><rect x="2" y="7" width="16" height="10" rx="2" stroke="rgba(255,255,255,0.5)" stroke-width="1.5"/><rect x="4" y="9" width="10" height="6" rx="1" fill="rgba(52,211,153,0.6)"/><path d="M20 10v4a1 1 0 0 0 1-1v-2a1 1 0 0 0-1-1z" fill="rgba(255,255,255,0.3)"/></svg>
    `),
  ]);
  phone.appendChild(statusBar);

  /* screen area */
  const screen = el('div', {
    position: 'absolute', top: '0', left: '0', right: '0', bottom: '0',
    overflow: 'hidden',
  });

  /* ambient orbs */
  screen.appendChild(el('div', {
    position: 'absolute', top: '-15%', left: '-25%', width: '380px', height: '380px',
    background: 'radial-gradient(circle, rgba(6,182,212,0.12) 0%, transparent 70%)',
    borderRadius: '50%', animation: 'idemo-float 8s ease-in-out infinite', pointerEvents: 'none',
  }));
  screen.appendChild(el('div', {
    position: 'absolute', bottom: '-15%', right: '-25%', width: '450px', height: '450px',
    background: 'radial-gradient(circle, rgba(52,211,153,0.10) 0%, transparent 70%)',
    borderRadius: '50%', animation: 'idemo-float 10s ease-in-out infinite 2s', pointerEvents: 'none',
  }));
  screen.appendChild(el('div', {
    position: 'absolute', inset: '0',
    background: 'rgba(3,7,18,0.35)', backdropFilter: 'blur(80px)', pointerEvents: 'none',
  }));

  /* content container */
  const content = el('div', {
    position: 'relative', zIndex: '10', height: '100%',
    display: 'flex', flexDirection: 'column', paddingTop: '60px',
  });
  screen.appendChild(content);
  phone.appendChild(screen);

  /* home indicator */
  phone.appendChild(el('div', {
    position: 'absolute', bottom: '8px', left: '50%', transform: 'translateX(-50%)',
    width: '120px', height: '4px', borderRadius: '100px',
    background: 'rgba(255,255,255,0.15)', zIndex: '50',
  }));

  mount.appendChild(phone);

  /* ── shared styles ── */
  const labelStyle = {
    color: 'rgba(255,255,255,0.35)', fontSize: '10px', fontWeight: '700',
    textTransform: 'uppercase', letterSpacing: '0.15em', margin: '0 0 6px 4px',
  };

  const chevronDown = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.4)" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="6 9 12 15 18 9"/></svg>`;

  function chipStyle(active, filled) {
    return {
      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      padding: '14px 16px',
      background: filled ? 'rgba(52,211,153,0.08)' : active ? 'rgba(9,14,26,0.9)' : 'rgba(9,14,26,0.6)',
      border: '1px solid ' + (filled ? 'rgba(52,211,153,0.25)' : active ? 'rgba(6,182,212,0.5)' : 'rgba(255,255,255,0.06)'),
      borderRadius: '16px', transition: 'all 0.3s ease', cursor: 'pointer',
      boxShadow: active ? '0 0 0 3px rgba(6,182,212,0.06)' : 'none',
    };
  }

  function inputBoxStyle(focused) {
    return {
      position: 'relative', background: 'rgba(9,14,26,0.8)', backdropFilter: 'blur(20px)',
      border: '1px solid ' + (focused ? 'rgba(6,182,212,0.5)' : 'rgba(255,255,255,0.08)'),
      borderRadius: '16px', overflow: 'hidden', transition: 'border-color 0.3s ease',
      boxShadow: focused ? '0 0 0 3px rgba(6,182,212,0.08)' : 'inset 0 1px 3px rgba(0,0,0,0.3)',
    };
  }

  /* ── form ready check ── */
  function isFormComplete() {
    return selectedAsset && amount.trim() && selectedNetwork && address.trim().length >= 8;
  }

  /* ── live-update CTA button without full re-render ── */
  function updateButton() {
    const btn = document.getElementById('idemo-cta-btn');
    if (!btn) return;
    const ready = isFormComplete();
    btn.style.background = ready ? '#fff' : 'rgba(255,255,255,0.06)';
    btn.style.color = ready ? '#000' : 'rgba(255,255,255,0.2)';
    btn.style.cursor = ready ? 'pointer' : 'default';
    btn.style.opacity = ready ? '1' : '0.5';
  }

  /* ── render ── */
  function render() {
    content.innerHTML = '';

    if (phase === 'success') { renderSuccess(); return; }
    if (phase === 'dropdown-asset') { renderDropdown('asset'); return; }
    if (phase === 'dropdown-network') { renderDropdown('network'); return; }

    const form = el('div', { display: 'flex', flexDirection: 'column', height: '100%', animation: 'idemo-fade-in 0.3s ease-out' });

    /* top line */
    form.appendChild(el('div', { height: '1px', background: 'linear-gradient(90deg, transparent, rgba(255,255,255,0.15), transparent)' }));

    /* header */
    const hdr = el('div', { display: 'flex', alignItems: 'center', padding: '10px 20px 0', marginBottom: '20px' });
    hdr.appendChild(el('div', { padding: '6px', cursor: 'pointer', opacity: '0.5' }, `<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.5)" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="15 18 9 12 15 6"/></svg>`));
    hdr.appendChild(el('div', { flex: '1', textAlign: 'center', color: 'rgba(255,255,255,0.9)', fontSize: '17px', fontWeight: '600', letterSpacing: '0.02em' }, 'Send Crypto'));
    hdr.appendChild(el('div', { width: '36px' }));
    form.appendChild(hdr);

    /* scrollable */
    const scroll = el('div', { padding: '0 20px', display: 'flex', flexDirection: 'column', gap: '12px', flex: '1', overflowY: 'auto', paddingBottom: '40px' });

    /* ─── Asset selector ─── */
    const assetWrap = el('div');
    assetWrap.appendChild(el('p', labelStyle, 'Asset'));
    const assetChip = el('div', chipStyle(false, !!selectedAsset));
    const assetInner = el('div', { display: 'flex', alignItems: 'center', gap: '10px' });
    if (selectedAsset) {
      assetInner.innerHTML = `<div style="width:28px;height:28px;border-radius:50%;background:${selectedAsset.gradient};display:flex;align-items:center;justify-content:center;font-size:12px;font-weight:800;color:#fff">${selectedAsset.icon}</div><span style="color:#fff;font-size:15px;font-weight:600">${selectedAsset.symbol}</span>`;
    } else {
      assetInner.innerHTML = `<span style="color:rgba(255,255,255,0.25);font-size:14px">Select asset</span>`;
    }
    assetChip.appendChild(assetInner);
    assetChip.insertAdjacentHTML('beforeend', chevronDown);
    assetChip.addEventListener('click', () => { phase = 'dropdown-asset'; render(); });
    assetWrap.appendChild(assetChip);
    scroll.appendChild(assetWrap);

    /* ─── Amount input ─── */
    if (selectedAsset) {
      const amtWrap = el('div', { animation: !amount ? 'idemo-slide-up 0.4s ease-out' : 'none' });
      amtWrap.appendChild(el('p', labelStyle, 'Amount'));
      const amtBox = el('div', inputBoxStyle(document.activeElement && document.activeElement.id === 'idemo-amount'));
      const amtInner = el('div', { padding: '14px 16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' });
      const amtInput = document.createElement('input');
      amtInput.type = 'text'; amtInput.inputMode = 'decimal';
      amtInput.id = 'idemo-amount';
      amtInput.className = 'idemo-input';
      amtInput.placeholder = '0.00';
      amtInput.value = amount;
      amtInput.addEventListener('input', (e) => {
        amount = e.target.value.replace(/[^0-9.,]/g, '');
        e.target.value = amount;
        updateButton();
      });
      amtInput.addEventListener('focus', () => { amtBox.style.borderColor = 'rgba(6,182,212,0.5)'; amtBox.style.boxShadow = '0 0 0 3px rgba(6,182,212,0.08)'; });
      amtInput.addEventListener('blur', () => { amtBox.style.borderColor = 'rgba(255,255,255,0.08)'; amtBox.style.boxShadow = 'inset 0 1px 3px rgba(0,0,0,0.3)'; });
      amtInner.appendChild(amtInput);
      amtInner.appendChild(el('span', { color: 'rgba(255,255,255,0.4)', fontSize: '13px', fontWeight: '500', flexShrink: '0', marginLeft: '8px' }, selectedAsset.symbol));
      amtBox.appendChild(amtInner);
      amtWrap.appendChild(amtBox);
      scroll.appendChild(amtWrap);
    }

    /* ─── Network selector ─── */
    if (selectedAsset) {
      const netWrap = el('div', { animation: !selectedNetwork ? 'idemo-slide-up 0.4s ease-out' : 'none' });
      netWrap.appendChild(el('p', labelStyle, 'Network'));
      const netChip = el('div', chipStyle(false, !!selectedNetwork));
      const netInner = el('div', { display: 'flex', alignItems: 'center', gap: '10px' });
      if (selectedNetwork) {
        netInner.innerHTML = `<div style="width:28px;height:28px;border-radius:50%;background:${selectedNetwork.color};display:flex;align-items:center;justify-content:center;font-size:14px;color:#fff;font-weight:700">${selectedNetwork.icon}</div><span style="color:#fff;font-size:15px;font-weight:600">${selectedNetwork.name}</span>`;
      } else {
        netInner.innerHTML = `<span style="color:rgba(255,255,255,0.25);font-size:14px">Select network</span>`;
      }
      netChip.appendChild(netInner);
      netChip.insertAdjacentHTML('beforeend', chevronDown);
      netChip.addEventListener('click', () => { phase = 'dropdown-network'; render(); });
      netWrap.appendChild(netChip);
      scroll.appendChild(netWrap);
    }

    /* ─── Address input ─── */
    if (selectedNetwork) {
      const addrWrap = el('div', { animation: !address ? 'idemo-slide-up 0.4s ease-out' : 'none' });
      addrWrap.appendChild(el('p', labelStyle, 'Recipient Wallet Address'));
      const addrBox = el('div', inputBoxStyle(document.activeElement && document.activeElement.id === 'idemo-address'));
      const addrInner = el('div', { padding: '14px 16px', minHeight: '48px', display: 'flex', alignItems: 'center' });
      const addrInput = document.createElement('input');
      addrInput.type = 'text';
      addrInput.id = 'idemo-address';
      addrInput.className = 'idemo-input-mono';
      addrInput.placeholder = 'Paste wallet address';
      addrInput.value = address;
      addrInput.addEventListener('input', (e) => { address = e.target.value; updateButton(); });
      addrInput.addEventListener('focus', () => { addrBox.style.borderColor = 'rgba(6,182,212,0.5)'; addrBox.style.boxShadow = '0 0 0 3px rgba(6,182,212,0.08)'; });
      addrInput.addEventListener('blur', () => { addrBox.style.borderColor = 'rgba(255,255,255,0.08)'; addrBox.style.boxShadow = 'inset 0 1px 3px rgba(0,0,0,0.3)'; });
      addrInner.appendChild(addrInput);
      addrBox.appendChild(addrInner);
      addrWrap.appendChild(addrBox);
      scroll.appendChild(addrWrap);
    }

    /* ─── Platform (inferred/inferring) ─── */
    if (inferredPlatform && (phase === 'form' || phase === 'verified' || phase === 'verifying' || phase === 'sending')) {
      const platWrap = el('div', { animation: 'idemo-slide-up 0.5s cubic-bezier(0.16,1,0.3,1)' });
      const platLabel = el('p', { ...labelStyle, display: 'flex', alignItems: 'center', justifyContent: 'space-between' });
      platLabel.innerHTML = `<span>Recipient Platform</span><span style="color:rgba(255,255,255,0.2);font-size:9px">Auto-detected</span>`;
      platWrap.appendChild(platLabel);
      const platChip = el('div', chipStyle(false, true));
      platChip.style.cursor = 'default';
      platChip.innerHTML = `
        <div style="display:flex;align-items:center;gap:10px">
          <div style="width:28px;height:28px;border-radius:8px;background:${inferredPlatform.gradient};display:flex;align-items:center;justify-content:center;font-size:14px;color:#fff;font-weight:800">${inferredPlatform.badge}</div>
          <div style="display:flex;flex-direction:column">
            <span style="color:#fff;font-size:15px;font-weight:600">${inferredPlatform.platform}</span>
            <span style="color:#34d399;font-size:10px;font-weight:600">Suggested by Vervet</span>
          </div>
        </div>
      `;
      platWrap.appendChild(platChip);
      scroll.appendChild(platWrap);
    }

    if (phase === 'inferring') {
      const platWrap = el('div', { animation: 'idemo-slide-up 0.5s cubic-bezier(0.16,1,0.3,1)' });
      const platLabel = el('p', { ...labelStyle, display: 'flex', alignItems: 'center', justifyContent: 'space-between' });
      platLabel.innerHTML = `<span>Recipient Platform</span><span style="color:#06b6d4;font-size:9px">Inferring...</span>`;
      platWrap.appendChild(platLabel);
      const platChip = el('div', chipStyle(true, false));
      platChip.style.cursor = 'default';
      platChip.innerHTML = `
        <div style="display:flex;align-items:center;gap:10px">
          <div style="width:28px;height:28px;border-radius:8px;background:rgba(255,255,255,0.06);display:flex;align-items:center;justify-content:center">
            <div style="width:16px;height:16px;border-radius:50%;border:2px solid rgba(6,182,212,0.3);border-top-color:#06b6d4;animation:idemo-spin 0.8s linear infinite"></div>
          </div>
          <span style="color:rgba(255,255,255,0.25);font-size:14px">Detecting platform...</span>
        </div>
      `;
      platWrap.appendChild(platChip);
      scroll.appendChild(platWrap);
    }

    /* ─── Verifying spinner ─── */
    if (phase === 'verifying') {
      const vWrap = el('div', { display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px', padding: '16px 0', animation: 'idemo-fade-in 0.4s ease-out' });
      vWrap.innerHTML = `<div style="width:18px;height:18px;border-radius:50%;border:2px solid rgba(52,211,153,0.3);border-top-color:#34d399;animation:idemo-spin 0.8s linear infinite"></div><span style="color:rgba(255,255,255,0.5);font-size:13px;font-weight:500">Verifying with Vervet...</span>`;
      scroll.appendChild(vWrap);
    }

    /* ─── Verified card ─── */
    if (phase === 'verified' || phase === 'sending') {
      const vd = verifData || inferredPlatform;
      const card = el('div', {
        background: 'linear-gradient(180deg, rgba(52,211,153,0.10) 0%, rgba(52,211,153,0.03) 100%)',
        border: '1px solid rgba(52,211,153,0.2)', borderRadius: '20px',
        padding: '16px 16px 18px', animation: 'idemo-fade-in-scale 0.5s ease-out',
        boxShadow: '0 0 40px rgba(52,211,153,0.06)', backdropFilter: 'blur(12px)', marginTop: '6px',
      });
      card.innerHTML = `
        <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:14px">
          <div style="display:flex;align-items:center;gap:8px">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#34d399" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>
            <span style="color:#34d399;font-size:11px;font-weight:800;letter-spacing:0.15em;text-transform:uppercase">Verified Destination</span>
          </div>
          <div style="background:rgba(52,211,153,0.15);border:1px solid rgba(52,211,153,0.3);border-radius:8px;padding:3px 10px;font-size:10px;font-weight:700;color:#34d399;letter-spacing:0.05em">SAFE TO SEND</div>
        </div>
        <div style="display:flex;flex-direction:column;gap:8px">
          <div style="display:flex;justify-content:space-between;align-items:center;padding:8px 0;border-bottom:1px solid rgba(255,255,255,0.04)">
            <span style="color:rgba(255,255,255,0.4);font-size:12px;font-weight:500">Platform</span>
            <span style="color:#fff;font-size:13px;font-weight:600">${vd.platform}</span>
          </div>
          <div style="display:flex;justify-content:space-between;align-items:center;padding:8px 0;border-bottom:1px solid rgba(255,255,255,0.04)">
            <span style="color:rgba(255,255,255,0.4);font-size:12px;font-weight:500">Recipient</span>
            <span style="color:#fff;font-size:13px;font-weight:600">${vd.recipient} <span style="color:rgba(255,255,255,0.3);font-size:11px">· ${vd.walletType}</span></span>
          </div>
          <div style="display:flex;justify-content:space-between;align-items:center;padding:8px 0">
            <span style="color:rgba(255,255,255,0.4);font-size:12px;font-weight:500">Network</span>
            <span style="color:#fff;font-size:13px;font-weight:600">${selectedNetwork ? selectedNetwork.name : 'Base'}</span>
          </div>
        </div>`;
      scroll.appendChild(card);
    }

    /* spacer */
    scroll.appendChild(el('div', { flex: '1', minHeight: '10px' }));

    /* ─── CTA buttons ─── */
    const ctaWrap = el('div', { paddingBottom: '16px' });

    if (phase === 'form' && !inferredPlatform) {
      // Verify & Send — starts disabled, updateButton() toggles it live
      const ready = isFormComplete();
      const btn = el('button', {
        width: '100%', height: '56px', borderRadius: '18px', border: 'none',
        background: ready ? '#fff' : 'rgba(255,255,255,0.06)',
        color: ready ? '#000' : 'rgba(255,255,255,0.2)',
        fontSize: '16px', fontWeight: '600',
        cursor: ready ? 'pointer' : 'default',
        opacity: ready ? '1' : '0.5',
        transition: 'all 0.3s ease',
        fontFamily: 'inherit',
      }, 'Verify & Send');
      btn.id = 'idemo-cta-btn';
      btn.addEventListener('click', () => { if (isFormComplete()) handleVerify(); });
      ctaWrap.appendChild(btn);
    } else if (phase === 'form' && inferredPlatform) {
      const btn = el('button', {
        width: '100%', height: '56px', borderRadius: '18px', border: 'none',
        background: '#fff', color: '#000',
        fontSize: '16px', fontWeight: '600', cursor: 'pointer',
        transition: 'all 0.3s ease', fontFamily: 'inherit',
      }, 'Verify Recipient');
      btn.addEventListener('click', handleVerifyRecipient);
      ctaWrap.appendChild(btn);
    } else if (phase === 'inferring') {
      const btn = el('button', {
        width: '100%', height: '56px', borderRadius: '18px', border: 'none',
        background: 'rgba(255,255,255,0.06)', color: 'rgba(255,255,255,0.2)',
        fontSize: '16px', fontWeight: '600', cursor: 'default', opacity: '0.5',
        fontFamily: 'inherit',
      }, 'Verify Recipient');
      ctaWrap.appendChild(btn);
    } else if (phase === 'verifying') {
      const btn = el('button', {
        width: '100%', height: '56px', borderRadius: '18px',
        background: 'rgba(255,255,255,0.05)', backdropFilter: 'blur(8px)',
        border: '1px solid rgba(255,255,255,0.08)', color: '#fff',
        fontSize: '16px', fontWeight: '500', cursor: 'default',
        display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '12px',
        fontFamily: 'inherit',
      });
      btn.innerHTML = `<div style="width:18px;height:18px;border-radius:50%;border:2px solid rgba(52,211,153,0.3);border-top-color:#34d399;animation:idemo-spin 0.8s linear infinite"></div>Checking with Vervet...`;
      ctaWrap.appendChild(btn);
    } else if (phase === 'verified') {
      const btn = el('button', {
        width: '100%', height: '56px', borderRadius: '18px',
        border: '1px solid rgba(255,255,255,0.2)',
        background: 'linear-gradient(135deg, #34d399, #06b6d4)',
        color: '#fff', fontSize: '16px', fontWeight: '700', cursor: 'pointer',
        display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px',
        boxShadow: '0 0 50px rgba(52,211,153,0.3)', animation: 'idemo-fade-in-scale 0.4s ease-out',
        fontFamily: 'inherit',
      });
      btn.innerHTML = `Confirm &amp; Send <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="5" y1="12" x2="19" y2="12"/><polyline points="12 5 19 12 12 19"/></svg>`;
      btn.addEventListener('click', handleSend);
      ctaWrap.appendChild(btn);
    } else if (phase === 'sending') {
      const btn = el('button', {
        width: '100%', height: '56px', borderRadius: '18px',
        background: 'rgba(52,211,153,0.12)', backdropFilter: 'blur(8px)',
        border: '1px solid rgba(52,211,153,0.25)', color: '#34d399',
        fontSize: '16px', fontWeight: '600', cursor: 'default',
        display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '12px',
        fontFamily: 'inherit',
      });
      btn.innerHTML = `<div style="width:18px;height:18px;position:relative"><div style="position:absolute;inset:0;border-radius:50%;border:2px solid rgba(52,211,153,0.2)"></div><div style="position:absolute;inset:0;border-radius:50%;border:2px solid #34d399;border-top-color:transparent;animation:idemo-spin 0.8s linear infinite"></div></div>Releasing Funds...`;
      ctaWrap.appendChild(btn);
    }

    /* secured badge */
    if (selectedAsset) {
      const badge = el('div', {
        display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '7px', marginTop: '14px',
      });
      badge.innerHTML = `<div style="width:6px;height:6px;border-radius:50%;background:#34d399;box-shadow:0 0 6px rgba(52,211,153,0.8);animation:idemo-pulse 2s ease-in-out infinite"></div><p style="color:rgba(255,255,255,0.3);font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:0.2em;margin:0">Secured by Vervet</p>`;
      ctaWrap.appendChild(badge);
    }

    scroll.appendChild(ctaWrap);
    form.appendChild(scroll);
    content.appendChild(form);
  }

  /* ── Dropdown renderers ── */
  function renderDropdown(type) {
    content.innerHTML = '';
    const wrap = el('div', { display: 'flex', flexDirection: 'column', height: '100%', animation: 'idemo-fade-in 0.2s ease-out' });

    wrap.appendChild(el('div', { height: '1px', background: 'linear-gradient(90deg, transparent, rgba(255,255,255,0.15), transparent)' }));

    /* header */
    const hdr = el('div', { display: 'flex', alignItems: 'center', padding: '10px 20px 0', marginBottom: '16px' });
    const backBtn = el('div', { padding: '6px', cursor: 'pointer' }, `<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.5)" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="15 18 9 12 15 6"/></svg>`);
    backBtn.addEventListener('click', () => { phase = 'form'; render(); });
    hdr.appendChild(backBtn);
    hdr.appendChild(el('div', { flex: '1', textAlign: 'center', color: 'rgba(255,255,255,0.9)', fontSize: '17px', fontWeight: '600' }, type === 'asset' ? 'Select Asset' : 'Select Network'));
    hdr.appendChild(el('div', { width: '36px' }));
    wrap.appendChild(hdr);

    /* list */
    const list = el('div', { padding: '0 20px', overflowY: 'auto', flex: '1' });
    const items = type === 'asset' ? ASSETS : NETWORKS;
    items.forEach((item, i) => {
      const row = el('div');
      row.className = 'idemo-select-item';
      row.style.animation = `idemo-slide-up 0.3s ease-out ${i * 0.05}s both`;
      if (type === 'asset') {
        row.innerHTML = `
          <div style="width:36px;height:36px;border-radius:50%;background:${item.gradient};display:flex;align-items:center;justify-content:center;font-size:16px;font-weight:800;color:#fff">${item.icon}</div>
          <div style="display:flex;flex-direction:column">
            <span style="color:#fff;font-size:15px;font-weight:600">${item.symbol}</span>
            <span style="color:rgba(255,255,255,0.4);font-size:12px">${item.name}</span>
          </div>
        `;
        row.addEventListener('click', () => {
          selectedAsset = item;
          phase = 'form';
          render();
        });
      } else {
        row.innerHTML = `
          <div style="width:36px;height:36px;border-radius:50%;background:${item.color};display:flex;align-items:center;justify-content:center;font-size:16px;font-weight:700;color:#fff">${item.icon}</div>
          <div style="display:flex;flex-direction:column">
            <span style="color:#fff;font-size:15px;font-weight:600">${item.name}</span>
          </div>
        `;
        row.addEventListener('click', () => {
          selectedNetwork = item;
          phase = 'form';
          render();
        });
      }
      list.appendChild(row);
    });
    wrap.appendChild(list);
    content.appendChild(wrap);
  }

  /* ── Success screen ── */
  function renderSuccess() {
    const vd = verifData || inferredPlatform || { platform: 'Trust Wallet', recipient: 'V*** N.' };
    const displayAmount = amount || '0.00';
    const displayAsset = selectedAsset ? selectedAsset.symbol : 'USDC';
    const displayNetwork = selectedNetwork ? selectedNetwork.name : 'Base';
    const displayAddr = address.length > 20 ? address.slice(0, 10) + '...' + address.slice(-8) : address;

    const wrap = el('div', {
      display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
      height: '100%', textAlign: 'center', padding: '28px', animation: 'idemo-fade-in-scale 0.6s ease-out',
    });
    wrap.innerHTML = `
      <div style="position:absolute;top:45%;left:50%;width:320px;height:320px;background:radial-gradient(circle,rgba(52,211,153,0.18) 0%,transparent 70%);border-radius:50%;transform:translate(-50%,-50%);pointer-events:none"></div>
      <div style="position:relative;margin-bottom:36px">
        <div style="position:absolute;inset:-16px;border-radius:50%;border:2px solid rgba(52,211,153,0.15);animation:idemo-ring 1s ease-out forwards"></div>
        <div style="position:absolute;inset:-8px;border-radius:50%;background:rgba(52,211,153,0.08);animation:idemo-pulse 3s ease-in-out infinite"></div>
        <div style="width:96px;height:96px;border-radius:50%;background:rgba(8,13,26,0.9);border:1px solid rgba(52,211,153,0.3);display:flex;align-items:center;justify-content:center;position:relative;z-index:1;box-shadow:0 0 60px rgba(52,211,153,0.15);animation:idemo-check 0.6s ease-out">
          <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="#34d399" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
        </div>
      </div>
      <h2 style="font-size:30px;font-weight:700;letter-spacing:-0.02em;background:linear-gradient(180deg,#fff 30%,rgba(255,255,255,0.6));-webkit-background-clip:text;-webkit-text-fill-color:transparent;margin:0 0 12px;position:relative;z-index:1">Transfer Complete</h2>
      <p style="color:rgba(255,255,255,0.4);font-size:15px;line-height:1.7;margin:0 0 12px;position:relative;z-index:1"><span style="color:#fff;font-weight:600">${displayAmount} ${displayAsset}</span> sent via ${displayNetwork} to<br/><span style="color:#34d399;font-weight:600">${vd.recipient}</span> on ${vd.platform}</p>
      <div style="background:rgba(255,255,255,0.04);border:1px solid rgba(255,255,255,0.06);border-radius:12px;padding:10px 16px;margin-bottom:32px;position:relative;z-index:1">
        <span style="color:rgba(255,255,255,0.5);font-size:12px;font-family:'IBM Plex Mono','SF Mono',monospace">${displayAddr}</span>
      </div>
      <div style="position:relative;z-index:1;width:100%;padding:0 4px">
        <button id="idemo-done-btn" style="width:100%;height:52px;border-radius:18px;border:1px solid rgba(255,255,255,0.1);background:rgba(255,255,255,0.08);color:#fff;font-size:16px;font-weight:600;cursor:pointer;transition:all 0.3s;font-family:inherit">Try Again</button>
        <div style="display:flex;align-items:center;justify-content:center;gap:7px;margin-top:14px">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="10" stroke="#34d399" stroke-width="1.5"/><path d="M8 12l3 3 5-6" stroke="#34d399" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>
          <p style="color:rgba(255,255,255,0.3);font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:0.2em;margin:0">Powered by Vervet</p>
        </div>
      </div>`;
    content.appendChild(wrap);

    // bind done button
    document.getElementById('idemo-done-btn').addEventListener('click', handleReset);
  }

  /* ── Action handlers ── */
  async function handleVerify() {
    // Step 1: Infer platform
    phase = 'inferring';
    render();

    await wait(1500);

    inferredPlatform = getVerifData(address);
    phase = 'form';
    render();
  }

  async function handleVerifyRecipient() {
    verifData = inferredPlatform;
    phase = 'verifying';
    render();

    await wait(2200);

    phase = 'verified';
    render();
  }

  async function handleSend() {
    phase = 'sending';
    render();

    await wait(2500);

    phase = 'success';
    render();
  }

  function handleReset() {
    selectedAsset = null;
    amount = '';
    selectedNetwork = null;
    address = '';
    verifData = null;
    inferredPlatform = null;
    phase = 'form';
    render();
  }

  /* ── Initial render ── */
  render();
})();
