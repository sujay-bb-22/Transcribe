import { useState, useRef, useCallback, useEffect } from "react";
import { useTranscriber } from "./transcriberContext.ts";
import Confetti, { type ConfettiHandle } from "./Confetti.tsx";
import { langToFlag } from "./utils.ts";
import {
  CohereLogo,
  UploadIcon,
  MicrophoneIcon,
  CopyIcon,
  DownloadIcon,
  CheckIcon,
  FileIcon,
  MicSmallIcon,
} from "./icons.tsx";

type Screen = "landing" | "loading" | "transcription";
type TranscriptionMode = "idle" | "file" | "microphone";

// ---- Constants ----

const SCREEN_TRANSITION_MS = 600; // must match .screen CSS transition duration in index.css
const COPY_FEEDBACK_MS = 2000;
const POST_LOAD_DELAY_MS = 500;
const AUDIO_SAMPLE_RATE = 16000;

const LANGUAGES: { code: string; label: string; native: string }[] = [
  { code: "en", label: "English", native: "English" },
  { code: "fr", label: "French", native: "Français" },
  { code: "de", label: "German", native: "Deutsch" },
  { code: "es", label: "Spanish", native: "Español" },
  { code: "it", label: "Italian", native: "Italiano" },
  { code: "pt", label: "Portuguese", native: "Português" },
  { code: "nl", label: "Dutch", native: "Nederlands" },
  { code: "pl", label: "Polish", native: "Polski" },
  { code: "el", label: "Greek", native: "Ελληνικά" },
  { code: "ar", label: "Arabic", native: "العربية" },
  { code: "ja", label: "Japanese", native: "日本語" },
  { code: "zh", label: "Chinese", native: "中文" },
  { code: "vi", label: "Vietnamese", native: "Tiếng Việt" },
  { code: "ko", label: "Korean", native: "한국어" },
];

// ---- Formatting helpers ----

function formatDuration(seconds: number): string {
  if (seconds < 60) return `${seconds.toFixed(1)}s`;
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return secs > 0 ? `${mins}m ${secs.toFixed(0)}s` : `${mins}m`;
}

// ---- Audio helpers ----

async function decodeAudio(arrayBuffer: ArrayBuffer): Promise<Float32Array> {
  const audioCtx = new AudioContext({ sampleRate: AUDIO_SAMPLE_RATE });
  const decoded = await audioCtx.decodeAudioData(arrayBuffer);
  const float32 = decoded.getChannelData(0);
  await audioCtx.close();
  return float32;
}

// ---- Main App ----

