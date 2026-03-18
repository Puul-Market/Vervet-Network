"use client";

import { useState, useEffect, useCallback, CSSProperties } from "react";

/* ───────── keyframe animations ───────── */
const KEYFRAMES = `
@keyframes pulse-glow {
  0%, 100% { opacity: 0.4; }
  50% { opacity: 0.7; }
}
@keyframes spin { to { transform: rotate(360deg); } }
@keyframes fade-in { from { opacity: 0; transform: translateY(12px); } to { opacity: 1; transform: translateY(0); } }
@keyframes fade-in-scale { from { opacity: 0; transform: scale(0.92); } to { opacity: 1; transform: scale(1); } }
@keyframes blink { 0%, 100% { opacity: 1; } 50% { opacity: 0; } }
@keyframes float {
  0%, 100% { transform: translate(-50%, -50%) scale(1); }
  50% { transform: translate(-50%, -50%) scale(1.12); }
}
@keyframes success-ring {
  0% { transform: scale(0.5); opacity: 0; }
  60% { transform: scale(1.15); opacity: 0.5; }
  100% { transform: scale(1); opacity: 0.35; }
}
@keyframes slide-up {
  from { opacity: 0; transform: translateY(20px); }
  to { opacity: 1; transform: translateY(0); }
}
@keyframes check-pop {
  0% { transform: scale(0); opacity: 0; }
  60% { transform: scale(1.2); }
  100% { transform: scale(1); opacity: 1; }
}
`;

/* ───────── shared style objects ───────── */
const s = {
  page: {
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    minHeight: "100vh",
    background: "#000",
    fontFamily: "-apple-system, 'SF Pro Display', 'Helvetica Neue', sans-serif",
    padding: 24,
  } as CSSProperties,

  phone: {
    position: "relative",
    width: 393,
    height: 852,
    background: "#000",
    borderRadius: 55,
    boxShadow:
      "0 0 0 11px #1a1a1a, 0 0 0 13px #333, 0 30px 60px rgba(0,0,0,0.6)",
    overflow: "hidden",
  } as CSSProperties,

  dynamicIsland: {
    position: "absolute",
    top: 12,
    left: "50%",
    transform: "translateX(-50%)",
    width: 126,
    height: 37,
    background: "#000",
    borderRadius: 20,
    zIndex: 60,
    display: "flex",
    alignItems: "center",
    justifyContent: "flex-end",
    paddingRight: 12,
  } as CSSProperties,

  camera: {
    width: 14,
    height: 14,
    borderRadius: "50%",
    background: "radial-gradient(circle at 40% 35%, #1a1a3a, #0a0a1a)",
    border: "1px solid #111",
    boxShadow: "inset 0 0 3px rgba(50,50,150,0.3)",
  } as CSSProperties,

  statusBar: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    height: 56,
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    padding: "0 30px",
    zIndex: 50,
    color: "#fff",
    fontSize: 15,
    fontWeight: 600,
  } as CSSProperties,

  screen: {
    position: "absolute",
    inset: 0,
    background: "#030712",
    overflow: "hidden",
  } as CSSProperties,

  homeIndicator: {
    position: "absolute",
    bottom: 8,
    left: "50%",
    transform: "translateX(-50%)",
    width: 134,
    height: 5,
    background: "rgba(255,255,255,0.45)",
    borderRadius: 3,
    zIndex: 60,
  } as CSSProperties,
};

/* ───────── SVG icons ───────── */
function SignalIcon() {
  return (
    <svg width="17" height="14" viewBox="0 0 17 14" fill="none">
      <rect x="0" y="10" width="3" height="4" rx="1" fill="#fff" />
      <rect x="4.5" y="7" width="3" height="7" rx="1" fill="#fff" />
      <rect x="9" y="3.5" width="3" height="10.5" rx="1" fill="#fff" />
      <rect x="13.5" y="0" width="3" height="14" rx="1" fill="#fff" />
    </svg>
  );
}
function WifiIcon() {
  return (
    <svg width="16" height="14" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M5 12.55a11 11 0 0 1 14.08 0" /><path d="M1.42 9a16 16 0 0 1 21.16 0" /><path d="M8.53 16.11a6 6 0 0 1 6.95 0" /><circle cx="12" cy="20" r="1" fill="#fff" />
    </svg>
  );
}
function BatteryIcon() {
  return (
    <svg width="27" height="14" viewBox="0 0 27 14" fill="none">
      <rect x="0.5" y="0.5" width="22" height="13" rx="3" stroke="#fff" strokeOpacity="0.5" />
      <rect x="2" y="2" width="19" height="10" rx="2" fill="#fff" />
      <path d="M24 5v4a2 2 0 0 0 0-4z" fill="#fff" fillOpacity="0.4" />
    </svg>
  );
}
function CheckIcon({ size = 48 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="#34d399" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" /><polyline points="22 4 12 14.01 9 11.01" />
    </svg>
  );
}
function ChevronLeftIcon() {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.5)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="15 18 9 12 15 6" />
    </svg>
  );
}
function ChevronDownIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.4)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="6 9 12 15 18 9" />
    </svg>
  );
}
function ArrowRightIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <line x1="5" y1="12" x2="19" y2="12" /><polyline points="12 5 19 12 12 19" />
    </svg>
  );
}
function ShieldIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#34d399" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
    </svg>
  );
}
function VervetLogo() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
      <circle cx="12" cy="12" r="10" stroke="#34d399" strokeWidth="1.5" />
      <path d="M8 12l3 3 5-6" stroke="#34d399" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

