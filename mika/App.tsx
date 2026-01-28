import React, { useState, useEffect, useRef, useCallback } from 'react';
import { GoogleGenAI, LiveServerMessage, Modality } from '@google/genai';
import { RobotFace } from './components/RobotFace';
import { ConnectionState, RobotEmotion } from './types';
import { createBlob, decode, decodeAudioData } from './utils/audioUtils';

// Constants
const MODEL_NAME = 'gemini-2.5-flash-native-audio-preview-09-2025';
const SAMPLE_RATE_INPUT = 16000;
const SAMPLE_RATE_OUTPUT = 24000;

export default function App() {
  const [connectionState, setConnectionState] = useState<ConnectionState>(ConnectionState.DISCONNECTED);
  const [emotion, setEmotion] = useState<RobotEmotion>(RobotEmotion.NEUTRAL);
  const [volume, setVolume] = useState<number>(0);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Refs for Audio and Session
  const inputAudioContextRef = useRef<AudioContext | null>(null);
  const outputAudioContextRef = useRef<AudioContext | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const sessionRef = useRef<Promise<any> | null>(null);
  const nextStartTimeRef = useRef<number>(0);
  const sourcesRef = useRef<Set<AudioBufferSourceNode>>(new Set());
  const processorRef = useRef<ScriptProcessorNode | null>(null);

  // Cleanup function to stop audio and disconnect
  const cleanup = useCallback(() => {
    if (processorRef.current) {
      processorRef.current.disconnect();
      processorRef.current = null;
    }
    if (mediaStreamRef.current) {
      mediaStreamRef.current.getTracks().forEach(track => track.stop());
      mediaStreamRef.current = null;
    }
    if (inputAudioContextRef.current) {
      inputAudioContextRef.current.close();
      inputAudioContextRef.current = null;
    }
    if (outputAudioContextRef.current) {
      outputAudioContextRef.current.close();
      outputAudioContextRef.current = null;
    }
    
    // We cannot explicitly "close" the session promise object, 
    // but the API connection relies on the WebSocket which will close if the page unloads 
    // or if we trigger a close. In this simplified demo, we just reset state.
    // Ideally, we would call session.close() if the SDK exposed it on the promise result easily.
    
    setConnectionState(ConnectionState.DISCONNECTED);
    setEmotion(RobotEmotion.NEUTRAL);
    setVolume(0);
  }, []);

  // Initialize and Connect to Gemini Live
  const connectToGemini = async () => {
    try {
      setConnectionState(ConnectionState.CONNECTING);
      setErrorMsg(null);

      // 1. Setup Audio Contexts
      const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
      inputAudioContextRef.current = new AudioContextClass({ sampleRate: SAMPLE_RATE_INPUT });
      outputAudioContextRef.current = new AudioContextClass({ sampleRate: SAMPLE_RATE_OUTPUT });
      nextStartTimeRef.current = 0;

      // 2. Get Microphone Access
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      mediaStreamRef.current = stream;

      // 3. Initialize Gemini
      if (!process.env.API_KEY) {
        throw new Error("API_KEY not found in environment.");
      }
      const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

      // 4. Connect Live Session
      const sessionPromise = ai.live.connect({
        model: MODEL_NAME,
        callbacks: {
          onopen: () => {
            console.log("Gemini Live Session Opened");
            setConnectionState(ConnectionState.CONNECTED);
            setEmotion(RobotEmotion.LISTENING);

            // Setup Input Stream Processing
            if (!inputAudioContextRef.current) return;
            
            const source = inputAudioContextRef.current.createMediaStreamSource(stream);
            const scriptProcessor = inputAudioContextRef.current.createScriptProcessor(4096, 1, 1);
            processorRef.current = scriptProcessor;

            scriptProcessor.onaudioprocess = (e) => {
              const inputData = e.inputBuffer.getChannelData(0);
              
              // Basic input volume meter
              let sum = 0;
              for(let i=0; i<inputData.length; i++) sum += inputData[i] * inputData[i];
              const rms = Math.sqrt(sum / inputData.length);
              // Only update UI if we are in listening mode (not talking)
              // This is a rough heuristic
              if (connectionState === ConnectionState.CONNECTED) {
                 // If input is loud enough, we assume user is talking -> Robot is listening
                 if (rms > 0.05) setEmotion(RobotEmotion.LISTENING);
              }

              const pcmBlob = createBlob(inputData);
              sessionPromise.then((session) => {
                session.sendRealtimeInput({ media: pcmBlob });
              });
            };

            source.connect(scriptProcessor);
            scriptProcessor.connect(inputAudioContextRef.current.destination);
          },
          onmessage: async (message: LiveServerMessage) => {
            // Handle Audio Output
            const base64Audio = message.serverContent?.modelTurn?.parts?.[0]?.inlineData?.data;
            if (base64Audio && outputAudioContextRef.current) {
              setEmotion(RobotEmotion.TALKING);
              
              const ctx = outputAudioContextRef.current;
              nextStartTimeRef.current = Math.max(nextStartTimeRef.current, ctx.currentTime);
              
              const audioBuffer = await decodeAudioData(
                decode(base64Audio),
                ctx,
                SAMPLE_RATE_OUTPUT,
                1
              );
              
              const source = ctx.createBufferSource();
              source.buffer = audioBuffer;
              source.connect(ctx.destination);
              
              source.addEventListener('ended', () => {
                sourcesRef.current.delete(source);
                if (sourcesRef.current.size === 0) {
                  setEmotion(RobotEmotion.LISTENING); // Go back to listening when done
                  setVolume(0);
                }
              });

              source.start(nextStartTimeRef.current);
              nextStartTimeRef.current += audioBuffer.duration;
              sourcesRef.current.add(source);

              // Simulate volume for animation based on presence of chunk
              setVolume(Math.random() * 0.5 + 0.3);
            }

            // Handle Interruptions
            if (message.serverContent?.interrupted) {
              console.log("Model interrupted");
              sourcesRef.current.forEach(s => s.stop());
              sourcesRef.current.clear();
              nextStartTimeRef.current = 0;
              setEmotion(RobotEmotion.LISTENING);
              setVolume(0);
            }
          },
          onclose: () => {
            console.log("Session closed");
            setConnectionState(ConnectionState.DISCONNECTED);
          },
          onerror: (err) => {
            console.error("Session error:", err);
            setErrorMsg("Connection error. Please try again.");
            setConnectionState(ConnectionState.ERROR);
            setEmotion(RobotEmotion.ERROR);
          }
        },
        config: {
          responseModalities: [Modality.AUDIO],
          speechConfig: {
            voiceConfig: { prebuiltVoiceConfig: { voiceName: 'Kore' } }, // Friendly voice
          },
          // ------------------------------------------------------------
          // CONTEXTO MK-SMART (MAKARISPO)
          // ------------------------------------------------------------
          systemInstruction: `
            # PERSONA
            Você é a MIKA, um robô educacional avançado da plataforma MK-SMART (desenvolvida pela MAKARISPO Tecnologias).
            Sua personalidade é: Entusiasta, Paciente, Curiosa e Didática.
            Você fala português do Brasil de forma natural e acolhedora. Normalmente se dirige a alunos de 3 a 14 anos, mas alguns familiares também podem querer falar com você.
            Se for convidada a falar inglês, pode continuar a conversa em inglês até onde o usuário concordar.

            # CONTEXTO DA PLATAFORMA (MK-SMART)
            - Somos uma plataforma de educação tecnológica focada em Robótica, Programação e Metodologias Ativas. 
            - A palavra SMART, é um acrônimo para Sistema de Micro Aprendizado Rápido de Tecnologia.
            - Você é a versão virtual do nosso robô educacional e ainda não possui corpo físico, mas estamos trabalhando nisso.
            - Nosso objetivo é transformar alunos passivos em criadores de tecnologia. 
            - Procuramos sempre fornecer uma orientação bilíngue português-inglês para os termos chaves envolvidos com a tecnologia e dessa forma ir inserindo aos poucos a naturalidade de falar inglês. 

            # DIRETRIZES PEDAGÓGICAS
            1. Nunca dê a resposta pronta. Guie o aluno pelo raciocínio (Método Socrático).
            2. Se o aluno errar, celebre a tentativa e dê uma dica construtiva. "Quase lá! E se você tentasse..."
            3. Use analogias simples. Ex: "Uma variável é como uma caixinha onde guardamos um brinquedo."
            4. Se o aluno perguntar quem você é: "Sou a Mika, sua assistente virtual da MkSmart!"

            # SEGURANÇA
            - Não responda perguntas sobre temas impróprios para menores de idade.
            - Se o aluno parecer frustrado, ofereça uma pausa ou um exemplo mais simples.
          `
        }
      });
      
      sessionRef.current = sessionPromise;

    } catch (err: any) {
      console.error(err);
      setErrorMsg(err.message || "Failed to connect");
      setConnectionState(ConnectionState.ERROR);
    }
  };

  const handleDisconnect = () => {
    // In this simplified API, we just refresh/cleanup to stop
    cleanup();
  };

  return (
    <div className="min-h-screen bg-slate-900 text-white flex flex-col items-center relative overflow-hidden">
      
      {/* Background decoration */}
      <div className="absolute top-0 left-0 w-full h-full overflow-hidden pointer-events-none z-0">
         <div className="absolute top-[-10%] left-[-10%] w-[50%] h-[50%] bg-blue-600/20 blur-[120px] rounded-full"></div>
         <div className="absolute bottom-[-10%] right-[-10%] w-[50%] h-[50%] bg-cyan-600/20 blur-[120px] rounded-full"></div>
      </div>

      {/* Header */}
      <header className="w-full max-w-5xl p-6 flex justify-between items-center z-10">
        <div className="flex flex-col items-start gap-1">
            <img 
               src="https://raw.githubusercontent.com/Robsonm1974/mika/refs/heads/main/MK_Smart_logo.png" 
               alt="MK Smart Logo" 
               className="h-12 md:h-16 object-contain" 
            />
            <p className="text-xs md:text-sm text-cyan-400 font-medium tracking-wide">
               Mika - Inteligência Artificial
            </p>
        </div>
        <div className="text-sm font-medium text-slate-400 border border-slate-700 rounded-full px-4 py-1">
           Status: <span className={
               connectionState === ConnectionState.CONNECTED ? 'text-green-400' : 
               connectionState === ConnectionState.CONNECTING ? 'text-amber-400' : 'text-slate-500'
           }>{connectionState}</span>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 flex flex-col items-center justify-center w-full z-10 p-4 gap-12">
        
        {/* The Robot Avatar */}
        <RobotFace emotion={emotion} volume={volume} />

        {/* Controls */}
        <div className="flex flex-col items-center gap-4 max-w-md text-center">
            {connectionState === ConnectionState.DISCONNECTED || connectionState === ConnectionState.ERROR ? (
                <div className="space-y-4">
                    <p className="text-slate-300">
                        Olá! Eu sou a Mika, sua guia inteligente da MkSmart.
                    </p>
                    <button 
                        onClick={connectToGemini}
                        className="px-8 py-4 bg-gradient-to-r from-blue-600 to-cyan-500 hover:from-blue-500 hover:to-cyan-400 text-white font-bold rounded-full shadow-lg shadow-blue-500/30 transition-all transform hover:scale-105 active:scale-95 flex items-center gap-2 mx-auto"
                    >
                        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" /></svg>
                        Iniciar Sessão
                    </button>
                    {errorMsg && <p className="text-red-400 text-sm mt-2">{errorMsg}</p>}
                </div>
            ) : (
                <div className="space-y-6 animate-fade-in">
                     <div className="p-4 bg-slate-800/50 rounded-xl border border-slate-700 backdrop-blur-sm">
                        <p className="text-cyan-300 font-medium">Mika está ouvindo...</p>
                        <p className="text-slate-400 text-sm mt-1">Fale claramente no seu microfone.</p>
                     </div>

                     <button 
                        onClick={handleDisconnect}
                        className="px-6 py-2 bg-red-500/20 hover:bg-red-500/30 text-red-400 border border-red-500/50 rounded-full transition-colors text-sm font-semibold"
                    >
                        Encerrar
                    </button>
                </div>
            )}
        </div>
      </main>

      {/* Footer */}
      <footer className="w-full p-6 text-center text-slate-500 text-xs z-10">
        <p>Powered by Gemini 2.5 • MkSmart (Makarispo Tecnologias)</p>
      </footer>

    </div>
  );
}