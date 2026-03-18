import Link from "next/link";
import { redirect } from "next/navigation";
import { LoginForm } from "@/components/login-form";
import { getAdminSetupSession, getDashboardSession } from "@/lib/session";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  const session = await getDashboardSession();
  const adminSession = await getAdminSetupSession();

  if (session) {
    redirect("/overview");
  }

  return (
    <main className="login-page">
      <div className="login-brand">
        <div className="login-brand-inner">
          <div className="login-logo">
            <svg width="32" height="32" viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M16 2L28 8V24L16 30L4 24V8L16 2Z" fill="url(#logo-gradient)" fillOpacity="0.15" stroke="url(#logo-gradient)" strokeWidth="1.5"/>
              <path d="M10 12L16 22L22 12" stroke="url(#logo-gradient)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
              <defs>
                <linearGradient id="logo-gradient" x1="4" y1="2" x2="28" y2="30" gradientUnits="userSpaceOnUse">
                  <stop stopColor="#34d399"/>
                  <stop offset="1" stopColor="#06b6d4"/>
                </linearGradient>
              </defs>
            </svg>
            <span>Vervet</span>
          </div>

          <div className="login-brand-content">
            <h1>Verified wallet resolution for the modern financial&nbsp;stack.</h1>
            <p>Resolve recipients, verify destinations, and manage partner operations — all from one dashboard.</p>
          </div>

          <div className="login-trust-badges">
            <div className="trust-badge">
              <span className="trust-icon">⚡</span>
              <span>&lt;&thinsp;200ms resolution</span>
            </div>
            <div className="trust-badge">
              <span className="trust-icon">🔒</span>
              <span>End-to-end encrypted</span>
            </div>
            <div className="trust-badge">
              <span className="trust-icon">✓</span>
              <span>Audit-ready logs</span>
            </div>
          </div>
        </div>
      </div>

      <div className="login-form-panel">
        <div className="login-form-inner">
          <LoginForm />

          <div className="login-footer">
            {adminSession ? (
              <Link href="/setup" className="login-admin-link">
                Resume admin setup →
              </Link>
            ) : (
              <Link href="/setup" className="login-admin-link">
                Admin setup →
              </Link>
            )}
            <p className="login-copyright">© 2026 Vervet Network</p>
          </div>
        </div>
      </div>
    </main>
  );
}
