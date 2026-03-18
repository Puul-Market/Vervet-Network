/* ═══════════════════════════════════════════════════
   Vervet Network — iPhone Demo (React, no JSX)
   Direct port of dashboard/src/app/demo/page.tsx
   Runs via React CDN — no build step needed.
   ═══════════════════════════════════════════════════ */
(function () {
  'use strict';

  var h = React.createElement;

  /* ── keyframes ── */
  var KEYFRAMES = '\
@keyframes pulse-glow{0%,100%{opacity:.4}50%{opacity:.7}}\
@keyframes spin{to{transform:rotate(360deg)}}\
@keyframes fade-in{from{opacity:0;transform:translateY(12px)}to{opacity:1;transform:translateY(0)}}\
@keyframes fade-in-scale{from{opacity:0;transform:scale(.92)}to{opacity:1;transform:scale(1)}}\
@keyframes blink{0%,100%{opacity:1}50%{opacity:0}}\
@keyframes float{0%,100%{transform:translate(-50%,-50%) scale(1)}50%{transform:translate(-50%,-50%) scale(1.12)}}\
@keyframes success-ring{0%{transform:scale(.5);opacity:0}60%{transform:scale(1.15);opacity:.5}100%{transform:scale(1);opacity:.35}}\
@keyframes slide-up{from{opacity:0;transform:translateY(20px)}to{opacity:1;transform:translateY(0)}}\
@keyframes check-pop{0%{transform:scale(0);opacity:0}60%{transform:scale(1.2)}100%{transform:scale(1);opacity:1}}\
';

  /* ── styles ── */
  var s = {
    phone: {
      position: 'relative', width: 380, height: 780,
      borderRadius: 48,
      background: 'linear-gradient(145deg, #111827 0%, #0a0f1c 50%, #080c14 100%)',
      border: '1px solid rgba(255,255,255,0.08)',
      boxShadow: '0 0 0 1px rgba(255,255,255,0.04), 0 60px 120px rgba(0,0,0,0.8), 0 0 100px rgba(52,211,153,0.04)',
      overflow: 'hidden', userSelect: 'none',
      fontFamily: "'Space Grotesk', -apple-system, 'Helvetica Neue', sans-serif",
    },
    dynamicIsland: {
      position: 'absolute', top: 10, left: '50%', transform: 'translateX(-50%)',
      width: 100, height: 28, background: '#000', borderRadius: 20, zIndex: 60,
      display: 'flex', alignItems: 'center', justifyContent: 'flex-end', paddingRight: 10,
    },
    camera: {
      width: 10, height: 10, borderRadius: '50%',
      background: 'radial-gradient(circle at 40% 35%, #1a1a3a, #0a0a1a)',
      border: '1px solid #111', boxShadow: 'inset 0 0 3px rgba(50,50,150,0.3)',
    },
    statusBar: {
      position: 'absolute', top: 0, left: 0, right: 0, height: 48,
      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      padding: '0 24px', zIndex: 50, color: '#fff', fontSize: 13, fontWeight: 600,
    },
    screen: { position: 'absolute', inset: 0, background: '#030712', overflow: 'hidden' },
    homeIndicator: {
      position: 'absolute', bottom: 6, left: '50%', transform: 'translateX(-50%)',
      width: 110, height: 4, background: 'rgba(255,255,255,0.15)', borderRadius: 100, zIndex: 60,
    },
  };

  /* ── SVG icons ── */
  function SignalIcon() {
    return h('svg', { width:14, height:12, viewBox:'0 0 17 14', fill:'none' },
      h('rect', { x:0, y:10, width:3, height:4, rx:1, fill:'#fff' }),
      h('rect', { x:4.5, y:7, width:3, height:7, rx:1, fill:'#fff' }),
      h('rect', { x:9, y:3.5, width:3, height:10.5, rx:1, fill:'#fff' }),
      h('rect', { x:13.5, y:0, width:3, height:14, rx:1, fill:'#fff' })
    );
  }
  function WifiIcon() {
    return h('svg', { width:14, height:12, viewBox:'0 0 24 24', fill:'none', stroke:'#fff', strokeWidth:2.5, strokeLinecap:'round', strokeLinejoin:'round' },
      h('path', { d:'M5 12.55a11 11 0 0 1 14.08 0' }),
      h('path', { d:'M1.42 9a16 16 0 0 1 21.16 0' }),
      h('path', { d:'M8.53 16.11a6 6 0 0 1 6.95 0' }),
      h('circle', { cx:12, cy:20, r:1, fill:'#fff' })
    );
  }
  function BatteryIcon() {
    return h('svg', { width:22, height:12, viewBox:'0 0 27 14', fill:'none' },
      h('rect', { x:0.5, y:0.5, width:22, height:13, rx:3, stroke:'#fff', strokeOpacity:0.5 }),
      h('rect', { x:2, y:2, width:19, height:10, rx:2, fill:'#fff' }),
      h('path', { d:'M24 5v4a2 2 0 0 0 0-4z', fill:'#fff', fillOpacity:0.4 })
    );
  }
  function CheckIcon(props) {
    var sz = props.size || 48;
    return h('svg', { width:sz, height:sz, viewBox:'0 0 24 24', fill:'none', stroke:'#34d399', strokeWidth:2.5, strokeLinecap:'round', strokeLinejoin:'round' },
      h('path', { d:'M22 11.08V12a10 10 0 1 1-5.93-9.14' }),
      h('polyline', { points:'22 4 12 14.01 9 11.01' })
    );
  }
  function ChevronDownIcon() {
    return h('svg', { width:14, height:14, viewBox:'0 0 24 24', fill:'none', stroke:'rgba(255,255,255,0.4)', strokeWidth:2.5, strokeLinecap:'round', strokeLinejoin:'round' },
      h('polyline', { points:'6 9 12 15 18 9' })
    );
  }
  function ChevronLeftIcon() {
    return h('svg', { width:20, height:20, viewBox:'0 0 24 24', fill:'none', stroke:'rgba(255,255,255,0.5)', strokeWidth:2.5, strokeLinecap:'round', strokeLinejoin:'round' },
      h('polyline', { points:'15 18 9 12 15 6' })
    );
  }
  function ArrowRightIcon() {
    return h('svg', { width:18, height:18, viewBox:'0 0 24 24', fill:'none', stroke:'#fff', strokeWidth:2.5, strokeLinecap:'round', strokeLinejoin:'round' },
      h('line', { x1:5, y1:12, x2:19, y2:12 }), h('polyline', { points:'12 5 19 12 12 19' })
    );
  }
  function ShieldIcon() {
    return h('svg', { width:16, height:16, viewBox:'0 0 24 24', fill:'none', stroke:'#34d399', strokeWidth:2, strokeLinecap:'round', strokeLinejoin:'round' },
      h('path', { d:'M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z' })
    );
  }
  function VervetLogo() {
    return h('svg', { width:18, height:18, viewBox:'0 0 24 24', fill:'none' },
      h('circle', { cx:12, cy:12, r:10, stroke:'#34d399', strokeWidth:1.5 }),
      h('path', { d:'M8 12l3 3 5-6', stroke:'#34d399', strokeWidth:2, strokeLinecap:'round', strokeLinejoin:'round' })
    );
  }

  /* ── constants ── */
  var WALLET_ADDR = '0x7a2f8B3c...e4c1b9f4';
  var WALLET_ADDR_FULL = '0x7a2f8B3cD91E56aB...e4c1b9f4';
  var AMOUNT_VALUE = '1,000.00';

  /* ── chip style helper ── */
  function chipStyle(active, filled) {
    return {
      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      padding: '14px 16px',
      background: filled ? 'rgba(52,211,153,0.08)' : active ? 'rgba(9,14,26,0.9)' : 'rgba(9,14,26,0.6)',
      border: '1px solid ' + (filled ? 'rgba(52,211,153,0.25)' : active ? 'rgba(6,182,212,0.5)' : 'rgba(255,255,255,0.06)'),
      borderRadius: 16, transition: 'all 0.3s ease',
      boxShadow: active ? '0 0 0 3px rgba(6,182,212,0.06)' : 'none',
    };
  }
  var labelCss = { color:'rgba(255,255,255,0.35)', fontSize:10, fontWeight:700, textTransform:'uppercase', letterSpacing:'0.15em', margin:'0 0 6px 4px' };

  /* ═══════════ COMPONENT ═══════════ */
  function ConsumerDemo() {
    var useState = React.useState, useEffect = React.useEffect, useCallback = React.useCallback, useRef = React.useRef;
    var scrollRef = useRef(null);

    var _p = useState('idle');       var phase = _p[0]; var setPhase = _p[1];
    var _a = useState('');           var selectedAsset = _a[0]; var setSelectedAsset = _a[1];
    var _t = useState('');           var typedAmount = _t[0]; var setTypedAmount = _t[1];
    var _n = useState('');           var selectedNetwork = _n[0]; var setSelectedNetwork = _n[1];
    var _pl = useState('');          var selectedPlatform = _pl[0]; var setSelectedPlatform = _pl[1];
    var _ad = useState('');          var typedAddress = _ad[0]; var setTypedAddress = _ad[1];
    var _tm = useState('9:41');      var time = _tm[0]; var setTime = _tm[1];

    /* live clock */
    useEffect(function () {
      var tick = function () {
        setTime(new Date().toLocaleTimeString([], { hour:'numeric', minute:'2-digit', hour12:false }));
      };
      tick();
      var id = setInterval(tick, 10000);
      return function () { clearInterval(id); };
    }, []);

    /* auto-play */
    var runSequence = useCallback(function () {
      var cancelled = false;
      var wait = function (ms) { return new Promise(function (r) { var t = setTimeout(r, ms); if (cancelled) clearTimeout(t); }); };

      var run = async function () {
        setSelectedAsset(''); setTypedAmount(''); setSelectedNetwork('');
        setSelectedPlatform(''); setTypedAddress(''); setPhase('idle');
        await wait(1400); if (cancelled) return;

        setPhase('select-asset');
        await wait(1000); if (cancelled) return;
        setSelectedAsset('USDC');
        await wait(600); if (cancelled) return;

        setPhase('typing-amount');
        for (var i = 0; i < AMOUNT_VALUE.length; i++) {
          if (cancelled) return;
          setTypedAmount(AMOUNT_VALUE.slice(0, i + 1));
          await wait(60 + Math.random() * 80);
        }
        await wait(600); if (cancelled) return;

        setPhase('select-network');
        await wait(1000); if (cancelled) return;
        setSelectedNetwork('Base');
        await wait(800); if (cancelled) return;

        setPhase('typing-address');
        for (var i = 0; i < WALLET_ADDR_FULL.length; i++) {
          if (cancelled) return;
          setTypedAddress(WALLET_ADDR_FULL.slice(0, i + 1));
          await wait(25 + Math.random() * 30);
        }
        await wait(800); if (cancelled) return;

        setPhase('inferring-platform');
        await wait(1200); if (cancelled) return;
        setSelectedPlatform('Trust Wallet');
        await wait(1000); if (cancelled) return;

        setPhase('verifying');
        await wait(2600); if (cancelled) return;

        setPhase('verified');
        await wait(3500); if (cancelled) return;

        setPhase('confirming');
        await wait(400); if (cancelled) return;

        setPhase('sending');
        await wait(2800); if (cancelled) return;

        setPhase('success');
        await wait(5000); if (cancelled) return;

        run();
      };
      run();
      return function () { cancelled = true; };
    }, []);

    useEffect(function () {
      var cancel = runSequence();
      return cancel;
    }, [runSequence]);

    /* auto-scroll to bottom when phase changes */
    useEffect(function () {
      if (scrollRef.current) {
        setTimeout(function () {
          scrollRef.current.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
        }, 100);
      }
    }, [phase, selectedPlatform, showVerified]);

    /* derived */
    var showForm = phase !== 'success';
    var showAmount = phase !== 'idle' && phase !== 'select-asset';
    var showNetwork = showAmount && phase !== 'typing-amount';
    var showAddress = showNetwork && phase !== 'select-network';
    var showPlatform = showAddress && phase !== 'typing-address';
    var showVerified = phase === 'verified' || phase === 'confirming' || phase === 'sending';

    /* ── render ── */
    return h('div', null,
      h('style', { dangerouslySetInnerHTML: { __html: KEYFRAMES } }),
      h('div', { style: s.phone },

        /* Dynamic Island */
        h('div', { style: s.dynamicIsland }, h('div', { style: s.camera })),

        /* Status bar */
        h('div', { style: s.statusBar },
          h('span', null, time),
          h('div', { style: { display:'flex', alignItems:'center', gap:6 } },
            h(SignalIcon), h(WifiIcon), h(BatteryIcon)
          )
        ),

        /* Screen */
        h('div', { style: s.screen },
          /* ambient orbs */
          h('div', { style: { position:'absolute', top:'-15%', left:'-25%', width:380, height:380, background:'radial-gradient(circle, rgba(6,182,212,0.12) 0%, transparent 70%)', borderRadius:'50%', animation:'float 8s ease-in-out infinite', pointerEvents:'none' } }),
          h('div', { style: { position:'absolute', bottom:'-15%', right:'-25%', width:450, height:450, background:'radial-gradient(circle, rgba(52,211,153,0.10) 0%, transparent 70%)', borderRadius:'50%', animation:'float 10s ease-in-out infinite 2s', pointerEvents:'none' } }),
          /* noise overlay */
          h('div', { style: { position:'absolute', inset:0, background:'rgba(3,7,18,0.35)', backdropFilter:'blur(80px)', pointerEvents:'none' } }),

          /* Content */
          h('div', { style: { position:'relative', zIndex:10, height:'100%', display:'flex', flexDirection:'column', paddingTop:60 } },

            showForm ? (
              /* ── SEND SCREEN ── */
              h('div', { style: { display:'flex', flexDirection:'column', height:'100%', animation:'fade-in 0.5s ease-out' } },
                h('div', { style: { height:1, background:'linear-gradient(90deg, transparent, rgba(255,255,255,0.15), transparent)' } }),

                /* header */
                h('div', { style: { display:'flex', alignItems:'center', padding:'10px 20px 0', marginBottom:20 } },
                  h('div', { style:{padding:6} }, h(ChevronLeftIcon)),
                  h('div', { style:{ flex:1, textAlign:'center', color:'rgba(255,255,255,0.9)', fontSize:17, fontWeight:600, letterSpacing:'0.02em' } }, 'Send Crypto'),
                  h('div', { style:{width:36} })
                ),

                /* scrollable */
                h('div', { ref: scrollRef, style: { padding:'0 20px', display:'flex', flexDirection:'column', gap:12, flex:1, overflowY:'auto', paddingBottom:40 } },

                  /* ASSET */
                  h('div', null,
                    h('p', { style: labelCss }, 'Asset'),
                    h('div', { style: chipStyle(phase === 'select-asset', !!selectedAsset) },
                      h('div', { style: { display:'flex', alignItems:'center', gap:10 } },
                        selectedAsset
                          ? h(React.Fragment, null,
                              h('div', { style: { width:28, height:28, borderRadius:'50%', background:'linear-gradient(135deg, #2775ca, #3b99fc)', display:'flex', alignItems:'center', justifyContent:'center', fontSize:12, fontWeight:800, color:'#fff' } }, '$'),
                              h('span', { style: { color:'#fff', fontSize:15, fontWeight:600 } }, 'USDC')
                            )
                          : h('span', { style: { color:'rgba(255,255,255,0.25)', fontSize:14 } }, 'Select asset')
                      ),
                      h(ChevronDownIcon)
                    )
                  ),

                  /* AMOUNT */
                  showAmount && h('div', { style: { animation:'slide-up 0.4s ease-out' } },
                    h('p', { style: labelCss }, 'Amount'),
                    h('div', { style: {
                      position:'relative', background:'rgba(9,14,26,0.8)', backdropFilter:'blur(20px)',
                      border:'1px solid ' + (phase === 'typing-amount' ? 'rgba(6,182,212,0.5)' : 'rgba(255,255,255,0.08)'),
                      borderRadius:16, overflow:'hidden', transition:'border-color 0.3s ease',
                      boxShadow: phase === 'typing-amount' ? '0 0 0 3px rgba(6,182,212,0.08)' : 'inset 0 1px 3px rgba(0,0,0,0.3)',
                    }},
                      h('div', { style: { padding:'14px 16px', fontSize:16, fontWeight:600, color:'#fff', minHeight:52, display:'flex', alignItems:'center', justifyContent:'space-between' } },
                        h('div', { style: { display:'flex', alignItems:'center' } },
                          typedAmount || h('span', { style: { color:'rgba(255,255,255,0.15)', fontWeight:500 } }, '0.00'),
                          phase === 'typing-amount' && h('span', { style: { animation:'blink 1s step-end infinite', color:'#06b6d4', marginLeft:2, fontWeight:300 } }, '|')
                        ),
                        h('span', { style: { color:'rgba(255,255,255,0.4)', fontSize:13, fontWeight:500 } }, 'USDC')
                      )
                    )
                  ),

                  /* NETWORK */
                  showNetwork && h('div', { style: { animation:'slide-up 0.4s ease-out' } },
                    h('p', { style: labelCss }, 'Network'),
                    h('div', { style: chipStyle(phase === 'select-network', !!selectedNetwork) },
                      h('div', { style: { display:'flex', alignItems:'center', gap:10 } },
                        selectedNetwork
                          ? h(React.Fragment, null,
                              h('div', { style: { width:28, height:28, borderRadius:'50%', background:'#0052ff', display:'flex', alignItems:'center', justifyContent:'center' } },
                                h('svg', { width:16, height:16, viewBox:'0 0 24 24', fill:'#fff' }, h('circle', { cx:12, cy:12, r:10 }))
                              ),
                              h('span', { style: { color:'#fff', fontSize:15, fontWeight:600 } }, 'Base')
                            )
                          : h('span', { style: { color:'rgba(255,255,255,0.25)', fontSize:14 } }, 'Select network')
                      ),
                      h(ChevronDownIcon)
                    )
                  ),

                  /* ADDRESS */
                  showAddress && h('div', { style: { animation:'slide-up 0.4s ease-out' } },
                    h('p', { style: labelCss }, 'Recipient Wallet Address'),
                    h('div', { style: {
                      position:'relative', background:'rgba(9,14,26,0.8)', backdropFilter:'blur(20px)',
                      border:'1px solid ' + (phase === 'typing-address' ? 'rgba(6,182,212,0.5)' : 'rgba(255,255,255,0.08)'),
                      borderRadius:16, overflow:'hidden', transition:'border-color 0.3s ease',
                      boxShadow: phase === 'typing-address' ? '0 0 0 3px rgba(6,182,212,0.08)' : 'inset 0 1px 3px rgba(0,0,0,0.3)',
                    }},
                      h('div', { style: { padding:'14px 16px', fontSize:13, fontWeight:500, color:'#fff', fontFamily:"'IBM Plex Mono','SF Mono',monospace", letterSpacing:'-0.02em', minHeight:48, display:'flex', alignItems:'center', wordBreak:'break-all' } },
                        typedAddress || h('span', { style: { color:'rgba(255,255,255,0.15)', fontFamily:'-apple-system,sans-serif' } }, 'Paste wallet address'),
                        phase === 'typing-address' && h('span', { style: { animation:'blink 1s step-end infinite', color:'#06b6d4', marginLeft:1, fontWeight:300 } }, '|')
                      )
                    )
                  ),

                  /* PLATFORM */
                  showPlatform && h('div', { style: { animation:'slide-up 0.5s cubic-bezier(0.16,1,0.3,1)' } },
                    h('p', { style: Object.assign({}, labelCss, { display:'flex', alignItems:'center', justifyContent:'space-between' }) },
                      h('span', null, 'Recipient Platform'),
                      phase === 'inferring-platform'
                        ? h('span', { style: { color:'#06b6d4', fontSize:9 } }, 'Inferring...')
                        : h('span', { style: { color:'rgba(255,255,255,0.2)', fontSize:9 } }, 'Optional')
                    ),
                    h('div', { style: chipStyle(phase === 'inferring-platform', !!selectedPlatform) },
                      h('div', { style: { display:'flex', alignItems:'center', gap:10 } },
                        selectedPlatform
                          ? h(React.Fragment, null,
                              h('div', { style: { width:28, height:28, borderRadius:8, background:'linear-gradient(135deg,#0500FF,#06d6a0)', display:'flex', alignItems:'center', justifyContent:'center', fontSize:14, color:'#fff', fontWeight:800 } }, 'T'),
                              h('div', { style: { display:'flex', flexDirection:'column' } },
                                h('span', { style: { color:'#fff', fontSize:15, fontWeight:600 } }, 'Trust Wallet'),
                                h('span', { style: { color:'#34d399', fontSize:10, fontWeight:600 } }, 'Suggested by Vervet')
                              )
                            )
                          : h('span', { style: { color:'rgba(255,255,255,0.25)', fontSize:14 } }, 'Unknown Platform')
                      ),
                      h(ChevronDownIcon)
                    )
                  ),

                  /* VERIFYING */
                  phase === 'verifying' && h('div', { style: { display:'flex', alignItems:'center', justifyContent:'center', gap:10, padding:'16px 0', animation:'fade-in 0.4s ease-out' } },
                    h('div', { style: { width:18, height:18, borderRadius:'50%', border:'2px solid rgba(52,211,153,0.3)', borderTopColor:'#34d399', animation:'spin 0.8s linear infinite' } }),
                    h('span', { style: { color:'rgba(255,255,255,0.5)', fontSize:13, fontWeight:500 } }, 'Verifying with Vervet...')
                  ),

                  /* VERIFIED CARD */
                  showVerified && h('div', { style: { background:'linear-gradient(180deg, rgba(52,211,153,0.10) 0%, rgba(52,211,153,0.03) 100%)', border:'1px solid rgba(52,211,153,0.2)', borderRadius:20, padding:'16px 16px 18px', animation:'fade-in-scale 0.5s ease-out', boxShadow:'0 0 40px rgba(52,211,153,0.06)', backdropFilter:'blur(12px)', marginTop:6 } },
                    /* header */
                    h('div', { style: { display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:14 } },
                      h('div', { style: { display:'flex', alignItems:'center', gap:8 } },
                        h(ShieldIcon),
                        h('span', { style: { color:'#34d399', fontSize:11, fontWeight:800, letterSpacing:'0.15em', textTransform:'uppercase' } }, 'Verified Destination')
                      ),
                      h('div', { style: { background:'rgba(52,211,153,0.15)', border:'1px solid rgba(52,211,153,0.3)', borderRadius:8, padding:'3px 10px', fontSize:10, fontWeight:700, color:'#34d399', letterSpacing:'0.05em' } }, 'SAFE TO SEND')
                    ),
                    /* rows */
                    h('div', { style: { display:'flex', flexDirection:'column', gap:8 } },
                      h('div', { style: { display:'flex', justifyContent:'space-between', alignItems:'center', padding:'8px 0', borderBottom:'1px solid rgba(255,255,255,0.04)' } },
                        h('span', { style: { color:'rgba(255,255,255,0.4)', fontSize:12, fontWeight:500 } }, 'Platform'),
                        h('span', { style: { color:'#fff', fontSize:13, fontWeight:600 } }, 'Trust Wallet')
                      ),
                      h('div', { style: { display:'flex', justifyContent:'space-between', alignItems:'center', padding:'8px 0', borderBottom:'1px solid rgba(255,255,255,0.04)' } },
                        h('span', { style: { color:'rgba(255,255,255,0.4)', fontSize:12, fontWeight:500 } }, 'Recipient'),
                        h('span', { style: { color:'#fff', fontSize:13, fontWeight:600 } }, 'T*** A. ', h('span', { style: { color:'rgba(255,255,255,0.3)', fontSize:11 } }, '· Personal wallet'))
                      ),
                      h('div', { style: { display:'flex', justifyContent:'space-between', alignItems:'center', padding:'8px 0' } },
                        h('span', { style: { color:'rgba(255,255,255,0.4)', fontSize:12, fontWeight:500 } }, 'Network'),
                        h('span', { style: { color:'#fff', fontSize:13, fontWeight:600 } }, 'Base')
                      )
                    )
                  ),

                  /* spacer */
                  h('div', { style: { flex:1, minHeight:10 } }),

                  /* CTA BUTTONS */
                  h('div', { style: { paddingBottom:16 } },
                    /* idle / input phase */
                    ['idle','select-asset','typing-amount','select-network','typing-address'].indexOf(phase) >= 0 &&
                      h('button', { disabled:true, style: { width:'100%', height:56, borderRadius:18, border:'none', background:'rgba(255,255,255,0.06)', color:'rgba(255,255,255,0.2)', fontSize:16, fontWeight:600, cursor:'default', opacity:0.5, fontFamily:'inherit' } }, 'Verify & Send'),

                    phase === 'inferring-platform' &&
                      h('button', { style: { width:'100%', height:56, borderRadius:18, border:'none', background: selectedPlatform ? '#fff' : 'rgba(255,255,255,0.06)', color: selectedPlatform ? '#000' : 'rgba(255,255,255,0.2)', fontSize:16, fontWeight:600, cursor:'pointer', transition:'all 0.3s ease', opacity: selectedPlatform ? 1 : 0.5, fontFamily:'inherit' } }, 'Verify Recipient'),

                    phase === 'verifying' &&
                      h('button', { disabled:true, style: { width:'100%', height:56, borderRadius:18, background:'rgba(255,255,255,0.05)', backdropFilter:'blur(8px)', border:'1px solid rgba(255,255,255,0.08)', color:'#fff', fontSize:16, fontWeight:500, cursor:'default', display:'flex', alignItems:'center', justifyContent:'center', gap:12, fontFamily:'inherit' } },
                        h('div', { style: { width:18, height:18, borderRadius:'50%', border:'2px solid rgba(52,211,153,0.3)', borderTopColor:'#34d399', animation:'spin 0.8s linear infinite' } }),
                        'Checking with Vervet...'
                      ),

                    (phase === 'verified' || phase === 'confirming') &&
                      h('button', { style: { width:'100%', height:56, borderRadius:18, border:'1px solid rgba(255,255,255,0.2)', background:'linear-gradient(135deg, #34d399, #06b6d4)', color:'#fff', fontSize:16, fontWeight:700, cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center', gap:10, boxShadow:'0 0 50px rgba(52,211,153,0.3)', animation:'fade-in-scale 0.4s ease-out', transform: phase === 'confirming' ? 'scale(0.97)' : 'scale(1)', transition:'transform 0.15s ease', fontFamily:'inherit' } },
                        'Confirm & Send ', h(ArrowRightIcon)
                      ),

                    phase === 'sending' &&
                      h('button', { disabled:true, style: { width:'100%', height:56, borderRadius:18, background:'rgba(52,211,153,0.12)', backdropFilter:'blur(8px)', border:'1px solid rgba(52,211,153,0.25)', color:'#34d399', fontSize:16, fontWeight:600, cursor:'default', display:'flex', alignItems:'center', justifyContent:'center', gap:12, fontFamily:'inherit' } },
                        h('div', { style: { width:18, height:18, position:'relative' } },
                          h('div', { style: { position:'absolute', inset:0, borderRadius:'50%', border:'2px solid rgba(52,211,153,0.2)' } }),
                          h('div', { style: { position:'absolute', inset:0, borderRadius:'50%', border:'2px solid #34d399', borderTopColor:'transparent', animation:'spin 0.8s linear infinite' } })
                        ),
                        'Releasing Funds...'
                      ),

                    /* secured badge */
                    phase !== 'idle' && h('div', { style: { display:'flex', alignItems:'center', justifyContent:'center', gap:7, marginTop:14 } },
                      h('div', { style: { width:6, height:6, borderRadius:'50%', background:'#34d399', boxShadow:'0 0 6px rgba(52,211,153,0.8)', animation:'pulse-glow 2s ease-in-out infinite' } }),
                      h('p', { style: { color:'rgba(255,255,255,0.3)', fontSize:10, fontWeight:700, textTransform:'uppercase', letterSpacing:'0.2em', margin:0 } }, 'Secured by Vervet')
                    )
                  )
                )
              )

            ) : (
              /* ── SUCCESS SCREEN ── */
              h('div', { style: { display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', height:'100%', textAlign:'center', padding:28, animation:'fade-in-scale 0.6s ease-out' } },
                h('div', { style: { position:'absolute', top:'45%', left:'50%', width:320, height:320, background:'radial-gradient(circle, rgba(52,211,153,0.18) 0%, transparent 70%)', borderRadius:'50%', transform:'translate(-50%,-50%)', pointerEvents:'none' } }),

                h('div', { style: { position:'relative', marginBottom:36 } },
                  h('div', { style: { position:'absolute', inset:-16, borderRadius:'50%', border:'2px solid rgba(52,211,153,0.15)', animation:'success-ring 1s ease-out forwards' } }),
                  h('div', { style: { position:'absolute', inset:-8, borderRadius:'50%', background:'rgba(52,211,153,0.08)', animation:'pulse-glow 3s ease-in-out infinite' } }),
                  h('div', { style: { width:96, height:96, borderRadius:'50%', background:'rgba(8,13,26,0.9)', border:'1px solid rgba(52,211,153,0.3)', display:'flex', alignItems:'center', justifyContent:'center', position:'relative', zIndex:1, boxShadow:'0 0 60px rgba(52,211,153,0.15)', animation:'check-pop 0.6s ease-out' } },
                    h(CheckIcon, { size:48 })
                  )
                ),

                h('h2', { style: { fontSize:30, fontWeight:700, letterSpacing:'-0.02em', background:'linear-gradient(180deg, #fff 30%, rgba(255,255,255,0.6))', WebkitBackgroundClip:'text', WebkitTextFillColor:'transparent', margin:'0 0 12px', position:'relative', zIndex:1 } }, 'Transfer Complete'),

                h('p', { style: { color:'rgba(255,255,255,0.4)', fontSize:15, lineHeight:1.7, margin:'0 0 12px', position:'relative', zIndex:1 } },
                  h('span', { style: { color:'#fff', fontWeight:600 } }, AMOUNT_VALUE + ' USDC'), ' sent via Base to',
                  h('br'), h('span', { style: { color:'#34d399', fontWeight:600 } }, 'T*** A.'), ' on Trust Wallet'
                ),

                h('div', { style: { background:'rgba(255,255,255,0.04)', border:'1px solid rgba(255,255,255,0.06)', borderRadius:12, padding:'10px 16px', marginBottom:32, position:'relative', zIndex:1 } },
                  h('span', { style: { color:'rgba(255,255,255,0.5)', fontSize:12, fontFamily:"'IBM Plex Mono','SF Mono',monospace" } }, WALLET_ADDR)
                ),

                h('div', { style: { position:'relative', zIndex:1, width:'100%', padding:'0 4px' } },
                  h('button', { style: { width:'100%', height:52, borderRadius:18, border:'1px solid rgba(255,255,255,0.1)', background:'rgba(255,255,255,0.08)', color:'#fff', fontSize:16, fontWeight:600, cursor:'pointer', transition:'all 0.3s', fontFamily:'inherit' } }, 'Done'),
                  h('div', { style: { display:'flex', alignItems:'center', justifyContent:'center', gap:7, marginTop:14 } },
                    h(VervetLogo),
                    h('p', { style: { color:'rgba(255,255,255,0.3)', fontSize:10, fontWeight:700, textTransform:'uppercase', letterSpacing:'0.2em', margin:0 } }, 'Powered by Vervet')
                  )
                )
              )
            )
          )
        ),

        /* Home indicator */
        h('div', { style: s.homeIndicator })
      )
    );
  }

  /* ── mount ── */
  var root = ReactDOM.createRoot(document.getElementById('phone-mount'));
  root.render(h(ConsumerDemo));
})();
