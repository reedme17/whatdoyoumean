# Requirements Document

## Introduction

"What Do You Mean" (啥意思) is a real-time conversation understanding enhancement tool that tackles the fundamental problem of low signal-to-noise ratio in human conversations. People often need multiple rounds of follow-up and confirmation to truly understand each other's meaning — in daily life and at work.

The tool captures live conversations (online meetings/calls or offline in-person via microphone), transcribes speech in real-time, and uses Large Language Models (LLMs) to extract core meaning and present it in the most understandable format — concise text, diagrams, charts, or visualizations — whatever helps understanding best. It also intelligently recommends next conversation directions: follow-up questions, new proposals, questioning judgments, etc.

LLMs are the core intelligence layer of the system. All text processing, semantic analysis, core meaning extraction, visualization content-type detection, and conversation recommendation capabilities are powered by LLMs. The system integrates with multiple LLM providers — including GPT (OpenAI), Claude (Anthropic), and Gemini (Google) — through a unified abstraction layer (LLM_Gateway), enabling model selection, automatic fallback, streaming responses, and future provider expansion.

Technical pipeline: Voice Input → Adaptive STT (local or cloud) → LLM-powered Semantic Analysis / Core Extraction → Visualization + Next Step Recommendations. The tool also supports a text input mode where users can paste text directly for analysis, bypassing the audio pipeline.

The system also builds a persistent Conversation_Memory per user, learning from past sessions to personalize recommendations and improve understanding over time.

Platform: Electron Mac App + Native iOS
Language: Chinese (中文) and English initially, with architecture designed to support all languages in the future
Target Users: Individual / personal users

## Glossary

- **Audio_Capture_Engine**: The subsystem responsible for capturing audio input from microphone hardware, system audio, or meeting integrations
- **Conversation_Flow_Panel**: The main UI panel displaying the real-time stream of transcription, core meaning extraction, and recommendations
- **Conversation_Memory**: The persistent store of per-user conversation history, extracted intents, preferences, and interaction patterns, stored locally or in the cloud, used to personalize follow-up recommendations and improve understanding over time
- **Conversation_Session**: A single continuous conversation capture session from start to end, including all associated transcripts, analysis, and recommendations
- **Core_Meaning_Card**: A discrete visual unit presenting one extracted core meaning point with its optimal visualization format
- **Language_Detector**: The component that automatically identifies the spoken language (Chinese or English) and handles code-switching between languages; designed with a pluggable detection module for future language additions
- **Latency_Budget**: The maximum acceptable delay between spoken words and their corresponding output appearing on screen
- **LLM_Gateway**: The abstraction layer that routes requests to multiple LLM providers (GPT, Claude, Gemini) for semantic analysis, meaning extraction, visualization content-type detection, and recommendation generation, supporting model selection, fallback, streaming, and load balancing
- **Recommendation_Engine**: The subsystem that generates intelligent next-step conversation suggestions including follow-up questions, proposals, and challenges, powered by LLMs via the LLM_Gateway and informed by Conversation_Memory
- **Semantic_Analyzer**: The LLM-powered subsystem that processes transcripts to extract core meaning, identify topics, detect speaker intent, and resolve ambiguities, using the LLM_Gateway for inference
- **Session_Archive**: The stored record of a completed Conversation_Session including full transcript, extracted meanings, and generated recommendations
- **Speaker_Diarizer**: The component that identifies and separates different speakers in a conversation
- **Terminology_Learner**: The component that automatically learns domain-specific terminology by comparing raw ASR output with LLM-refined text, maintaining a per-user dictionary for multi-stage post-processing (acronym folding, token merging, entity correction, case normalization)
- **Transcription_Engine**: The subsystem that converts captured audio into text transcripts in real-time, supporting both Chinese and English, with language-routed cloud STT (Groq Whisper for English, DashScope Qwen ASR for Chinese) and adaptive fallback to local on-device providers
- **User_Profile**: The aggregated representation of a user's conversation patterns, frequently discussed topics, communication style, and preferences, derived from Conversation_Memory
- **Visualization_Engine**: The subsystem that selects and renders the optimal presentation format (concise text, diagrams, charts, mind maps, timelines) for extracted meaning, using LLM-assisted content-type detection via the LLM_Gateway

