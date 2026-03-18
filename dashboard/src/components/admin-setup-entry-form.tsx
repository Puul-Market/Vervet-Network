"use client";

import { useActionState } from "react";
import {
  adminSetupLoginAction,
  type AdminSetupFormState,
} from "@/app/session-actions";

const initialState: AdminSetupFormState = {
  errorMessage: null,
};

export function AdminSetupEntryForm() {
  const [state, formAction, isPending] = useActionState(
    adminSetupLoginAction,
    initialState,
  );

  return (
    <form className="auth-card admin-card" action={formAction}>
      <div className="auth-copy">
        <p className="eyebrow">Admin Setup</p>
        <h1>Bootstrap a partner without leaving the dashboard.</h1>
        <p className="lede">
          Enter the admin setup token to create a partner, register the first
          signing key, and create the first dashboard owner account from the
          UI.
        </p>
      </div>

      <label className="field">
        <span>Admin setup token</span>
        <input
          aria-label="Admin setup token"
          autoComplete="off"
          name="adminToken"
          placeholder="admin-token"
          spellCheck={false}
          type="password"
        />
      </label>

      {state.errorMessage ? (
        <p className="form-error" role="alert">
          {state.errorMessage}
        </p>
      ) : null}

      <button className="secondary-button inverted-button" disabled={isPending} type="submit">
        {isPending ? "Checking..." : "Open setup"}
      </button>
    </form>
  );
}
