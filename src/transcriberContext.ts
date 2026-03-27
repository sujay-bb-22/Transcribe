import { createContext, useContext } from "react";

export interface TranscriberState {
  status: "idle" | "loading" | "ready" | "error";
  error: string | null;
  progress: number;
  statusText: string;
  load: () => Promise<void>;
  transcribe: (
    audio: Float32Array,
    language?: string,
    onToken?: (token: string) => void,
  ) => Promise<string>;
}

export const TranscriberContext = createContext<TranscriberState | null>(null);

export function useTranscriber() {
  const ctx = useContext(TranscriberContext);
  if (!ctx) {
    throw new Error("useTranscriber must be used within TranscriberProvider");
  }
  return ctx;
}
