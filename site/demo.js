/* ═══════════════════════════════════════════════════
   Vervet Network — iPhone Demo Animation
   Port of dashboard/src/app/demo/page.tsx to vanilla JS
   ═══════════════════════════════════════════════════ */

(function () {
  'use strict';

  /* ── constants ── */
  const WALLET_ADDR = '0x7a2f8B3c...e4c1b9f4';
  const WALLET_ADDR_FULL = '0x7a2f8B3cD91E56aB...e4c1b9f4';
  const AMOUNT_VALUE = '1,000.00';

  /* ── CSS keyframes (injected once) ── */
  const style = document.createElement('style');
  style.textContent = `
    @keyframes demo-float   { 0%,100%{transform:scale(1)}   50%{transform:scale(1.15)} }
    @keyframes demo-fade-in { from{opacity:0} to{opacity:1} }
    @keyframes demo-slide-up{ from{opacity:0;transform:translateY(16px)} to{opacity:1;transform:translateY(0)} }
    @keyframes demo-fade-in-scale{ from{opacity:0;transform:scale(0.92)} to{opacity:1;transform:scale(1)} }
    @keyframes demo-blink   { 0%,100%{opacity:1} 50%{opacity:0} }
    @keyframes demo-spin    { to{transform:rotate(360deg)} }
    @keyframes demo-pulse   { 0%,100%{opacity:0.4;transform:scale(1)} 50%{opacity:0.8;transform:scale(1.4)} }
    @keyframes demo-ring    { from{opacity:0;transform:scale(0.5)} to{opacity:1;transform:scale(1)} }
    @keyframes demo-check   { from{transform:scale(0.4);opacity:0} to{transform:scale(1);opacity:1} }
  `;
  document.head.appendChild(style);

  /* ── mount point ── */
  const mount = document.getElementById('phone-mount');
  if (!mount) return;

  /* ── build phone shell ── */
  function el(tag, css, children) {
    const e = document.createElement(tag);
    if (css) Object.assign(e.style, css);
    if (typeof children === 'string') e.innerHTML = children;
    else if (Array.isArray(children)) children.forEach(c => c && e.appendChild(c));
    else if (children) e.appendChild(children);
    return e;
  }

  /* ── state ── */
  let phase = 'idle';
  let selectedAsset = '';
  let typedAmount = '';
  let selectedNetwork = '';
  let selectedPlatform = '';
  let typedAddress = '';
  let cancelled = false;

  /* ── phone container ── */
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
  function getClock() {
    return new Date().toLocaleTimeString([], { hour: 'numeric', minute: '2-digit', hour12: false });
  }
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
    borderRadius: '50%', animation: 'demo-float 8s ease-in-out infinite', pointerEvents: 'none'
  }));
  screen.appendChild(el('div', {
    position: 'absolute', bottom: '-15%', right: '-25%', width: '450px', height: '450px',
    background: 'radial-gradient(circle, rgba(52,211,153,0.10) 0%, transparent 70%)',
    borderRadius: '50%', animation: 'demo-float 10s ease-in-out infinite 2s', pointerEvents: 'none'
  }));
  /* blur overlay */
  screen.appendChild(el('div', {
    position: 'absolute', inset: '0',
    background: 'rgba(3,7,18,0.35)', backdropFilter: 'blur(80px)', pointerEvents: 'none'
  }));

  /* content container */
  const content = el('div', {
    position: 'relative', zIndex: '10', height: '100%',
    display: 'flex', flexDirection: 'column', paddingTop: '60px'
  });
  screen.appendChild(content);
  phone.appendChild(screen);

  /* home indicator */
  phone.appendChild(el('div', {
    position: 'absolute', bottom: '8px', left: '50%', transform: 'translateX(-50%)',
    width: '120px', height: '4px', borderRadius: '100px',
    background: 'rgba(255,255,255,0.15)', zIndex: '50'
  }));

  mount.appendChild(phone);

  /* ── helpers ── */
  function chipStyle(active, filled) {
    return {
      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      padding: '14px 16px',
      background: filled ? 'rgba(52,211,153,0.08)' : active ? 'rgba(9,14,26,0.9)' : 'rgba(9,14,26,0.6)',
      border: '1px solid ' + (filled ? 'rgba(52,211,153,0.25)' : active ? 'rgba(6,182,212,0.5)' : 'rgba(255,255,255,0.06)'),
      borderRadius: '16px', transition: 'all 0.3s ease',
      boxShadow: active ? '0 0 0 3px rgba(6,182,212,0.06)' : 'none',
    };
  }

  const labelStyle = {
    color: 'rgba(255,255,255,0.35)', fontSize: '10px', fontWeight: '700',
    textTransform: 'uppercase', letterSpacing: '0.15em', margin: '0 0 6px 4px',
  };

  const chevronDown = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.4)" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="6 9 12 15 18 9"/></svg>`;

  /* ── render function ── */
  function render() {
    content.innerHTML = '';

    if (phase === 'success') {
      renderSuccess();
      return;
    }

    const form = el('div', { display: 'flex', flexDirection: 'column', height: '100%', animation: 'demo-fade-in 0.5s ease-out' });

    /* top line */
    form.appendChild(el('div', { height: '1px', background: 'linear-gradient(90deg, transparent, rgba(255,255,255,0.15), transparent)' }));

    /* header */
    const hdr = el('div', { display: 'flex', alignItems: 'center', padding: '10px 20px 0', marginBottom: '20px' });
    hdr.appendChild(el('div', { padding: '6px' }, `<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.5)" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="15 18 9 12 15 6"/></svg>`));
    hdr.appendChild(el('div', { flex: '1', textAlign: 'center', color: 'rgba(255,255,255,0.9)', fontSize: '17px', fontWeight: '600', letterSpacing: '0.02em' }, 'Send Crypto'));
    hdr.appendChild(el('div', { width: '36px' }));
    form.appendChild(hdr);

    /* scrollable */
    const scroll = el('div', { padding: '0 20px', display: 'flex', flexDirection: 'column', gap: '12px', flex: '1', overflowY: 'auto', paddingBottom: '40px' });

    /* asset */
    const assetLabel = el('p', labelStyle, 'Asset');
    const assetChip = el('div', chipStyle(phase === 'select-asset', !!selectedAsset));
    const assetInner = el('div', { display: 'flex', alignItems: 'center', gap: '10px' });
    if (selectedAsset) {
      assetInner.innerHTML = `<div style="width:28px;height:28px;border-radius:50%;background:linear-gradient(135deg,#2775ca,#3b99fc);display:flex;align-items:center;justify-content:center;font-size:12px;font-weight:800;color:#fff">$</div><span style="color:#fff;font-size:15px;font-weight:600">USDC</span>`;
    } else {
      assetInner.innerHTML = `<span style="color:rgba(255,255,255,0.25);font-size:14px">Select asset</span>`;
    }
    assetChip.appendChild(assetInner);
    assetChip.insertAdjacentHTML('beforeend', chevronDown);
    const assetWrap = el('div');
    assetWrap.appendChild(assetLabel);
    assetWrap.appendChild(assetChip);
    scroll.appendChild(assetWrap);

    /* amount */
    const showAmount = phase !== 'idle' && phase !== 'select-asset';
    if (showAmount) {
      const amtWrap = el('div', { animation: 'demo-slide-up 0.4s ease-out' });
      amtWrap.appendChild(el('p', labelStyle, 'Amount'));
      const amtBox = el('div', {
        position: 'relative', background: 'rgba(9,14,26,0.8)', backdropFilter: 'blur(20px)',
        border: '1px solid ' + (phase === 'typing-amount' ? 'rgba(6,182,212,0.5)' : 'rgba(255,255,255,0.08)'),
        borderRadius: '16px', overflow: 'hidden', transition: 'border-color 0.3s ease',
        boxShadow: phase === 'typing-amount' ? '0 0 0 3px rgba(6,182,212,0.08)' : 'inset 0 1px 3px rgba(0,0,0,0.3)',
      });
      const amtInner = el('div', { padding: '14px 16px', fontSize: '16px', fontWeight: '600', color: '#fff', minHeight: '52px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' });
      const leftSide = el('div', { display: 'flex', alignItems: 'center' });
      if (typedAmount) {
        leftSide.textContent = typedAmount;
      } else {
        leftSide.innerHTML = `<span style="color:rgba(255,255,255,0.15);font-weight:500">0.00</span>`;
      }
      if (phase === 'typing-amount') {
        leftSide.insertAdjacentHTML('beforeend', `<span style="animation:demo-blink 1s step-end infinite;color:#06b6d4;margin-left:2px;font-weight:300">|</span>`);
      }
      amtInner.appendChild(leftSide);
      amtInner.appendChild(el('span', { color: 'rgba(255,255,255,0.4)', fontSize: '13px', fontWeight: '500' }, 'USDC'));
      amtBox.appendChild(amtInner);
      amtWrap.appendChild(amtBox);
      scroll.appendChild(amtWrap);
    }

    /* network */
    const showNetwork = showAmount && phase !== 'typing-amount';
    if (showNetwork) {
      const netWrap = el('div', { animation: 'demo-slide-up 0.4s ease-out' });
      netWrap.appendChild(el('p', labelStyle, 'Network'));
      const netChip = el('div', chipStyle(phase === 'select-network', !!selectedNetwork));
      const netInner = el('div', { display: 'flex', alignItems: 'center', gap: '10px' });
      if (selectedNetwork) {
        netInner.innerHTML = `<div style="width:28px;height:28px;border-radius:50%;background:#0052ff;display:flex;align-items:center;justify-content:center"><svg width="16" height="16" viewBox="0 0 24 24" fill="#fff"><circle cx="12" cy="12" r="10"/></svg></div><span style="color:#fff;font-size:15px;font-weight:600">Base</span>`;
      } else {
        netInner.innerHTML = `<span style="color:rgba(255,255,255,0.25);font-size:14px">Select network</span>`;
      }
      netChip.appendChild(netInner);
      netChip.insertAdjacentHTML('beforeend', chevronDown);
      netWrap.appendChild(netChip);
      scroll.appendChild(netWrap);
    }

    /* address */
    const showAddress = showNetwork && phase !== 'select-network';
    if (showAddress) {
      const addrWrap = el('div', { animation: 'demo-slide-up 0.4s ease-out' });
      addrWrap.appendChild(el('p', labelStyle, 'Recipient Wallet Address'));
      const addrBox = el('div', {
        position: 'relative', background: 'rgba(9,14,26,0.8)', backdropFilter: 'blur(20px)',
        border: '1px solid ' + (phase === 'typing-address' ? 'rgba(6,182,212,0.5)' : 'rgba(255,255,255,0.08)'),
        borderRadius: '16px', overflow: 'hidden', transition: 'border-color 0.3s ease',
        boxShadow: phase === 'typing-address' ? '0 0 0 3px rgba(6,182,212,0.08)' : 'inset 0 1px 3px rgba(0,0,0,0.3)',
      });
      const addrInner = el('div', {
        padding: '14px 16px', fontSize: '13px', fontWeight: '500', color: '#fff',
        fontFamily: "'IBM Plex Mono', 'SF Mono', monospace", letterSpacing: '-0.02em',
        minHeight: '48px', display: 'flex', alignItems: 'center', wordBreak: 'break-all',
      });
      if (typedAddress) {
        addrInner.textContent = typedAddress;
      } else {
        addrInner.innerHTML = `<span style="color:rgba(255,255,255,0.15);font-family:-apple-system,sans-serif">Paste wallet address</span>`;
      }
      if (phase === 'typing-address') {
        addrInner.insertAdjacentHTML('beforeend', `<span style="animation:demo-blink 1s step-end infinite;color:#06b6d4;margin-left:1px;font-weight:300">|</span>`);
      }
      addrBox.appendChild(addrInner);
      addrWrap.appendChild(addrBox);
      scroll.appendChild(addrWrap);
    }

    /* platform */
    const showPlatform = showAddress && phase !== 'typing-address';
    if (showPlatform) {
      const platWrap = el('div', { animation: 'demo-slide-up 0.5s cubic-bezier(0.16,1,0.3,1)' });
      const platLabel = el('p', Object.assign({}, labelStyle, { display: 'flex', alignItems: 'center', justifyContent: 'space-between' }));
      platLabel.innerHTML = `<span>Recipient Platform</span>` + (phase === 'inferring-platform'
        ? `<span style="color:#06b6d4;font-size:9px">Inferring...</span>`
        : `<span style="color:rgba(255,255,255,0.2);font-size:9px">Optional</span>`);
      platWrap.appendChild(platLabel);
      const platChip = el('div', chipStyle(phase === 'inferring-platform', !!selectedPlatform));
      const platInner = el('div', { display: 'flex', alignItems: 'center', gap: '10px' });
      if (selectedPlatform) {
        platInner.innerHTML = `<div style="width:28px;height:28px;border-radius:8px;background:linear-gradient(135deg,#0500FF,#06d6a0);display:flex;align-items:center;justify-content:center;font-size:14px;color:#fff;font-weight:800">T</div><div style="display:flex;flex-direction:column"><span style="color:#fff;font-size:15px;font-weight:600">Trust Wallet</span><span style="color:#34d399;font-size:10px;font-weight:600">Suggested by Vervet</span></div>`;
      } else {
        platInner.innerHTML = `<span style="color:rgba(255,255,255,0.25);font-size:14px">Unknown Platform</span>`;
      }
      platChip.appendChild(platInner);
      platChip.insertAdjacentHTML('beforeend', chevronDown);
      platWrap.appendChild(platChip);
      scroll.appendChild(platWrap);
    }

    /* verifying spinner */
    if (phase === 'verifying') {
      const vWrap = el('div', { display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px', padding: '16px 0', animation: 'demo-fade-in 0.4s ease-out' });
      vWrap.innerHTML = `<div style="width:18px;height:18px;border-radius:50%;border:2px solid rgba(52,211,153,0.3);border-top-color:#34d399;animation:demo-spin 0.8s linear infinite"></div><span style="color:rgba(255,255,255,0.5);font-size:13px;font-weight:500">Verifying with Vervet...</span>`;
      scroll.appendChild(vWrap);
    }

    /* verified card */
    const showVerified = phase === 'verified' || phase === 'confirming' || phase === 'sending';
    if (showVerified) {
      const card = el('div', {
        background: 'linear-gradient(180deg, rgba(52,211,153,0.10) 0%, rgba(52,211,153,0.03) 100%)',
        border: '1px solid rgba(52,211,153,0.2)', borderRadius: '20px',
        padding: '16px 16px 18px', animation: 'demo-fade-in-scale 0.5s ease-out',
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
            <span style="color:#fff;font-size:13px;font-weight:600">Trust Wallet</span>
          </div>
          <div style="display:flex;justify-content:space-between;align-items:center;padding:8px 0;border-bottom:1px solid rgba(255,255,255,0.04)">
            <span style="color:rgba(255,255,255,0.4);font-size:12px;font-weight:500">Recipient</span>
            <span style="color:#fff;font-size:13px;font-weight:600">T*** A. <span style="color:rgba(255,255,255,0.3);font-size:11px">· Personal wallet</span></span>
          </div>
          <div style="display:flex;justify-content:space-between;align-items:center;padding:8px 0">
            <span style="color:rgba(255,255,255,0.4);font-size:12px;font-weight:500">Network</span>
            <span style="color:#fff;font-size:13px;font-weight:600">Base</span>
          </div>
        </div>`;
      scroll.appendChild(card);
    }

    /* spacer */
    scroll.appendChild(el('div', { flex: '1', minHeight: '10px' }));

    /* CTA buttons */
    const ctaWrap = el('div', { paddingBottom: '16px' });

    if (['idle','select-asset','typing-amount','select-network','typing-address'].includes(phase)) {
      const btn = el('button', {
        width: '100%', height: '56px', borderRadius: '18px', border: 'none',
        background: 'rgba(255,255,255,0.06)', color: 'rgba(255,255,255,0.2)',
        fontSize: '16px', fontWeight: '600', cursor: 'default', opacity: '0.5',
        fontFamily: 'inherit',
      }, 'Verify &amp; Send');
      ctaWrap.appendChild(btn);
    } else if (phase === 'inferring-platform') {
      const btn = el('button', {
        width: '100%', height: '56px', borderRadius: '18px', border: 'none',
        background: selectedPlatform ? '#fff' : 'rgba(255,255,255,0.06)',
        color: selectedPlatform ? '#000' : 'rgba(255,255,255,0.2)',
        fontSize: '16px', fontWeight: '600', cursor: 'pointer',
        transition: 'all 0.3s ease', opacity: selectedPlatform ? '1' : '0.5',
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
      btn.innerHTML = `<div style="width:18px;height:18px;border-radius:50%;border:2px solid rgba(52,211,153,0.3);border-top-color:#34d399;animation:demo-spin 0.8s linear infinite"></div>Checking with Vervet...`;
      ctaWrap.appendChild(btn);
    } else if (phase === 'verified' || phase === 'confirming') {
      const btn = el('button', {
        width: '100%', height: '56px', borderRadius: '18px',
        border: '1px solid rgba(255,255,255,0.2)',
        background: 'linear-gradient(135deg, #34d399, #06b6d4)',
        color: '#fff', fontSize: '16px', fontWeight: '700', cursor: 'pointer',
        display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px',
        boxShadow: '0 0 50px rgba(52,211,153,0.3)', animation: 'demo-fade-in-scale 0.4s ease-out',
        transform: phase === 'confirming' ? 'scale(0.97)' : 'scale(1)',
        transition: 'transform 0.15s ease', fontFamily: 'inherit',
      });
      btn.innerHTML = `Confirm &amp; Send <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="5" y1="12" x2="19" y2="12"/><polyline points="12 5 19 12 12 19"/></svg>`;
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
      btn.innerHTML = `<div style="width:18px;height:18px;position:relative"><div style="position:absolute;inset:0;border-radius:50%;border:2px solid rgba(52,211,153,0.2)"></div><div style="position:absolute;inset:0;border-radius:50%;border:2px solid #34d399;border-top-color:transparent;animation:demo-spin 0.8s linear infinite"></div></div>Releasing Funds...`;
      ctaWrap.appendChild(btn);
    }

    /* secured badge */
    if (phase !== 'idle') {
      const badge = el('div', {
        display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '7px', marginTop: '14px',
      });
      badge.innerHTML = `<div style="width:6px;height:6px;border-radius:50%;background:#34d399;box-shadow:0 0 6px rgba(52,211,153,0.8);animation:demo-pulse 2s ease-in-out infinite"></div><p style="color:rgba(255,255,255,0.3);font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:0.2em;margin:0">Secured by Vervet</p>`;
      ctaWrap.appendChild(badge);
    }

    scroll.appendChild(ctaWrap);
    form.appendChild(scroll);
    content.appendChild(form);
  }

  function renderSuccess() {
    const wrap = el('div', {
      display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
      height: '100%', textAlign: 'center', padding: '28px', animation: 'demo-fade-in-scale 0.6s ease-out',
    });
    wrap.innerHTML = `
      <div style="position:absolute;top:45%;left:50%;width:320px;height:320px;background:radial-gradient(circle,rgba(52,211,153,0.18) 0%,transparent 70%);border-radius:50%;transform:translate(-50%,-50%);pointer-events:none"></div>
      <div style="position:relative;margin-bottom:36px">
        <div style="position:absolute;inset:-16px;border-radius:50%;border:2px solid rgba(52,211,153,0.15);animation:demo-ring 1s ease-out forwards"></div>
        <div style="position:absolute;inset:-8px;border-radius:50%;background:rgba(52,211,153,0.08);animation:demo-pulse 3s ease-in-out infinite"></div>
        <div style="width:96px;height:96px;border-radius:50%;background:rgba(8,13,26,0.9);border:1px solid rgba(52,211,153,0.3);display:flex;align-items:center;justify-content:center;position:relative;z-index:1;box-shadow:0 0 60px rgba(52,211,153,0.15);animation:demo-check 0.6s ease-out">
          <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="#34d399" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
        </div>
      </div>
      <h2 style="font-size:30px;font-weight:700;letter-spacing:-0.02em;background:linear-gradient(180deg,#fff 30%,rgba(255,255,255,0.6));-webkit-background-clip:text;-webkit-text-fill-color:transparent;margin:0 0 12px;position:relative;z-index:1">Transfer Complete</h2>
      <p style="color:rgba(255,255,255,0.4);font-size:15px;line-height:1.7;margin:0 0 12px;position:relative;z-index:1"><span style="color:#fff;font-weight:600">${AMOUNT_VALUE} USDC</span> sent via Base to<br/><span style="color:#34d399;font-weight:600">T*** A.</span> on Trust Wallet</p>
      <div style="background:rgba(255,255,255,0.04);border:1px solid rgba(255,255,255,0.06);border-radius:12px;padding:10px 16px;margin-bottom:32px;position:relative;z-index:1">
        <span style="color:rgba(255,255,255,0.5);font-size:12px;font-family:'IBM Plex Mono','SF Mono',monospace">${WALLET_ADDR}</span>
      </div>
      <div style="position:relative;z-index:1;width:100%;padding:0 4px">
        <button style="width:100%;height:52px;border-radius:18px;border:1px solid rgba(255,255,255,0.1);background:rgba(255,255,255,0.08);color:#fff;font-size:16px;font-weight:600;cursor:pointer;transition:all 0.3s;font-family:inherit">Done</button>
        <div style="display:flex;align-items:center;justify-content:center;gap:7px;margin-top:14px">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="10" stroke="#34d399" stroke-width="1.5"/><path d="M8 12l3 3 5-6" stroke="#34d399" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>
          <p style="color:rgba(255,255,255,0.3);font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:0.2em;margin:0">Powered by Vervet</p>
        </div>
      </div>`;
    content.appendChild(wrap);
  }

  /* ── auto-play sequencer ── */
  function wait(ms) {
    return new Promise(r => { const t = setTimeout(r, ms); if (cancelled) clearTimeout(t); });
  }

  async function runSequence() {
    while (!cancelled) {
      /* reset */
      selectedAsset = ''; typedAmount = ''; selectedNetwork = '';
      selectedPlatform = ''; typedAddress = '';
      phase = 'idle'; render();
      await wait(1400); if (cancelled) return;

      /* select asset */
      phase = 'select-asset'; render();
      await wait(1000); if (cancelled) return;
      selectedAsset = 'USDC'; render();
      await wait(600); if (cancelled) return;

      /* type amount */
      phase = 'typing-amount'; render();
      for (let i = 0; i < AMOUNT_VALUE.length; i++) {
        if (cancelled) return;
        typedAmount = AMOUNT_VALUE.slice(0, i + 1); render();
        await wait(60 + Math.random() * 80);
      }
      await wait(600); if (cancelled) return;

      /* select network */
      phase = 'select-network'; render();
      await wait(1000); if (cancelled) return;
      selectedNetwork = 'Base'; render();
      await wait(800); if (cancelled) return;

      /* type address */
      phase = 'typing-address'; render();
      for (let i = 0; i < WALLET_ADDR_FULL.length; i++) {
        if (cancelled) return;
        typedAddress = WALLET_ADDR_FULL.slice(0, i + 1); render();
        await wait(25 + Math.random() * 30);
      }
      await wait(800); if (cancelled) return;

      /* infer platform */
      phase = 'inferring-platform'; render();
      await wait(1200); if (cancelled) return;
      selectedPlatform = 'Trust Wallet'; render();
      await wait(1000); if (cancelled) return;

      /* verifying */
      phase = 'verifying'; render();
      await wait(2600); if (cancelled) return;

      /* verified */
      phase = 'verified'; render();
      await wait(3500); if (cancelled) return;

      /* confirming */
      phase = 'confirming'; render();
      await wait(400); if (cancelled) return;

      /* sending */
      phase = 'sending'; render();
      await wait(2800); if (cancelled) return;

      /* success */
      phase = 'success'; render();
      await wait(5000); if (cancelled) return;
    }
  }

  runSequence();
})();