## Requirements

### Requirement 1: Audio Capture — Online Meetings

**User Story:** As a user in an online meeting or voice call, I want the tool to capture the meeting audio, so that the conversation can be transcribed and analyzed in real-time.

#### Acceptance Criteria

1. WHEN a user initiates a Conversation_Session in online mode, THE Audio_Capture_Engine SHALL capture system audio output from the active meeting or voice call application
2. WHEN system audio capture is active, THE Audio_Capture_Engine SHALL simultaneously capture microphone input from the user's selected microphone device
3. WHILE capturing audio, THE Audio_Capture_Engine SHALL maintain separate audio channels for system audio and microphone input to support speaker diarization
4. IF the selected audio source becomes unavailable during capture, THEN THE Audio_Capture_Engine SHALL display a notification to the user within 2 seconds and attempt to reconnect automatically
5. IF automatic reconnection fails after 3 attempts, THEN THE Audio_Capture_Engine SHALL pause the Conversation_Session and prompt the user to select an alternative audio source
6. WHEN a user selects a microphone device from the audio settings, THE Audio_Capture_Engine SHALL begin capturing from that device within 500 milliseconds

### Requirement 2: Audio Capture — Offline / In-Person Conversations

**User Story:** As a user in a face-to-face conversation, I want to use my phone or computer's microphone to capture the conversation, so that I can get real-time understanding assistance during in-person discussions.

#### Acceptance Criteria

1. WHEN a user initiates a Conversation_Session in offline mode, THE Audio_Capture_Engine SHALL capture audio from the device's built-in or connected external microphone
2. WHILE capturing in offline mode, THE Audio_Capture_Engine SHALL apply noise suppression to filter ambient environmental noise
3. WHILE capturing in offline mode, THE Audio_Capture_Engine SHALL optimize microphone gain automatically to accommodate varying speaker distances
4. IF the ambient noise level exceeds the threshold where speech recognition accuracy drops below 80%, THEN THE Audio_Capture_Engine SHALL display a warning indicator to the user
5. WHEN multiple speakers are present in an offline conversation, THE Audio_Capture_Engine SHALL capture all speakers' audio through the single microphone input

### Requirement 3: Text Input Mode — Paste and Analyze

**User Story:** As a user who has a block of text (e.g., an email, chat log, meeting notes, or document excerpt), I want to paste it into the tool and get the same core meaning extraction and conversation recommendations, so that I can use the tool even without a live audio conversation.

#### Acceptance Criteria

1. THE application SHALL provide a text input mode where the user can paste or type text directly, bypassing the Audio_Capture_Engine and Transcription_Engine
2. WHEN the user submits text in text input mode, THE Semantic_Analyzer SHALL process the text through the LLM_Gateway and generate Core_Meaning_Cards and recommendations using the same pipeline as real-time mode
3. THE text input mode SHALL support both Chinese and English text, including mixed-language input
4. WHEN text is submitted, THE application SHALL display results (Core_Meaning_Cards, recommendations, topic map) within 5 seconds for text up to 5000 characters
5. THE application SHALL store text input sessions in the Session_Archive with the same structure as audio-based sessions, enabling search, bookmarks, and export

### Requirement 4: Real-Time Speech Transcription with Language-Routed Adaptive STT

**User Story:** As a user, I want spoken words to appear as text on screen with minimal delay using the best available speech-to-text engine — Groq Whisper for English, DashScope Qwen ASR for Chinese — so that I can follow the conversation in text form while it happens, whether online or offline.

#### Acceptance Criteria

