import { useRef, useState, useCallback, type ReactNode } from "react";
import {
  pipeline,
  TextStreamer,
  type AutomaticSpeechRecognitionPipeline,
  type AutomaticSpeechRecognitionOutput,
} from "@huggingface/transformers";
import {
  TranscriberContext,
  type TranscriberState,
} from "./transcriberContext.ts";

const MODEL_ID = "onnx-community/cohere-transcribe-03-2026-ONNX";

export function TranscriberProvider({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<TranscriberState["status"]>("idle");
  const [error, setError] = useState<string | null>(null);
  const [progress, setProgress] = useState(0);
  const [statusText, setStatusText] = useState("Initializing...");
  const pipelineRef = useRef<AutomaticSpeechRecognitionPipeline | null>(null);
  const loadingRef = useRef<Promise<void> | null>(null);

  const load = useCallback(async () => {
    if (pipelineRef.current) return;
    if (loadingRef.current) return loadingRef.current;

    const loadPromise = (async () => {
      setStatus("loading");
      setProgress(0);
      setStatusText("Downloading model...");

      try {
        const transcriber = await pipeline(
          "automatic-speech-recognition",
          MODEL_ID,
          {
            dtype: "q4",
            device: "webgpu",
            progress_callback: (info: {
              status: string;
              progress?: number;
            }) => {
              if (info.status === "progress_total") {
                const pct = Math.round(info.progress ?? 0);
                setProgress(pct);
                setStatusText(`Loading model... ${pct}%`);
              }
            },
          },
        );
        pipelineRef.current = transcriber;
        setProgress(100);
        setStatusText("Ready");
        setStatus("ready");
      } catch (err) {
        console.error("Failed to load transcription model:", err);
        const message =
          err instanceof Error ? err.message : "Failed to load model";
        setStatus("error");
        setError(message);
        setStatusText(message);
      }
    })();

    loadingRef.current = loadPromise;
    return loadPromise;
  }, []);

  const transcribe = useCallback(
    async (
      audio: Float32Array,
      language?: string,
      onToken?: (token: string) => void,
    ) => {
      if (!pipelineRef.current) {
        throw new Error("Model not loaded");
      }

      const streamer = onToken
        ? new TextStreamer(pipelineRef.current.tokenizer, {
            skip_prompt: true,
            skip_special_tokens: true,
            callback_function: onToken,
          })
        : undefined;

      const result = (await pipelineRef.current(audio, {
        max_new_tokens: 1024,
        language,
        streamer,
      })) as AutomaticSpeechRecognitionOutput;
      return result.text;
    },
    [],
  );

  return (
    <TranscriberContext.Provider
      value={{ status, error, progress, statusText, load, transcribe }}
    >
      {children}
    </TranscriberContext.Provider>
  );
}
