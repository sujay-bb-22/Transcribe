Transcribe — AI-Powered Browser Speech Recognition

A fully client-side, AI-powered speech recognition and transcription web application that converts audio into text in real time — directly in the browser, with zero backend and zero API usage.

Built using modern web technologies and optimized ONNX models, this project demonstrates how on-device AI inference can deliver fast, private, and scalable speech-to-text experiences.

🚀Live Demo--https://transcribe-ok34.vercel.app/

Key Features

Real-Time & File-Based Transcription
  Live microphone input (real-time speech-to-text)
  Upload audio/video files (drag-and-drop supported)
  Streaming transcription as audio is processed

 
Fully Local AI Inference
  Runs entirely in the browser using: cohere-transcribe-03-2026-ONNX
  Powered by Transformers.js
  Uses WebGPU acceleration for high-performance inference
  No external APIs, no server calls


Multi-Language Support
  Supports 14+ languages
  English, French, Japanese, and more
  Interactive UI for language selection


Clean Output & Export Options
  Real-time text display
  Copy to clipboard
  Download transcription as .txt

Tech Stack
  Category	Technology
  Frontend	React 19 + TypeScript
  Build Tool	Vite 8
  Styling	Tailwind CSS 4.2
  AI Model	ONNX (Cohere Transcribe)
  Inference	Transformers.js
  Acceleration	WebGPU
  Deployment	Vercel


Architecture Overview
  User Input (Mic / File)
          ↓
  Audio Processing (Browser)
          ↓
  ONNX Speech Model (Transformers.js)
          ↓
  WebGPU Acceleration
          ↓
  Real-Time Text Output
          ↓
  Export (.txt / Clipboard)