1. WHEN audio is received from the Audio_Capture_Engine, THE Transcription_Engine SHALL produce interim transcript text within the Latency_Budget of 1 second from the moment of speech
2. WHEN a speaker completes an utterance, THE Transcription_Engine SHALL produce a finalized transcript segment within 2 seconds of utterance completion
3. THE Transcription_Engine SHALL achieve a word error rate of 10% or lower for clear speech in both Chinese and English
4. WHILE transcribing, THE Transcription_Engine SHALL display interim (partial) results in the Conversation_Flow_Panel, visually distinguished from finalized transcript segments
5. WHEN a finalized transcript segment replaces an interim result, THE Conversation_Flow_Panel SHALL update smoothly without jarring layout shifts
6. THE Transcription_Engine SHALL support both local (on-device) and cloud-based STT providers, with cloud STT routed by detected language: English audio to Groq Whisper Large v3 Turbo, Chinese audio to Alibaba DashScope Qwen ASR
7. WHEN network connectivity is unavailable or latency to the cloud STT provider exceeds 500 milliseconds, THE Transcription_Engine SHALL automatically switch to the local on-device STT provider (Apple Speech Framework on iOS, Web Speech API or Whisper.js WASM on web) without interrupting the transcription stream
8. WHEN network connectivity is restored and cloud STT latency returns to acceptable levels, THE Transcription_Engine SHALL switch back to the cloud STT provider if it offers higher accuracy for the current language
9. THE Transcription_Engine SHALL implement a language-agnostic interface that accepts a language code parameter, enabling future addition of new languages and STT providers without architectural changes

### Requirement 5: Language Detection and Bilingual Support

**User Story:** As a bilingual user who switches between Chinese and English in conversation, I want the tool to automatically detect and handle both languages, so that I don't need to manually configure language settings.

#### Acceptance Criteria

1. WHEN audio input begins, THE Language_Detector SHALL identify the spoken language as Chinese or English within the first 3 seconds of speech
2. WHEN text is submitted in text input mode, THE Language_Detector SHALL identify the language of the text before passing it to the Semantic_Analyzer
3. WHEN a speaker switches between Chinese and English mid-conversation (code-switching), THE Language_Detector SHALL detect the language change within 2 seconds and adjust the Transcription_Engine accordingly
3. WHILE processing a bilingual conversation, THE Transcription_Engine SHALL maintain accurate transcription for both Chinese and English segments without requiring user intervention
4. THE Semantic_Analyzer SHALL extract core meaning from mixed Chinese-English conversations and present Core_Meaning_Cards in the dominant language of the conversation or in the user's preferred display language
5. WHEN the user sets a preferred display language in settings, THE Visualization_Engine SHALL render all UI labels, Core_Meaning_Cards, and recommendations in that language
6. THE Language_Detector SHALL be designed with a pluggable detection module, so that new language detection models can be added without modifying the core detection pipeline
7. THE Semantic_Analyzer SHALL process transcript text through the LLM_Gateway using language-aware prompts, enabling support for new languages by updating prompt templates rather than rewriting analysis logic
8. THE application SHALL store all user-facing text strings in a localization resource file, enabling UI translation to new languages by adding new resource files
9. WHEN a new language is added to the system, THE application SHALL require only configuration changes and new language resource files — no changes to core application code

### Requirement 6: Speaker Identification and Diarization

**User Story:** As a user in a multi-person conversation, I want the tool to distinguish who said what, so that the transcript and analysis are attributed to the correct speakers.

#### Acceptance Criteria

1. WHEN multiple speakers are detected in a Conversation_Session, THE Speaker_Diarizer SHALL assign a distinct speaker label to each detected speaker
2. WHEN a new speaker begins talking, THE Speaker_Diarizer SHALL identify the speaker change within 1 second
3. THE Speaker_Diarizer SHALL maintain consistent speaker labels throughout a single Conversation_Session
4. WHEN the user assigns a name to a speaker label, THE Conversation_Flow_Panel SHALL replace the generic label with the assigned name for all past and future segments in that session
5. IF the Speaker_Diarizer cannot confidently distinguish between two speakers, THEN THE Speaker_Diarizer SHALL mark the affected segments as "uncertain attribution" and allow the user to manually correct them

### Requirement 7: Core Meaning Extraction

**User Story:** As a user, I want the tool to extract and highlight the core meaning of what's being said — not long summaries, but the essential point — so that I can quickly grasp what matters in the conversation.

