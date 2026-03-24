/**
 * LoginScreen — minimal center layout.
 * App name "啥意思", mock sign-in buttons.
 */

import React from "react";
import { base, colors } from "../styles.js";

interface Props {
  onLogin: (userId: string) => void;
}

export function LoginScreen({ onLogin }: Props): React.JSX.Element {
  return (
    <div style={base.screen} role="main" aria-label="Login">
      <div style={base.center}>
        <h1 style={{ fontSize: 56, fontWeight: 300, marginBottom: 8 }}>啥意思</h1>
        <p style={{ fontSize: 13, color: colors.muted, marginBottom: 40 }}>
          What Do You Mean
        </p>

        <div style={{ display: "flex", flexDirection: "column", gap: 12, width: 260 }} role="group" aria-label="Sign in options">
          <button
            style={base.btn}
            onClick={() => onLogin("user_apple_" + Date.now())}
          >
            Sign in with Apple
          </button>
          <button
            style={base.btnOutline}
            onClick={() => onLogin("user_google_" + Date.now())}
          >
            Sign in with Google
          </button>
        </div>

        <button
          style={{ ...base.btnGhost, marginTop: 16, fontSize: 12 }}
          onClick={() => onLogin("user_email_" + Date.now())}
        >
          Sign in with Email
        </button>
      </div>
    </div>
  );
}
