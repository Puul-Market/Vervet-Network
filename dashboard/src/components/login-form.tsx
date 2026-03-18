"use client";

import { useActionState } from "react";
import { loginAction, type LoginFormState } from "@/app/session-actions";

const initialState: LoginFormState = {
  errorMessage: null,
};

export function LoginForm() {
  const [state, formAction, isPending] = useActionState(
    loginAction,
    initialState,
  );

  return (
    <form className="login-form" action={formAction}>
      <div className="login-form-header">
        <h2>Sign in</h2>
        <p>Access your partner dashboard</p>
      </div>

      <div className="login-fields">
        <label className="login-field">
          <span>Email address</span>
          <input
            aria-label="Email address"
            autoComplete="email"
            name="email"
            placeholder="you@company.com"
            type="email"
          />
        </label>

        <label className="login-field">
          <span>Password</span>
          <input
            aria-label="Password"
            autoComplete="current-password"
            name="password"
            placeholder="Enter your password"
            type="password"
          />
        </label>
      </div>

      {state.errorMessage ? (
        <p className="login-error" role="alert">
          {state.errorMessage}
        </p>
      ) : null}

      <button className="login-submit" disabled={isPending} type="submit">
        {isPending ? (
          <span className="login-spinner" />
        ) : null}
        {isPending ? "Signing in..." : "Continue"}
      </button>
    </form>
  );
}