#### Acceptance Criteria

1. WHEN a finalized transcript segment is produced, THE Semantic_Analyzer SHALL send the transcript to the LLM_Gateway for inference and generate a Core_Meaning_Card within 3 seconds
2. THE Semantic_Analyzer SHALL identify and categorize extracted meanings into types: factual statement (事实陈述), opinion (观点), question (问题), decision (决定), action item (待办事项), or disagreement (分歧)
3. THE Semantic_Analyzer SHALL limit each Core_Meaning_Card to a maximum of 30 words (or 50 Chinese characters) to ensure conciseness
4. WHEN a speaker makes a point that contradicts or modifies a previous point in the same session, THE Semantic_Analyzer SHALL link the new Core_Meaning_Card to the earlier one and indicate the relationship
5. WHEN a speaker repeats or rephrases a previously stated point, THE Semantic_Analyzer SHALL merge the information into the existing Core_Meaning_Card rather than creating a duplicate
6. WHILE a conversation topic is being discussed, THE Semantic_Analyzer SHALL maintain a running "topic summary" that updates as new related points are made

### Requirement 8: LLM Integration and Multi-Model Support

**User Story:** As a user, I want the tool's intelligence to be powered by the best available LLMs with automatic fallback and streaming, so that I get the highest quality meaning extraction and conversation recommendations with minimal latency.

#### Acceptance Criteria

1. THE LLM_Gateway SHALL support integration with at least four LLM providers: Cerebras GPT-OSS-120B (primary, 2,224 tokens/sec, free tier 1M tokens/day), OpenAI (GPT), Anthropic (Claude), and Google (Gemini) as fallback providers
2. THE LLM_Gateway SHALL expose a unified API abstraction so that the Semantic_Analyzer, Recommendation_Engine, and Visualization_Engine are decoupled from any specific LLM provider
3. WHEN the user selects a preferred LLM provider in settings, THE LLM_Gateway SHALL route all semantic analysis and recommendation requests to that provider
4. IF the primary LLM provider fails to respond within 3 seconds or returns an error, THEN THE LLM_Gateway SHALL automatically fall back to the next available provider without user intervention
5. THE LLM_Gateway SHALL support adding new LLM providers through a plugin or adapter interface without requiring changes to the Semantic_Analyzer, Recommendation_Engine, or Visualization_Engine
6. THE LLM_Gateway SHALL log provider response times and error rates to enable performance comparison and automatic provider optimization
7. WHEN streaming responses are available from the LLM provider, THE LLM_Gateway SHALL use streaming mode to minimize latency for Core_Meaning_Card generation and recommendation delivery

### Requirement 9: Visualization of Core Meaning

**User Story:** As a user, I want core meanings to be presented in formats that help me understand quickly — at minimum concise text and flow diagrams (mind-map style) — so that complex ideas become immediately clear.

> **Note:** Detailed UI/UX specifications for visualization formats, interactions, and layout will be covered in a separate `ux.md` document.

#### Acceptance Criteria

1. THE Visualization_Engine SHALL support at least two presentation formats: concise text and flow diagrams (mind-map style)
2. WHEN a Core_Meaning_Card is generated, THE Visualization_Engine SHALL select an appropriate presentation format based on the content type
3. WHEN a user taps or clicks on a Core_Meaning_Card, THE Visualization_Engine SHALL expand the card to show the original transcript segments that contributed to the extracted meaning

### Requirement 10: Intelligent Conversation Recommendations

**User Story:** As a user, I want the tool to suggest meaningful next steps in the conversation — follow-up questions, new angles, challenges to assumptions — informed by both the current conversation and my past conversation history, so that I can have more productive and deeper conversations.

#### Acceptance Criteria

