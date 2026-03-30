/**
 * SettingsControls — shared settings UI used across Panel, BottomBar, RecapScreen, and TextModeScreen.
 *
 * variant="full": Language + Audio source + Response recommendation
 * variant="response-only": Response recommendation only
 */

import React from "react";
import { Tabs, TabsList, TabsTrigger } from "./ui/tabs.js";
import type { SttLanguage } from "./ExpandPanel.js";
import type { AudioSourceMode } from "../hooks/useAudioCapture.js";

interface SettingsControlsProps {
  variant: "full" | "response-only";
  sttLanguage?: SttLanguage;
  onSttLanguageChange?: (lang: SttLanguage) => void;
  audioSource?: AudioSourceMode;
  onAudioSourceChange?: (source: AudioSourceMode) => void;
  responseEnabled: boolean;
  onResponseEnabledChange?: (v: boolean) => void;
}

export function SettingsControls({
  variant,
  sttLanguage = "zh+en",
  onSttLanguageChange,
  audioSource = "mic",
  onAudioSourceChange,
  responseEnabled,
  onResponseEnabledChange,
}: SettingsControlsProps): React.JSX.Element {
  return (
    <div className="flex flex-col gap-3">
      {variant === "full" && (
        <>
          <div className="flex flex-col gap-1">
            <span className="text-[10px] font-sans font-medium text-[#60594D]">Language</span>
            <Tabs value={sttLanguage === "zh" ? "cn" : sttLanguage === "en" ? "en" : "multi"} onValueChange={(v) => onSttLanguageChange?.(v === "cn" ? "zh" : v === "en" ? "en" : "zh+en")}>
              <TabsList><TabsTrigger value="en">EN</TabsTrigger><TabsTrigger value="cn">中文</TabsTrigger><TabsTrigger value="multi">Multi</TabsTrigger></TabsList>
            </Tabs>
          </div>
          <div className="flex flex-col gap-1">
            <span className="text-[10px] font-sans font-medium text-[#60594D]">Audio source</span>
            <Tabs value={audioSource} onValueChange={(v) => { if (v === "mic") onAudioSourceChange?.(v as AudioSourceMode); }}>
              <TabsList>
                <TabsTrigger value="mic">Mic</TabsTrigger>
                <TabsTrigger value="internal" disabled className="opacity-40 cursor-not-allowed">Internal</TabsTrigger>
                <TabsTrigger value="mic+internal" disabled className="opacity-40 cursor-not-allowed">Both</TabsTrigger>
              </TabsList>
            </Tabs>
          </div>
        </>
      )}
      <div className="flex flex-col gap-1">
        <span className="text-[10px] font-sans font-medium text-[#60594D]">Response recommendation</span>
        <Tabs value={responseEnabled ? "on" : "off"} onValueChange={(v) => onResponseEnabledChange?.(v === "on")}>
          <TabsList><TabsTrigger value="on">On</TabsTrigger><TabsTrigger value="off">Off</TabsTrigger></TabsList>
        </Tabs>
      </div>
    </div>
  );
}