function App() {
  const [screen, setScreen] = useState<Screen>("landing");
  const [prevScreen, setPrevScreen] = useState<Screen | null>(null);
  const [mode, setMode] = useState<TranscriptionMode>("idle");
  const [language, setLanguage] = useState("en");
  const [transcriptionText, setTranscriptionText] = useState("");
  const [streamedText, setStreamedText] = useState("");
  const [isTranscribing, setIsTranscribing] = useState(false);
  const [audioFileName, setAudioFileName] = useState<string | null>(null);
  const [isRecording, setIsRecording] = useState(false);
  const [copied, setCopied] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [stats, setStats] = useState<{
    audioDuration: number;
    elapsed: number;
  } | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const outputRef = useRef<HTMLDivElement>(null);
  const streamedTextRef = useRef("");
  const confettiRef = useRef<ConfettiHandle>(null);

  const transcriber = useTranscriber();
  const displayText = isTranscribing ? streamedText : transcriptionText;

  // ---- Screen transitions ----

  const transitionTo = useCallback(
    (next: Screen) => {
      setPrevScreen(screen);
      setScreen(next);
      setTimeout(() => setPrevScreen(null), SCREEN_TRANSITION_MS);
    },
    [screen],
  );

  const getScreenClass = useCallback(
    (s: Screen) => {
      if (s === screen) return "screen screen-enter";
      if (s === prevScreen) return "screen screen-exit";
      return "screen screen-hidden";
    },
    [screen, prevScreen],
  );

  // ---- Video autoplay fallback ----

  useEffect(() => {
    if (screen === "landing" && videoRef.current) {
      videoRef.current.play().catch(() => {});
    }
  }, [screen]);

  // ---- Model loading: start when entering loading screen ----

  useEffect(() => {
    if (screen !== "loading") return;
    transcriber.load().then(() => {
      setTimeout(() => transitionTo("transcription"), POST_LOAD_DELAY_MS);
    });
  }, [screen, transcriber, transitionTo]);

  // ---- Auto-scroll output during streaming ----

  useEffect(() => {
    if (isTranscribing && outputRef.current) {
      outputRef.current.scrollTop = outputRef.current.scrollHeight;
    }
  }, [streamedText, isTranscribing]);

  // ---- Streaming callback ----

  const onToken = useCallback((token: string) => {
    streamedTextRef.current += token;
    setStreamedText(streamedTextRef.current);
  }, []);

  // ---- Run transcription (shared by file + mic) ----

  const runTranscription = useCallback(
    async (audio: Float32Array) => {
      setIsTranscribing(true);
      setTranscriptionText("");
      setStreamedText("");
      setStats(null);
      streamedTextRef.current = "";

      const audioDuration = audio.length / AUDIO_SAMPLE_RATE;
      const startTime = performance.now();

      try {
        const finalText = await transcriber.transcribe(
          audio,
          language,
          onToken,
        );
        const elapsed = (performance.now() - startTime) / 1000;
        setTranscriptionText(finalText);
        setStats({ audioDuration, elapsed });
      } catch (err) {
        setTranscriptionText(
          `Error: ${err instanceof Error ? err.message : "Transcription failed"}`,
        );
      } finally {
        setIsTranscribing(false);
      }
    },
    [transcriber, language, onToken],
  );

  // ---- File handling (shared by input + drag-and-drop) ----

  const processFile = useCallback(
    async (file: File) => {
      setAudioFileName(file.name);
      setMode("file");
      const audioData = await decodeAudio(await file.arrayBuffer());
      runTranscription(audioData);
    },
    [runTranscription],
  );

  const handleFileSelect = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;
      processFile(file);
    },
    [processFile],
  );

  // ---- Drag and drop ----

  const dragCounter = useRef(0);

  const handleDragEnter = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      if (screen !== "transcription" || mode !== "idle") return;
      dragCounter.current++;
      if (dragCounter.current === 1) setIsDragging(true);
    },
    [screen, mode],
  );

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    dragCounter.current--;
    if (dragCounter.current === 0) setIsDragging(false);
  }, []);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      dragCounter.current = 0;
      setIsDragging(false);
      if (screen !== "transcription" || mode !== "idle") return;
      const file = e.dataTransfer.files?.[0];
      if (!file) return;
      processFile(file);
    },
    [screen, mode, processFile],
  );

  // ---- Microphone ----

  const startRecording = useCallback(async () => {
    setMode("microphone");
    setIsRecording(true);
    setTranscriptionText("");
    setStreamedText("");
    audioChunksRef.current = [];

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(stream);
      mediaRecorderRef.current = recorder;

      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) {
          audioChunksRef.current.push(e.data);
        }
      };

      recorder.onstop = async () => {
        stream.getTracks().forEach((t) => t.stop());
        setIsRecording(false);

        try {
          const blob = new Blob(audioChunksRef.current, { type: "audio/webm" });
          const float32 = await decodeAudio(await blob.arrayBuffer());
          runTranscription(float32);
        } catch (err) {
          setTranscriptionText(
            `Error: ${err instanceof Error ? err.message : "Transcription failed"}`,
          );
        }
      };

      recorder.start();
    } catch (err) {
      setIsRecording(false);
      setMode("idle");
      console.error("Microphone access denied:", err);
    }
  }, [runTranscription]);

  const stopRecording = useCallback(() => {
    mediaRecorderRef.current?.stop();
  }, []);

  // ---- Copy to clipboard ----

  const copyToClipboard = useCallback(() => {
    navigator.clipboard.writeText(transcriptionText).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), COPY_FEEDBACK_MS);
    });
  }, [transcriptionText]);

  // ---- Download as .txt ----

  const downloadText = useCallback(() => {
    const blob = new Blob([transcriptionText], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "transcription.txt";
    a.click();
    URL.revokeObjectURL(url);
  }, [transcriptionText]);

  // ---- Reset ----

  const resetTranscription = useCallback(() => {
    setMode("idle");
    setTranscriptionText("");
    setStreamedText("");
    streamedTextRef.current = "";
    setIsTranscribing(false);
    setAudioFileName(null);
    setIsRecording(false);
    setCopied(false);
    setStats(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  }, []);

  // ---- Render ----

  const isDone = !isTranscribing && !isRecording && !!transcriptionText;

  return (
    <div
      className="relative w-screen h-screen overflow-hidden bg-white"
      onDragEnter={handleDragEnter}
      onDragLeave={handleDragLeave}
      onDragOver={handleDragOver}
      onDrop={handleDrop}
    >
      {/* ==================== Screen 1: Landing ==================== */}
      <div
        className={`${getScreenClass("landing")} cursor-pointer`}
        onClick={() => screen === "landing" && transitionTo("loading")}
      >
        {/* Video background */}
        <video
          ref={videoRef}
          className="absolute inset-0 w-full h-full object-cover"
          src="/video.mp4"
          autoPlay
          loop
          muted
          playsInline
        />

        {/* Click hint */}
        <div className="absolute bottom-12 left-0 right-0 text-center z-10">
          <p className="text-xl text-white animate-pulse-glow">
            Click anywhere to begin
          </p>
        </div>
      </div>

      {/* ==================== Screen 2: Loading ==================== */}
      <div
        className={`${getScreenClass("loading")} flex flex-col items-center justify-center bg-white`}
      >
        <div className="flex flex-col items-center gap-8 animate-fade-in-up">
          {/* Spinner */}
          <div className="relative w-16 h-16">
            <div
              className="absolute inset-0 rounded-full animate-spin-slow"
              style={{
                border: "2px solid var(--cohere-border)",
                borderTopColor: "var(--cohere-purple)",
                borderRightColor: "var(--cohere-cyan)",
              }}
            />
            <div className="absolute inset-3 flex items-center justify-center">
              <CohereLogo size={24} />
            </div>
          </div>

          {/* Status text */}
          <div className="flex flex-col items-center gap-4">
            <p className="text-xl text-[var(--cohere-text)]">
              Loading model...
            </p>

            {/* Progress bar */}
            <div className="w-80 h-1.5 bg-[var(--cohere-border)] rounded-full overflow-hidden">
              <div
                className="h-full rounded-full transition-all duration-300 ease-out"
                style={{
                  width: `${transcriber.progress}%`,
                  background:
                    "linear-gradient(90deg, var(--cohere-deep-purple), var(--cohere-purple), var(--cohere-cyan))",
                }}
              />
            </div>

            <p className="text-sm text-[var(--cohere-text-muted)]">
              {transcriber.statusText}
            </p>
          </div>
        </div>

        {/* Footer */}
        <p className="absolute bottom-8 text-xs text-[var(--cohere-text-muted)]">
          Powered by Transformers.js
        </p>
      </div>

      {/* ==================== Screen 3: Transcription ==================== */}
      <div
        className={`${getScreenClass("transcription")} flex flex-col bg-white`}
      >
        {/* Header */}
        <header className="flex items-center px-8 py-5 border-b border-[var(--cohere-border)]">
          <img src="/cohere.svg" alt="Cohere" className="h-6" />
        </header>

        {/* Main content */}
        <div className="flex-1 flex items-center justify-center px-8 py-10">
          {mode === "idle" ? (
            /* ---- Mode Selection + Language ---- */
            <div className="flex flex-col items-center gap-10 animate-fade-in-up">
              {/* Upload / Record cards */}
              <div className="flex flex-col sm:flex-row gap-8">
                {/* Upload File Card */}
                <button
                  onClick={() => fileInputRef.current?.click()}
                  className="group w-72 h-72 rounded-2xl border border-[var(--cohere-border)] bg-[var(--cohere-surface)] hover:border-[var(--cohere-purple)] transition-all duration-300 cursor-pointer flex flex-col items-center justify-center gap-5 hover:shadow-[0_0_60px_-15px_var(--cohere-purple)]"
                >
                  <div className="text-[var(--cohere-text-muted)] group-hover:text-[var(--cohere-purple)] transition-colors duration-300">
                    <UploadIcon />
                  </div>
                  <span className="text-xl text-[var(--cohere-text)]">
                    Choose File
                  </span>
                  <span className="text-base text-[var(--cohere-text-muted)]">
                    Select audio/video file
                  </span>
                </button>

                {/* Record Audio Card */}
                <button
                  onClick={startRecording}
                  className="group w-72 h-72 rounded-2xl border border-[var(--cohere-border)] bg-[var(--cohere-surface)] hover:border-[var(--cohere-purple)] transition-all duration-300 cursor-pointer flex flex-col items-center justify-center gap-5 hover:shadow-[0_0_60px_-15px_var(--cohere-purple)]"
                >
                  <div className="text-[var(--cohere-text-muted)] group-hover:text-[var(--cohere-purple)] transition-colors duration-300">
                    <MicrophoneIcon />
                  </div>
                  <span className="text-xl text-[var(--cohere-text)]">
                    Record Audio
                  </span>
                  <span className="text-base text-[var(--cohere-text-muted)]">
                    Use your microphone
                  </span>
                </button>
              </div>

              {/* Language selector */}
              <div className="flex flex-col items-center gap-3">
                <span className="text-sm text-[var(--cohere-text-muted)]">
                  Language
                </span>
                <div className="flex flex-wrap justify-center gap-2 max-w-xl">
                  {LANGUAGES.map((lang) => (
                    <button
                      key={lang.code}
                      onClick={(e) => {
                        setLanguage(lang.code);
                        const rect = e.currentTarget.getBoundingClientRect();
                        confettiRef.current?.burst(
                          rect.left + rect.width / 2,
                          rect.top + rect.height / 2,
                          langToFlag(lang.code),
                        );
                      }}
                      className={`px-4 py-2 rounded-full text-sm transition-colors duration-200 cursor-pointer border ${
                        language === lang.code
                          ? "bg-[var(--cohere-purple)] text-white border-transparent"
                          : "bg-[var(--cohere-surface)] text-[var(--cohere-text-muted)] border-[var(--cohere-border)] hover:border-[var(--cohere-purple)] hover:text-[var(--cohere-purple)]"
                      }`}
                    >
                      {lang.label}
                      {lang.label !== lang.native && (
                        <span
                          className={`ml-1 ${
                            language === lang.code
                              ? "text-white/60"
                              : "text-[var(--cohere-text-muted)]/50"
                          }`}
                        >
                          / {lang.native}
                        </span>
                      )}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          ) : (
            /* ---- Transcription Area ---- */
            <div className="w-full max-w-3xl flex flex-col gap-6 animate-fade-in-up">
              {/* Source indicator + status */}
              <div className="flex items-center gap-3">
                <div className="text-[var(--cohere-purple)]">
                  {mode === "file" ? <FileIcon /> : <MicSmallIcon />}
                </div>
                <span className="text-[var(--cohere-text)] text-base">
                  {mode === "file" ? audioFileName : "Microphone recording"}
                </span>

                {/* Recording controls */}
                {isRecording && (
                  <div className="flex items-center gap-3 ml-auto">
                    <span className="flex items-center gap-2 text-sm text-red-500">
                      <span className="w-2 h-2 bg-red-500 rounded-full animate-pulse" />
                      Recording...
                    </span>
                    <button
                      onClick={stopRecording}
                      className="px-4 py-1.5 text-sm bg-red-50 text-red-500 border border-red-200 rounded-lg hover:bg-red-100 transition-colors cursor-pointer"
                    >
                      Stop
                    </button>
                  </div>
                )}

                {/* Status badge */}
                {isTranscribing && !isRecording && (
                  <span className="ml-auto flex items-center gap-2 text-sm text-[var(--cohere-text-muted)]">
                    <svg
                      className="animate-spin-slow"
                      width="14"
                      height="14"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                    >
                      <path d="M21 12a9 9 0 1 1-6.219-8.56" />
                    </svg>
                    Transcribing...
                  </span>
                )}
                {isDone && (
                  <span className="ml-auto flex items-center gap-2 text-sm text-emerald-600">
                    <CheckIcon />
                    {stats
                      ? `Transcribed ${formatDuration(stats.audioDuration)} of audio in ${formatDuration(stats.elapsed)}`
                      : "Complete"}
                  </span>
                )}
              </div>

              {/* Transcription output */}
              <div
                ref={outputRef}
                className="bg-[var(--cohere-surface)] rounded-xl p-8 min-h-[280px] max-h-[500px] overflow-y-auto border border-[var(--cohere-border)]"
              >
                {displayText ? (
                  <p className="text-xl leading-relaxed text-[var(--cohere-text)] whitespace-pre-wrap">
                    {displayText.trim()}
                  </p>
                ) : isRecording ? (
                  <p className="text-[var(--cohere-text-muted)] italic">
                    Listening... Press stop when you're done speaking.
                  </p>
                ) : isTranscribing ? (
                  <div className="space-y-3">
                    <div className="h-4 w-full rounded animate-shimmer" />
                    <div className="h-4 w-5/6 rounded animate-shimmer" />
                    <div className="h-4 w-4/6 rounded animate-shimmer" />
                  </div>
                ) : null}
              </div>

              {/* Actions */}
              <div className="flex items-center justify-center gap-4">
                {isDone && (
                  <>
                    <button
                      onClick={copyToClipboard}
                      className="flex items-center gap-2 px-5 py-2.5 text-base border border-[var(--cohere-border)] text-[var(--cohere-text-muted)] rounded-lg hover:border-[var(--cohere-purple)] hover:text-[var(--cohere-purple)] transition-all duration-200 cursor-pointer"
                    >
                      {copied ? <CheckIcon /> : <CopyIcon />}
                      {copied ? "Copied" : "Copy"}
                    </button>
                    <button
                      onClick={downloadText}
                      className="flex items-center gap-2 px-5 py-2.5 text-base border border-[var(--cohere-border)] text-[var(--cohere-text-muted)] rounded-lg hover:border-[var(--cohere-purple)] hover:text-[var(--cohere-purple)] transition-all duration-200 cursor-pointer"
                    >
                      <DownloadIcon />
                      Download
                    </button>
                    <button
                      onClick={resetTranscription}
                      className="flex items-center gap-2 px-5 py-2.5 text-base border border-[var(--cohere-purple)] text-[var(--cohere-purple)] rounded-lg hover:bg-[var(--cohere-purple)] hover:text-white transition-all duration-200 cursor-pointer"
                    >
                      New Transcription
                    </button>
                  </>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <p className="pb-4 text-center text-xs text-[var(--cohere-text-muted)]">
          Runs 100% locally in your browser with WebGPU
        </p>
      </div>

      {/* Drag overlay */}
      {isDragging && (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-white/80 backdrop-blur-sm pointer-events-none">
          <div className="flex flex-col items-center gap-4 rounded-2xl border-2 border-dashed border-[var(--cohere-purple)] bg-[var(--cohere-surface)] px-16 py-12">
            <UploadIcon />
            <p className="text-lg text-[var(--cohere-text)]">
              Drop audio/video file here
            </p>
          </div>
        </div>
      )}

      {/* Confetti overlay */}
      <Confetti ref={confettiRef} />

      {/* Hidden file input */}
      <input
        ref={fileInputRef}
        type="file"
        accept="audio/*,video/*"
        className="hidden"
        onChange={handleFileSelect}
      />
    </div>
  );
}

export default App;