1. WHEN a Core_Meaning_Card is generated, THE Recommendation_Engine SHALL send the context to the LLM_Gateway and produce 1 to 3 relevant conversation recommendations within 2 seconds
2. THE Recommendation_Engine SHALL categorize each recommendation into one of the following types: follow-up question (追问), clarification request (澄清), new proposal (新提议), challenge or counter-argument (质疑/反驳), summary confirmation (总结确认), or topic pivot (话题转换)
3. WHEN the conversation contains an ambiguous statement, THE Recommendation_Engine SHALL prioritize generating a clarification request recommendation
4. WHEN the conversation contains an unsubstantiated claim, THE Recommendation_Engine SHALL generate a challenge recommendation that suggests asking for evidence or reasoning
5. WHEN a conversation topic has been discussed for more than 5 minutes without resolution, THE Recommendation_Engine SHALL suggest a summary confirmation or topic pivot recommendation
6. WHEN the user taps or clicks a recommendation, THE Conversation_Flow_Panel SHALL copy the recommendation text to the clipboard and display a brief confirmation
7. THE Recommendation_Engine SHALL avoid generating repetitive recommendations; each new recommendation set SHALL differ from the previous set for the same topic
8. WHEN generating recommendations, THE Recommendation_Engine SHALL query the Conversation_Memory for relevant past intents, unresolved questions, and pending action items to produce personalized, context-aware suggestions

### Requirement 11: Conversation Flow Panel — Real-Time UI

**User Story:** As a user, I want a clean, real-time updating panel that shows the transcript, core meanings, and recommendations in a unified stream, so that I can follow everything in one place without distraction.

> **Note:** Detailed UI layout, interaction patterns, and visual design will be covered in a separate `ux.md` document.

#### Acceptance Criteria

1. THE Conversation_Flow_Panel SHALL display live transcript, Core_Meaning_Cards, and recommendations in a unified real-time stream
2. WHILE a Conversation_Session is active, THE Conversation_Flow_Panel SHALL auto-scroll to show the most recent content, with the ability to pause auto-scroll when the user scrolls up
3. THE Conversation_Flow_Panel SHALL visually distinguish between transcript text, Core_Meaning_Cards, and recommendations

### Requirement 12: Session Management

**User Story:** As a user, I want to start, pause, resume, and end conversation sessions, so that I have full control over when the tool is actively listening and processing.

#### Acceptance Criteria

1. WHEN the user taps the "Start Session" button, THE Audio_Capture_Engine SHALL begin capturing audio and THE Transcription_Engine SHALL begin processing within 1 second
2. WHEN the user taps the "Pause" button during an active session, THE Audio_Capture_Engine SHALL stop capturing audio and THE Conversation_Flow_Panel SHALL display a "Paused" indicator
3. WHEN the user taps "Resume" from a paused state, THE Audio_Capture_Engine SHALL resume capturing audio within 500 milliseconds and THE Conversation_Flow_Panel SHALL insert a visual "pause gap" marker in the timeline
4. WHEN the user taps "End Session", THE Audio_Capture_Engine SHALL stop capturing, THE Semantic_Analyzer SHALL complete processing of any remaining buffered content, and THE Session_Archive SHALL save the complete session data
5. IF the application is sent to background on iOS for more than 30 seconds, THEN THE Audio_Capture_Engine SHALL pause the session automatically and notify the user upon return
6. IF the device battery level drops below 10% during an active session, THEN THE Conversation_Flow_Panel SHALL display a low battery warning suggesting the user end or pause the session

### Requirement 13: Session Archive and History

**User Story:** As a user, I want to review past conversation sessions with their full transcripts, extracted meanings, and recommendations, so that I can revisit important conversations later.

#### Acceptance Criteria

1. WHEN a Conversation_Session ends, THE Session_Archive SHALL store the complete transcript, all Core_Meaning_Cards, all generated recommendations, speaker labels, and session metadata (date, duration, participant count)
2. THE Session_Archive SHALL present a searchable list of past sessions sorted by date, with each entry showing the session date, duration, and a brief topic summary
3. WHEN the user searches the Session_Archive by keyword, THE Session_Archive SHALL return matching sessions where the keyword appears in the transcript, Core_Meaning_Cards, or topic summaries within 1 second
4. WHEN the user opens a past session, THE Conversation_Flow_Panel SHALL render the archived session in the same layout as the live session, with full transcript, Core_Meaning_Cards, and recommendations
5. WHEN the user deletes a session from the archive, THE Session_Archive SHALL permanently remove all associated data and confirm the deletion to the user
6. THE Session_Archive SHALL allow the user to export a session as a structured text document (Markdown format) containing the transcript, extracted meanings, and recommendations

