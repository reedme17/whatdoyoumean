/**
 * Animated onboarding illustration — two figures with gentle looping motion.
 * Left figure bobs up, right figure bobs down, offset in phase for a
 * conversational "breathing" feel.
 */

import React from "react";

const floatKeyframes = `
@keyframes floatLeft {
  0%, 100% { transform: translateY(0px); }
  50% { transform: translateY(-6px); }
}
@keyframes floatRight {
  0%, 100% { transform: translateY(0px); }
  50% { transform: translateY(-5px); }
}
`;

export function OnboardingIllustration(): React.JSX.Element {
  return (
    <>
      <style>{floatKeyframes}</style>
      <svg
        width="1408"
        height="768"
        viewBox="0 0 1408 768"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        role="img"
        aria-label="Two people in conversation"
        style={{ width: "100%", height: "auto" }}
      >
        {/* ── Left person ── */}
        <g style={{ animation: "floatLeft 4s ease-in-out infinite", transformOrigin: "460px 450px" }}>