/* ───────── flow phases ───────── */
type Phase =
  | "idle"
  | "select-asset"
  | "typing-amount"
  | "select-network"
  | "typing-address"
  | "inferring-platform"
  | "verifying"
  | "verified"
  | "confirming"
  | "sending"
  | "success";

const WALLET_ADDR = "0x7a2f8B3c...e4c1b9f4";
const WALLET_ADDR_FULL = "0x7a2f8B3cD91E56aB...e4c1b9f4";
const AMOUNT_VALUE = "1,000.00";

export default function ConsumerDemo() {
  const [phase, setPhase] = useState<Phase>("idle");
  const [selectedAsset, setSelectedAsset] = useState("");
  const [typedAmount, setTypedAmount] = useState("");
  const [selectedNetwork, setSelectedNetwork] = useState("");
  const [selectedPlatform, setSelectedPlatform] = useState("");
  const [typedAddress, setTypedAddress] = useState("");
  const [time, setTime] = useState("9:41");

  /* live clock */
  useEffect(() => {
    const tick = () =>
      setTime(
        new Date().toLocaleTimeString([], {
          hour: "numeric",
          minute: "2-digit",
          hour12: false,
        })
      );
    tick();
    const id = setInterval(tick, 10_000);
    return () => clearInterval(id);
  }, []);

  /* ── auto-play sequencer ── */
  const runSequence = useCallback(() => {
    let cancelled = false;
    const wait = (ms: number) =>
      new Promise<void>((r) => {
        const t = setTimeout(r, ms);
        if (cancelled) clearTimeout(t);
      });

    const run = async () => {
      /* reset */
      setSelectedAsset("");
      setTypedAmount("");
      setSelectedNetwork("");
      setSelectedPlatform("");
      setTypedAddress("");
      setPhase("idle");
      await wait(1400);
      if (cancelled) return;

      /* step 1 – select asset */
      setPhase("select-asset");
      await wait(1000);
      if (cancelled) return;
      setSelectedAsset("USDC");
      await wait(600);
      if (cancelled) return;

      /* step 2 – type amount */
      setPhase("typing-amount");
      const amountChars = AMOUNT_VALUE;
      for (let i = 0; i < amountChars.length; i++) {
        if (cancelled) return;
        setTypedAmount(amountChars.slice(0, i + 1));
        await wait(60 + Math.random() * 80);
      }
      await wait(600);
      if (cancelled) return;

      /* step 3 – select network */
      setPhase("select-network");
      await wait(1000);
      if (cancelled) return;
      setSelectedNetwork("Base");
      await wait(800);
      if (cancelled) return;

      /* step 4 – type wallet address */
      setPhase("typing-address");
      const addrChars = WALLET_ADDR_FULL;
      for (let i = 0; i < addrChars.length; i++) {
        if (cancelled) return;
        setTypedAddress(addrChars.slice(0, i + 1));
        await wait(25 + Math.random() * 30);
      }
      await wait(800);
      if (cancelled) return;

      /* step 5 – inferring platform */
      setPhase("inferring-platform");
      await wait(1200);
      if (cancelled) return;
      setSelectedPlatform("Trust Wallet");
      await wait(1000);
      if (cancelled) return;

      /* step 6 – verifying with Vervet */
      setPhase("verifying");
      await wait(2600);
      if (cancelled) return;

      /* step 7 – verified: show confirmation */
      setPhase("verified");
      await wait(3500);
      if (cancelled) return;

      /* step 8 – confirm & send press */
      setPhase("confirming");
      await wait(400);
      if (cancelled) return;

      /* sending */
      setPhase("sending");
      await wait(2800);
      if (cancelled) return;

      /* success */
      setPhase("success");
      await wait(5000);
      if (cancelled) return;

      /* loop */
      void run();
    };

    void run();

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    const cancel = runSequence();
    return cancel;
  }, [runSequence]);

  /* ── derived state ── */
  const showForm = phase !== "success";
  const showAmount =
    phase !== "idle" && phase !== "select-asset";
  const showNetwork =
    showAmount && phase !== "typing-amount";
  const showAddress =
    showNetwork && phase !== "select-network";
  const showPlatform =
    showAddress && phase !== "typing-address";
    
  const showVerified =
    phase === "verified" || phase === "confirming" || phase === "sending";

  /* ── selector chip style ── */
  const chipStyle = (
    active: boolean,
    filled: boolean
  ): CSSProperties => ({
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    padding: "14px 16px",
    background: filled
      ? "rgba(52,211,153,0.08)"
      : active
      ? "rgba(9,14,26,0.9)"
      : "rgba(9,14,26,0.6)",
    border: `1px solid ${
      filled
        ? "rgba(52,211,153,0.25)"
        : active
        ? "rgba(6,182,212,0.5)"
        : "rgba(255,255,255,0.06)"
    }`,
    borderRadius: 16,
    transition: "all 0.3s ease",
    boxShadow: active ? "0 0 0 3px rgba(6,182,212,0.06)" : "none",
  });

  return (
    <div style={s.page}>
      <style dangerouslySetInnerHTML={{ __html: KEYFRAMES }} />

      <div style={s.phone}>
        {/* Dynamic Island */}
        <div style={s.dynamicIsland}>
          <div style={s.camera} />
        </div>

        {/* Status bar */}
        <div style={s.statusBar}>
          <span>{time}</span>
          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <SignalIcon />
            <WifiIcon />
            <BatteryIcon />
          </div>
        </div>

        {/* Screen */}
        <div style={s.screen}>
          {/* Ambient glow orbs */}
          <div
            style={{
              position: "absolute",
              top: "-15%",
              left: "-25%",
              width: 380,
              height: 380,
              background:
                "radial-gradient(circle, rgba(6,182,212,0.12) 0%, transparent 70%)",
              borderRadius: "50%",
              animation: "float 8s ease-in-out infinite",
              pointerEvents: "none",
            }}
          />
          <div
            style={{
              position: "absolute",
              bottom: "-15%",
              right: "-25%",
              width: 450,
              height: 450,
              background:
                "radial-gradient(circle, rgba(52,211,153,0.10) 0%, transparent 70%)",
              borderRadius: "50%",
              animation: "float 10s ease-in-out infinite 2s",
              pointerEvents: "none",
            }}
          />
          {/* noise overlay */}
          <div
            style={{
              position: "absolute",
              inset: 0,
              background: "rgba(3,7,18,0.35)",
              backdropFilter: "blur(80px)",
              pointerEvents: "none",
            }}
          />

          {/* Content */}
          <div
            style={{
              position: "relative",
              zIndex: 10,
              height: "100%",
              display: "flex",
              flexDirection: "column",
              paddingTop: 60,
            }}
          >
            {showForm ? (
              /* ───── SEND SCREEN ───── */
              <div
                style={{
                  display: "flex",
                  flexDirection: "column",
                  height: "100%",
                  animation: "fade-in 0.5s ease-out",
                }}
              >
                {/* top gradient line */}
                <div
                  style={{
                    height: 1,
                    background:
                      "linear-gradient(90deg, transparent, rgba(255,255,255,0.15), transparent)",
                  }}
                />

                {/* header */}
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    padding: "10px 20px 0",
                    marginBottom: 20,
                  }}
                >
                  <div style={{ padding: 6 }}>
                    <ChevronLeftIcon />
                  </div>
                  <div
                    style={{
                      flex: 1,
                      textAlign: "center",
                      color: "rgba(255,255,255,0.9)",
                      fontSize: 17,
                      fontWeight: 600,
                      letterSpacing: "0.02em",
                    }}
                  >
                    Send Crypto
                  </div>
                  <div style={{ width: 36 }} />
                </div>

                {/* scrollable content */}
                <div
                  style={{
                    padding: "0 20px",
                    display: "flex",
                    flexDirection: "column",
                    gap: 12,
                    flex: 1,
                    overflowY: "auto",
                    paddingBottom: 40,
                  }}
                >
                  {/* ──── Step 1: Asset selector ──── */}
                  <div>
                    <p
                      style={{
                        color: "rgba(255,255,255,0.35)",
                        fontSize: 10,
                        fontWeight: 700,
                        textTransform: "uppercase",
                        letterSpacing: "0.15em",
                        margin: "0 0 6px 4px",
                      }}
                    >
                      Asset
                    </p>
                    <div
                      style={chipStyle(
                        phase === "select-asset",
                        !!selectedAsset
                      )}
                    >
                      <div
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: 10,
                        }}
                      >
                        {selectedAsset ? (
                          <>
                            <div
                              style={{
                                width: 28,
                                height: 28,
                                borderRadius: "50%",
                                background:
                                  "linear-gradient(135deg, #2775ca, #3b99fc)",
                                display: "flex",
                                alignItems: "center",
                                justifyContent: "center",
                                fontSize: 12,
                                fontWeight: 800,
                                color: "#fff",
                              }}
                            >
                              $
                            </div>
                            <span
                              style={{
                                color: "#fff",
                                fontSize: 15,
                                fontWeight: 600,
                              }}
                            >
                              USDC
                            </span>
                          </>
                        ) : (
                          <span
                            style={{
                              color: "rgba(255,255,255,0.25)",
                              fontSize: 14,
                            }}
                          >
                            Select asset
                          </span>
                        )}
                      </div>
                      <ChevronDownIcon />
                    </div>
                  </div>

                  {/* ──── Step 2: Amount input ──── */}
                  {showAmount && (
                    <div style={{ animation: "slide-up 0.4s ease-out" }}>
                      <p
                        style={{
                          color: "rgba(255,255,255,0.35)",
                          fontSize: 10,
                          fontWeight: 700,
                          textTransform: "uppercase",
                          letterSpacing: "0.15em",
                          margin: "0 0 6px 4px",
                        }}
                      >
                        Amount
                      </p>
                      <div
                        style={{
                          position: "relative",
                          background: "rgba(9,14,26,0.8)",
                          backdropFilter: "blur(20px)",
                          border: `1px solid ${
                            phase === "typing-amount"
                              ? "rgba(6,182,212,0.5)"
                              : "rgba(255,255,255,0.08)"
                          }`,
                          borderRadius: 16,
                          overflow: "hidden",
                          transition: "border-color 0.3s ease",
                          boxShadow:
                            phase === "typing-amount"
                              ? "0 0 0 3px rgba(6,182,212,0.08)"
                              : "inset 0 1px 3px rgba(0,0,0,0.3)",
                        }}
                      >
                       <div
                          style={{
                            padding: "14px 16px",
                            fontSize: 16,
                            fontWeight: 600,
                            color: "#fff",
                            minHeight: 52,
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "space-between",
                          }}
                        >
                          <div style={{ display: "flex", alignItems: "center" }}>
                            {typedAmount || (
                              <span
                                style={{
                                  color: "rgba(255,255,255,0.15)",
                                  fontWeight: 500,
                                }}
                              >
                                0.00
                              </span>
                            )}
                            {phase === "typing-amount" && (
                              <span
                                style={{
                                  animation:
                                    "blink 1s step-end infinite",
                                  color: "#06b6d4",
                                  marginLeft: 2,
                                  fontWeight: 300,
                                }}
                              >
                                |
                              </span>
                            )}
                          </div>
                          <span style={{ color: "rgba(255,255,255,0.4)", fontSize: 13, fontWeight: 500 }}>
                            USDC
                          </span>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* ──── Step 3: Network selector ──── */}
                  {showNetwork && (
                    <div style={{ animation: "slide-up 0.4s ease-out" }}>
                      <p
                        style={{
                          color: "rgba(255,255,255,0.35)",
                          fontSize: 10,
                          fontWeight: 700,
                          textTransform: "uppercase",
                          letterSpacing: "0.15em",
                          margin: "0 0 6px 4px",
                        }}
                      >
                        Network
                      </p>
                      <div
                        style={chipStyle(
                          phase === "select-network",
                          !!selectedNetwork
                        )}
                      >
                        <div
                          style={{
                            display: "flex",
                            alignItems: "center",
                            gap: 10,
                          }}
                        >
                          {selectedNetwork ? (
                            <>
                              <div
                                style={{
                                  width: 28,
                                  height: 28,
                                  borderRadius: "50%",
                                  background: "#0052ff",
                                  display: "flex",
                                  alignItems: "center",
                                  justifyContent: "center",
                                }}
                              >
                                <svg
                                  width="16"
                                  height="16"
                                  viewBox="0 0 24 24"
                                  fill="#fff"
                                >
                                  <circle cx="12" cy="12" r="10" />
                                </svg>
                              </div>
                              <span
                                style={{
                                  color: "#fff",
                                  fontSize: 15,
                                  fontWeight: 600,
                                }}
                              >
                                Base
                              </span>
                            </>
                          ) : (
                            <span
                              style={{
                                color: "rgba(255,255,255,0.25)",
                                fontSize: 14,
                              }}
                            >
                              Select network
                            </span>
                          )}
                        </div>
                        <ChevronDownIcon />
                      </div>
                    </div>
                  )}

                  {/* ──── Step 4: Wallet Address input ──── */}
                  {showAddress && (
                    <div style={{ animation: "slide-up 0.4s ease-out" }}>
                      <p
                        style={{
                          color: "rgba(255,255,255,0.35)",
                          fontSize: 10,
                          fontWeight: 700,
                          textTransform: "uppercase",
                          letterSpacing: "0.15em",
                          margin: "0 0 6px 4px",
                        }}
                      >
                        Recipient Wallet Address
                      </p>
                      <div
                        style={{
                          position: "relative",
                          background: "rgba(9,14,26,0.8)",
                          backdropFilter: "blur(20px)",
                          border: `1px solid ${
                            phase === "typing-address"
                              ? "rgba(6,182,212,0.5)"
                              : "rgba(255,255,255,0.08)"
                          }`,
                          borderRadius: 16,
                          overflow: "hidden",
                          transition: "border-color 0.3s ease",
                          boxShadow:
                            phase === "typing-address"
                              ? "0 0 0 3px rgba(6,182,212,0.08)"
                              : "inset 0 1px 3px rgba(0,0,0,0.3)",
                        }}
                      >
                        <div
                          style={{
                            padding: "14px 16px",
                            fontSize: 13,
                            fontWeight: 500,
                            color: "#fff",
                            fontFamily:
                              "'SF Mono', 'Fira Code', monospace",
                            letterSpacing: "-0.02em",
                            minHeight: 48,
                            display: "flex",
                            alignItems: "center",
                            wordBreak: "break-all",
                          }}
                        >
                          {typedAddress || (
                            <span
                              style={{
                                color: "rgba(255,255,255,0.15)",
                                fontFamily:
                                  "-apple-system, sans-serif",
                              }}
                            >
                              Paste wallet address
                            </span>
                          )}
                          {phase === "typing-address" && (
                            <span
                              style={{
                                animation:
                                  "blink 1s step-end infinite",
                                color: "#06b6d4",
                                marginLeft: 1,
                                fontWeight: 300,
                              }}
                            >
                              |
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  )}

                  {/* ──── Step 5: Inferred Platform ──── */}
                  {showPlatform && (
                    <div style={{ animation: "slide-up 0.5s cubic-bezier(0.16, 1, 0.3, 1)" }}>
                      <p
                        style={{
                          color: "rgba(255,255,255,0.35)",
                          fontSize: 10,
                          fontWeight: 700,
                          textTransform: "uppercase",
                          letterSpacing: "0.15em",
                          margin: "0 0 6px 4px",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "space-between"
                        }}
                      >
                        <span>Recipient Platform</span>
                        {phase === "inferring-platform" ? (
                          <span style={{ color: "#06b6d4", fontSize: 9 }}>Inferring...</span>
                        ) : (
                          <span style={{ color: "rgba(255,255,255,0.2)", fontSize: 9 }}>Optional</span>
                        )}
                      </p>
                      <div
                        style={chipStyle(
                          phase === "inferring-platform",
                          !!selectedPlatform
                        )}
                      >
                        <div
                          style={{
                            display: "flex",
                            alignItems: "center",
                            gap: 10,
                          }}
                        >
                          {selectedPlatform ? (
                            <>
                              <div
                                style={{
                                  width: 28,
                                  height: 28,
                                  borderRadius: 8,
                                  background:
                                    "linear-gradient(135deg, #0500FF, #06d6a0)",
                                  display: "flex",
                                  alignItems: "center",
                                  justifyContent: "center",
                                  fontSize: 14,
                                  color: "#fff",
                                  fontWeight: 800,
                                }}
                              >
                                T
                              </div>
                              <div style={{ display: "flex", flexDirection: "column" }}>
                                <span
                                  style={{
                                    color: "#fff",
                                    fontSize: 15,
                                    fontWeight: 600,
                                  }}
                                >
                                  Trust Wallet
                                </span>
                                <span style={{ color: "#34d399", fontSize: 10, fontWeight: 600 }}>Suggested by Vervet</span>
                              </div>
                            </>
                          ) : (
                            <span
                              style={{
                                color: "rgba(255,255,255,0.25)",
                                fontSize: 14,
                              }}
                            >
                              Unknown Platform
                            </span>
                          )}
                        </div>
                        <ChevronDownIcon />
                      </div>
                    </div>
                  )}

                  {/* ──── Step 6: Verifying with Vervet ──── */}
                  {phase === "verifying" && (
                    <div
                      style={{
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        gap: 10,
                        padding: "16px 0",
                        animation: "fade-in 0.4s ease-out",
                      }}
                    >
                      <div
                        style={{
                          width: 18,
                          height: 18,
                          borderRadius: "50%",
                          border: "2px solid rgba(52,211,153,0.3)",
                          borderTopColor: "#34d399",
                          animation: "spin 0.8s linear infinite",
                        }}
                      />
                      <span
                        style={{
                          color: "rgba(255,255,255,0.5)",
                          fontSize: 13,
                          fontWeight: 500,
                        }}
                      >
                        Verifying with Vervet...
                      </span>
                    </div>
                  )}

                  {/* ──── Step 7 & 8: Verified Confirmation Card ──── */}
                  {showVerified && (
                    <div
                      style={{
                        background:
                          "linear-gradient(180deg, rgba(52,211,153,0.10) 0%, rgba(52,211,153,0.03) 100%)",
                        border: "1px solid rgba(52,211,153,0.2)",
                        borderRadius: 20,
                        padding: "16px 16px 18px",
                        animation: "fade-in-scale 0.5s ease-out",
                        boxShadow: "0 0 40px rgba(52,211,153,0.06)",
                        backdropFilter: "blur(12px)",
                        marginTop: 6
                      }}
                    >
                      {/* Header */}
                      <div
                        style={{
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "space-between",
                          marginBottom: 14,
                        }}
                      >
                        <div
                          style={{
                            display: "flex",
                            alignItems: "center",
                            gap: 8,
                          }}
                        >
                          <ShieldIcon />
                          <span
                            style={{
                              color: "#34d399",
                              fontSize: 11,
                              fontWeight: 800,
                              letterSpacing: "0.15em",
                              textTransform: "uppercase",
                            }}
                          >
                            Verified Destination
                          </span>
                        </div>
                        <div
                          style={{
                            background: "rgba(52,211,153,0.15)",
                            border: "1px solid rgba(52,211,153,0.3)",
                            borderRadius: 8,
                            padding: "3px 10px",
                            fontSize: 10,
                            fontWeight: 700,
                            color: "#34d399",
                            letterSpacing: "0.05em",
                          }}
                        >
                          SAFE TO SEND
                        </div>
                      </div>

                      {/* Detail rows */}
                      <div
                        style={{
                          display: "flex",
                          flexDirection: "column",
                          gap: 8,
                        }}
                      >
                        
                        {/* Platform */}
                        <div
                          style={{
                            display: "flex",
                            justifyContent: "space-between",
                            alignItems: "center",
                            padding: "8px 0",
                            borderBottom:
                              "1px solid rgba(255,255,255,0.04)",
                          }}
                        >
                          <span
                            style={{
                              color: "rgba(255,255,255,0.4)",
                              fontSize: 12,
                              fontWeight: 500,
                            }}
                          >
                            Platform
                          </span>
                          <span
                            style={{
                              color: "#fff",
                              fontSize: 13,
                              fontWeight: 600,
                            }}
                          >
                            Trust Wallet
                          </span>
                        </div>

                        {/* Recipient */}
                        <div
                          style={{
                            display: "flex",
                            justifyContent: "space-between",
                            alignItems: "center",
                            padding: "8px 0",
                            borderBottom:
                              "1px solid rgba(255,255,255,0.04)",
                          }}
                        >
                          <span
                            style={{
                              color: "rgba(255,255,255,0.4)",
                              fontSize: 12,
                              fontWeight: 500,
                            }}
                          >
                            Recipient
                          </span>
                          <span
                            style={{
                              color: "#fff",
                              fontSize: 13,
                              fontWeight: 600,
                            }}
                          >
                            T*** A.{" "}
                            <span
                              style={{
                                color: "rgba(255,255,255,0.3)",
                                fontSize: 11,
                              }}
                            >
                              · Personal wallet
                            </span>
                          </span>
                        </div>

                        {/* Network */}
                        <div
                          style={{
                            display: "flex",
                            justifyContent: "space-between",
                            alignItems: "center",
                            padding: "8px 0",
                          }}
                        >
                          <span
                            style={{
                              color: "rgba(255,255,255,0.4)",
                              fontSize: 12,
                              fontWeight: 500,
                            }}
                          >
                            Network
                          </span>
                          <span
                            style={{
                              color: "#fff",
                              fontSize: 13,
                              fontWeight: 600,
                            }}
                          >
                            Base
                          </span>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Spacer to push button down if needed */}
                  <div style={{ flex: 1, minHeight: 10 }} />

                  {/* ── CTA Buttons ── */}
                  <div style={{ paddingBottom: 16 }}>
                    {/* Idle / selecting state */}
                    {(phase === "idle" || phase === "select-asset" || phase === "typing-amount" || phase === "select-network" || phase === "typing-address") && (
                      <button
                        disabled
                        style={{
                          width: "100%",
                          height: 56,
                          borderRadius: 18,
                          border: "none",
                          background: "rgba(255,255,255,0.06)",
                          color: "rgba(255,255,255,0.2)",
                          fontSize: 16,
                          fontWeight: 600,
                          cursor: "default",
                          opacity: 0.5,
                        }}
                      >
                        Verify &amp; Send
                      </button>
                    )}

                    {/* Inferring Platform / Show Verify Button */}
                    {phase === "inferring-platform" && (
                      <button
                        style={{
                          width: "100%",
                          height: 56,
                          borderRadius: 18,
                          border: "none",
                          background: selectedPlatform ? "#fff" : "rgba(255,255,255,0.06)",
                          color: selectedPlatform ? "#000" : "rgba(255,255,255,0.2)",
                          fontSize: 16,
                          fontWeight: 600,
                          cursor: "pointer",
                          transition: "all 0.3s ease",
                          opacity: selectedPlatform ? 1 : 0.5,
                        }}
                      >
                        Verify Recipient
                      </button>
                    )}

                    {/* Verifying */}
                    {phase === "verifying" && (
                      <button
                        disabled
                        style={{
                          width: "100%",
                          height: 56,
                          borderRadius: 18,
                          background: "rgba(255,255,255,0.05)",
                          backdropFilter: "blur(8px)",
                          border: "1px solid rgba(255,255,255,0.08)",
                          color: "#fff",
                          fontSize: 16,
                          fontWeight: 500,
                          cursor: "default",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          gap: 12,
                        }}
                      >
                        <div
                          style={{
                            width: 18,
                            height: 18,
                            borderRadius: "50%",
                            border: "2px solid rgba(52,211,153,0.3)",
                            borderTopColor: "#34d399",
                            animation: "spin 0.8s linear infinite",
                          }}
                        />
                        Checking with Vervet...
                      </button>
                    )}

                    {/* Verified – Confirm & Send */}
                    {(phase === "verified" ||
                      phase === "confirming") && (
                      <button
                        style={{
                          width: "100%",
                          height: 56,
                          borderRadius: 18,
                          border:
                            "1px solid rgba(255,255,255,0.2)",
                          background:
                            "linear-gradient(135deg, #34d399, #06b6d4)",
                          color: "#fff",
                          fontSize: 16,
                          fontWeight: 700,
                          cursor: "pointer",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          gap: 10,
                          boxShadow:
                            "0 0 50px rgba(52,211,153,0.3)",
                          animation:
                            "fade-in-scale 0.4s ease-out",
                          transform:
                            phase === "confirming"
                              ? "scale(0.97)"
                              : "scale(1)",
                          transition: "transform 0.15s ease",
                        }}
                      >
                        Confirm &amp; Send <ArrowRightIcon />
                      </button>
                    )}

                    {/* Sending */}
                    {phase === "sending" && (
                      <button
                        disabled
                        style={{
                          width: "100%",
                          height: 56,
                          borderRadius: 18,
                          background: "rgba(52,211,153,0.12)",
                          backdropFilter: "blur(8px)",
                          border:
                            "1px solid rgba(52,211,153,0.25)",
                          color: "#34d399",
                          fontSize: 16,
                          fontWeight: 600,
                          cursor: "default",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          gap: 12,
                        }}
                      >
                        <div
                          style={{
                            width: 18,
                            height: 18,
                            position: "relative",
                          }}
                        >
                          <div
                            style={{
                              position: "absolute",
                              inset: 0,
                              borderRadius: "50%",
                              border:
                                "2px solid rgba(52,211,153,0.2)",
                            }}
                          />
                          <div
                            style={{
                              position: "absolute",
                              inset: 0,
                              borderRadius: "50%",
                              border: "2px solid #34d399",
                              borderTopColor: "transparent",
                              animation:
                                "spin 0.8s linear infinite",
                            }}
                          />
                        </div>
                        Releasing Funds...
                      </button>
                    )}

                    {/* Secured by Vervet */}
                    {phase !== "idle" && (
                      <div
                        style={{
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          gap: 7,
                          marginTop: 14,
                        }}
                      >
                        <div
                          style={{
                            width: 6,
                            height: 6,
                            borderRadius: "50%",
                            background: "#34d399",
                            boxShadow:
                              "0 0 6px rgba(52,211,153,0.8)",
                            animation:
                              "pulse-glow 2s ease-in-out infinite",
                          }}
                        />
                        <p
                          style={{
                            color: "rgba(255,255,255,0.3)",
                            fontSize: 10,
                            fontWeight: 700,
                            textTransform: "uppercase",
                            letterSpacing: "0.2em",
                            margin: 0,
                          }}
                        >
                          Secured by Vervet
                        </p>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ) : (
              /* ───── SUCCESS SCREEN ───── */
              <div
                style={{
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  justifyContent: "center",
                  height: "100%",
                  textAlign: "center",
                  padding: 28,
                  animation: "fade-in-scale 0.6s ease-out",
                }}
              >
                {/* success glow */}
                <div
                  style={{
                    position: "absolute",
                    top: "45%",
                    left: "50%",
                    width: 320,
                    height: 320,
                    background:
                      "radial-gradient(circle, rgba(52,211,153,0.18) 0%, transparent 70%)",
                    borderRadius: "50%",
                    transform: "translate(-50%,-50%)",
                    pointerEvents: "none",
                  }}
                />

                {/* check ring */}
                <div
                  style={{
                    position: "relative",
                    marginBottom: 36,
                  }}
                >
                  <div
                    style={{
                      position: "absolute",
                      inset: -16,
                      borderRadius: "50%",
                      border: "2px solid rgba(52,211,153,0.15)",
                      animation:
                        "success-ring 1s ease-out forwards",
                    }}
                  />
                  <div
                    style={{
                      position: "absolute",
                      inset: -8,
                      borderRadius: "50%",
                      background: "rgba(52,211,153,0.08)",
                      animation:
                        "pulse-glow 3s ease-in-out infinite",
                    }}
                  />
                  <div
                    style={{
                      width: 96,
                      height: 96,
                      borderRadius: "50%",
                      background: "rgba(8,13,26,0.9)",
                      border:
                        "1px solid rgba(52,211,153,0.3)",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      position: "relative",
                      zIndex: 1,
                      boxShadow:
                        "0 0 60px rgba(52,211,153,0.15)",
                      animation: "check-pop 0.6s ease-out",
                    }}
                  >
                    <CheckIcon size={48} />
                  </div>
                </div>

                <h2
                  style={{
                    fontSize: 30,
                    fontWeight: 700,
                    letterSpacing: "-0.02em",
                    background:
                      "linear-gradient(180deg, #fff 30%, rgba(255,255,255,0.6))",
                    WebkitBackgroundClip: "text",
                    WebkitTextFillColor: "transparent",
                    margin: "0 0 12px",
                    position: "relative",
                    zIndex: 1,
                  }}
                >
                  Transfer Complete
                </h2>

                <p
                  style={{
                    color: "rgba(255,255,255,0.4)",
                    fontSize: 15,
                    lineHeight: 1.7,
                    margin: "0 0 12px",
                    position: "relative",
                    zIndex: 1,
                  }}
                >
                  <span style={{ color: "#fff", fontWeight: 600 }}>{AMOUNT_VALUE} USDC</span> sent via Base to
                  <br />
                  <span
                    style={{
                      color: "#34d399",
                      fontWeight: 600,
                    }}
                  >
                    T*** A.
                  </span>{" "}
                  on Trust Wallet
                </p>

                <div
                  style={{
                    background: "rgba(255,255,255,0.04)",
                    border: "1px solid rgba(255,255,255,0.06)",
                    borderRadius: 12,
                    padding: "10px 16px",
                    marginBottom: 32,
                    position: "relative",
                    zIndex: 1,
                  }}
                >
                  <span
                    style={{
                      color: "rgba(255,255,255,0.5)",
                      fontSize: 12,
                      fontFamily:
                        "'SF Mono', 'Fira Code', monospace",
                    }}
                  >
                    {WALLET_ADDR}
                  </span>
                </div>

                <div
                  style={{
                    position: "relative",
                    zIndex: 1,
                    width: "100%",
                    padding: "0 4px",
                  }}
                >
                  <button
                    style={{
                      width: "100%",
                      height: 52,
                      borderRadius: 18,
                      border:
                        "1px solid rgba(255,255,255,0.1)",
                      background: "rgba(255,255,255,0.08)",
                      color: "#fff",
                      fontSize: 16,
                      fontWeight: 600,
                      cursor: "pointer",
                      transition: "all 0.3s",
                    }}
                  >
                    Done
                  </button>
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      gap: 7,
                      marginTop: 14,
                    }}
                  >
                    <VervetLogo />
                    <p
                      style={{
                        color: "rgba(255,255,255,0.3)",
                        fontSize: 10,
                        fontWeight: 700,
                        textTransform: "uppercase",
                        letterSpacing: "0.2em",
                        margin: 0,
                      }}
                    >
                      Powered by Vervet
                    </p>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Home indicator */}
        <div style={s.homeIndicator} />
      </div>
    </div>
  );
}