### Requirement 14: Conversation Memory and Personalization

**User Story:** As a returning user, I want the tool to remember my past conversations and intents, so that follow-up recommendations become more relevant and personalized over time.

#### Acceptance Criteria

1. WHEN a Conversation_Session ends, THE Conversation_Memory SHALL extract and store key intents, decisions, action items, and unresolved questions from the session, associated with the user's User_Profile
2. THE Conversation_Memory SHALL store data either locally on-device or in the user's cloud account, based on the user's storage preference setting
3. WHEN a user starts a new Conversation_Session with a previously identified speaker, THE Semantic_Analyzer SHALL retrieve relevant Conversation_Memory entries from past sessions with that speaker to provide contextual awareness
4. THE Conversation_Memory SHALL maintain a per-user intent history that tracks recurring topics, unresolved questions, and pending action items across sessions
5. WHEN the user views their User_Profile, THE application SHALL display a summary of frequently discussed topics, common conversation partners, and tracked action items
6. THE Conversation_Memory SHALL allow the user to delete specific memory entries or clear all memory data from the settings screen
7. IF the user disables Conversation_Memory in settings, THEN THE application SHALL stop storing new memory entries and exclude memory context from recommendation generation, while preserving existing Session_Archives

### Requirement 15: Terminology Auto-Learning

**User Story:** As a user who frequently discusses domain-specific topics with specialized terminology, I want the tool to automatically learn and correct recurring transcription errors for proper nouns, acronyms, and technical terms, so that transcription accuracy improves over time.

#### Acceptance Criteria

1. THE Terminology_Learner SHALL apply multi-stage post-processing to ASR output: acronym folding (e.g., "A P I" → "API"), token merging, named entity correction, and case normalization
2. WHEN the Semantic_Analyzer refines a transcript segment via the LLM_Gateway, THE Terminology_Learner SHALL compare the raw ASR output with the LLM-refined text and automatically extract difference terms as candidate dictionary entries
3. THE Terminology_Learner SHALL maintain a per-user terminology dictionary that stores learned terms, their ASR misrecognition variants, and usage frequency
4. WHEN a learned term's ASR variant is detected in future transcription output, THE Terminology_Learner SHALL automatically correct it before passing the text to the Semantic_Analyzer
5. THE application SHALL allow the user to view, add, edit, and delete terminology dictionary entries in settings
6. THE Terminology_Learner dictionary SHALL synchronize across devices alongside Conversation_Memory data

### Requirement 16: Conversation Topic Map

**User Story:** As a user, I want to see an overview map of all topics discussed in a conversation and how they relate to each other, so that I can understand the overall structure and flow of the discussion.

> **Note:** Detailed topic map UI interactions and visual design will be covered in `ux.md`.

#### Acceptance Criteria

1. WHILE a Conversation_Session is active, THE Semantic_Analyzer SHALL maintain a dynamic topic map that groups related Core_Meaning_Cards under identified topics
2. WHEN the user opens the topic map view, THE Visualization_Engine SHALL render an interactive mind map or graph showing all identified topics and their relationships
3. THE Semantic_Analyzer SHALL detect topic transitions in the conversation and mark them in the topic map

### Requirement 17: Privacy and Audio Data Handling

**User Story:** As a user, I want confidence that my conversation audio is handled securely and privately, so that I can use the tool without concerns about sensitive conversations being exposed.

#### Acceptance Criteria

