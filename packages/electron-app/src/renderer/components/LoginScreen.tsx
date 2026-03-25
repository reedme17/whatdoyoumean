/**
 * LoginScreen — minimal center layout.
 * App name "啥意思", mock sign-in buttons.
 */

import React from "react";
import { Button } from "./ui/button.js";

interface Props {
  onLogin: (userId: string) => void;
}

export function LoginScreen({ onLogin }: Props): React.JSX.Element {
  return (
    <div className="flex flex-col w-full h-full bg-background text-foreground" role="main" aria-label="Login">
      <div className="flex flex-col items-center justify-center flex-1">
        <h1 className="text-6xl font-light mb-2">啥意思</h1>
        <p className="text-sm text-muted mb-10">What Do You Mean</p>

        <div className="flex flex-col gap-3 w-[260px]" role="group" aria-label="Sign in options">
          <Button onClick={() => onLogin("user_apple_" + Date.now())}>
            Sign in with Apple
          </Button>
          <Button variant="outline" onClick={() => onLogin("user_google_" + Date.now())}>
            Sign in with Google
          </Button>
        </div>

        <Button
          variant="ghost"
          size="sm"
          className="mt-4 text-xs"
          onClick={() => onLogin("user_email_" + Date.now())}
        >
          Sign in with Email
        </Button>
      </div>
    </div>
  );
}