1. THE Audio_Capture_Engine SHALL transmit audio data to the Transcription_Engine using encrypted connections (TLS 1.2 or higher)
2. WHEN a Conversation_Session ends, THE Audio_Capture_Engine SHALL delete raw audio buffers from device memory within 5 seconds
3. THE Session_Archive SHALL store transcript and analysis data using on-device encryption
4. THE Audio_Capture_Engine SHALL display a persistent visual indicator (microphone icon) whenever audio capture is active, visible on all screens
5. WHEN the user enables "Local Processing Only" mode in settings, THE Transcription_Engine SHALL process all audio on-device without transmitting data to external servers
6. IF the application detects that audio is being captured by a third-party application simultaneously, THEN THE Conversation_Flow_Panel SHALL notify the user of the concurrent audio access

### Requirement 18: Performance and Latency

**User Story:** As a user, I want the tool to feel instantaneous — real-time means real-time — so that the analysis keeps pace with the actual conversation.

#### Acceptance Criteria

1. THE Transcription_Engine SHALL produce interim transcript text within 1 second of speech (end-to-end from audio capture to screen display)
2. THE Semantic_Analyzer SHALL generate a Core_Meaning_Card within 3 seconds of a finalized transcript segment being produced
3. THE Recommendation_Engine SHALL generate recommendations within 2 seconds of a Core_Meaning_Card being produced
4. THE Visualization_Engine SHALL render any visualization format within 500 milliseconds of receiving content from the Semantic_Analyzer
5. WHILE a Conversation_Session is active, THE application SHALL maintain a frame rate of 30 frames per second or higher on the Conversation_Flow_Panel
6. WHILE a Conversation_Session is active, THE application SHALL consume no more than 15% of device CPU on iOS and no more than 20% of a single CPU core on web browsers
7. WHILE a Conversation_Session is active on iOS, THE application SHALL consume no more than 300 megabytes of RAM
8. THE application SHALL continuously monitor STT provider latency, and THE Transcription_Engine SHALL log local vs. cloud STT response times per session to enable benchmarking and adaptive provider selection tuning
9. THE LLM_Gateway SHALL track per-provider response times and error rates, and THE application SHALL use this data to optimize default provider selection and fallback ordering

### Requirement 19: Mac Desktop Application (Electron)

**User Story:** As a Mac user, I want a native-like desktop application that can seamlessly capture system audio from meetings and microphone input, so that I can use the tool during online meetings without the friction of browser screen-sharing prompts.

#### Acceptance Criteria

1. THE Mac_Application SHALL be built with Electron, sharing the React frontend codebase with potential future web deployment
2. THE Mac_Application SHALL capture system audio using macOS ScreenCaptureKit or CoreAudio APIs, without requiring the user to manually share their screen
3. THE Mac_Application SHALL simultaneously capture microphone input and system audio as separate channels to support speaker diarization
4. THE Mac_Application SHALL continue audio capture and processing when the application window is not in focus
5. THE Mac_Application SHALL support macOS 13 (Ventura) and later versions
6. THE Mac_Application SHALL support keyboard shortcuts for session control: start/stop session, pause/resume, and toggle stream filters
7. WHEN the user first launches the application, THE Mac_Application SHALL request Screen Recording and Microphone permissions through the standard macOS permission dialogs with clear explanations
8. THE Mac_Application SHALL provide a macOS menu bar (toolbar) quick-access menu that displays session status and allows the user to start, pause, resume, and end sessions without opening the main window

### Requirement 20: Native iOS Application

**User Story:** As a mobile user, I want a native iOS app that works smoothly for both online and offline conversation scenarios, so that I can use the tool anywhere — in meetings, at coffee shops, or walking around.

#### Acceptance Criteria

1. THE iOS_Application SHALL support iOS 16 and later versions
2. THE iOS_Application SHALL support both iPhone and iPad devices with optimized layouts for each form factor
3. WHEN the iOS_Application is in the foreground with an active session, THE Audio_Capture_Engine SHALL capture audio continuously without interruption
4. WHEN the user grants microphone permission, THE iOS_Application SHALL retain the permission for future sessions without re-prompting
5. THE iOS_Application SHALL support background audio capture for up to 30 seconds when the app is sent to background, after which the session auto-pauses
6. THE iOS_Application SHALL integrate with iOS share sheet to allow exporting session archives to other applications
7. WHEN the device is in Do Not Disturb mode, THE iOS_Application SHALL continue active session capture without interruption

### Requirement 21: User Onboarding and Settings

**User Story:** As a new user, I want a simple onboarding experience and clear settings, so that I can start using the tool quickly and customize it to my preferences.

> **Note:** Detailed onboarding flow and settings UI will be covered in `ux.md`.

#### Acceptance Criteria

1. WHEN a user opens the application for the first time, THE application SHALL present a brief onboarding flow explaining core functionality
2. THE application SHALL provide a settings screen where the user can configure: preferred display language, default audio input device, LLM provider preference, STT mode preference, and Conversation_Memory storage preference
3. WHEN the user completes onboarding, THE application SHALL request necessary permissions (microphone, and notifications on iOS) with clear explanations of why each permission is needed

### Requirement 22: Conversation Bookmarks and Highlights

**User Story:** As a user, I want to bookmark important moments during a conversation and highlight key Core_Meaning_Cards, so that I can quickly find the most important parts later.

> **Note:** Detailed bookmark/highlight UI interactions will be covered in `ux.md`.

#### Acceptance Criteria

1. THE application SHALL support creating timestamped bookmarks during active sessions and highlighting Core_Meaning_Cards
2. THE Session_Archive SHALL preserve bookmarks and highlights and provide a filtered view to quickly navigate to them

### Requirement 23: Data Synchronization Across Devices

**User Story:** As a user who uses both the web app and iOS app, I want my session archives, settings, bookmarks, and conversation memory to sync across devices, so that I can start a session on one device and review it on another.

#### Acceptance Criteria

1. WHEN a Conversation_Session ends and the device has network connectivity, THE Session_Archive SHALL synchronize the session data to the user's cloud account within 60 seconds
2. WHEN the user logs into the application on a new device, THE Session_Archive SHALL download and display all previously synced sessions within the session list
3. WHEN the user modifies settings on one device, THE application SHALL propagate the settings change to all other logged-in devices within 30 seconds
4. IF network connectivity is unavailable after a session ends, THEN THE Session_Archive SHALL queue the session for synchronization and sync automatically when connectivity is restored
5. WHEN a sync conflict occurs (same session modified on two devices), THE Session_Archive SHALL preserve both versions and prompt the user to choose which to keep
6. WHEN the user's Conversation_Memory storage preference is set to cloud, THE Conversation_Memory data and User_Profile SHALL synchronize across devices alongside Session_Archive data, ensuring consistent personalized recommendations on all devices

### Requirement 24: Accessibility

**User Story:** As a user with accessibility needs, I want the application to be usable with assistive technologies, so that the tool is inclusive and available to all users.

> **Note:** Detailed accessibility specifications will be covered in `ux.md`.

#### Acceptance Criteria

1. THE application SHALL support VoiceOver on iOS and screen readers on web for all interactive elements
2. THE application SHALL comply with platform accessibility guidelines (iOS Human Interface Guidelines, WCAG 2.1 AA for web)

### Requirement 25: Error Handling and Resilience

**User Story:** As a user, I want the tool to handle errors gracefully without losing my conversation data, so that I can trust the tool during important conversations.

#### Acceptance Criteria

1. IF the Transcription_Engine encounters a processing error, THEN THE Transcription_Engine SHALL retry processing the audio segment up to 3 times before displaying an error indicator on the affected segment
2. IF the network connection is lost during an active session, THEN THE application SHALL continue capturing audio locally and queue transcription requests for processing when connectivity is restored
3. IF the Semantic_Analyzer fails to extract meaning from a transcript segment, THEN THE Semantic_Analyzer SHALL skip the segment and log the failure without interrupting the conversation stream
4. IF the application crashes during an active session, THEN THE application SHALL recover the session state from the last checkpoint upon relaunch and offer the user the option to resume or end the session
5. WHEN an error occurs in any subsystem, THE application SHALL log the error with timestamp, subsystem identifier, and error details for diagnostic purposes
6. IF the device runs out of storage during an active session, THEN THE application SHALL notify the user and continue the session in a reduced mode that prioritizes live transcription over archival storage
