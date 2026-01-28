import React, { useState, useEffect, useRef } from 'react';
import { RobotEmotion } from '../types';

interface RobotFaceProps {
  emotion: RobotEmotion;
  volume: number; // 0 to 1
}

// Asset URLs - Version 4 (Expanded Lip Sync & 1500x1500px Optimized)
const ASSETS = {
  face: "https://raw.githubusercontent.com/Robsonm1974/mika/refs/heads/main/Mika_Riging.png",
  
  // Eyes
  eyesOpen: "https://raw.githubusercontent.com/Robsonm1974/mika/refs/heads/main/openned_eyes.png",
  eyesClosed: "https://raw.githubusercontent.com/Robsonm1974/mika/refs/heads/main/closed_eyes.png",
  eyesWink: "https://raw.githubusercontent.com/Robsonm1974/mika/refs/heads/main/blinking_left_eyes.png",
  eyesUpLeft: "https://raw.githubusercontent.com/Robsonm1974/mika/refs/heads/main/lookin_upLeft_eyes.png",
  eyesUpRight: "https://raw.githubusercontent.com/Robsonm1974/mika/refs/heads/main/looking_upRight_eyes.png",
  eyesUp: "https://raw.githubusercontent.com/Robsonm1974/mika/refs/heads/main/looking_up_eyes.png",

  // Mouths (Phonemes/Visemes)
  mouthNeutral: "https://raw.githubusercontent.com/Robsonm1974/mika/refs/heads/main/mouth_Fechada_Neutra.png",
  mouthAEI: "https://raw.githubusercontent.com/Robsonm1974/mika/refs/heads/main/mouth_AEI.png", // A, E, I
  mouthBMP: "https://raw.githubusercontent.com/Robsonm1974/mika/refs/heads/main/mouth_BMP.png", // B, M, P
  mouthFV: "https://raw.githubusercontent.com/Robsonm1974/mika/refs/heads/main/mouth_FV.png",   // F, V
  mouthUuOo: "https://raw.githubusercontent.com/Robsonm1974/mika/refs/heads/main/mouth_UuOo.png" // U, O
};

type EyeState = 'open' | 'closed' | 'wink' | 'upLeft' | 'upRight' | 'up';
type MouthState = 'neutral' | 'aei' | 'bmp' | 'fv' | 'uuoo';

export const RobotFace: React.FC<RobotFaceProps> = ({ emotion, volume }) => {
  const [eyeState, setEyeState] = useState<EyeState>('open');
  const [mouthFrame, setMouthFrame] = useState<MouthState>('neutral');
  const mouthIntervalRef = useRef<any>(null);

  const isTalking = emotion === RobotEmotion.TALKING;

  // --- EYE ANIMATION LOGIC (Idle Behavior) ---
  useEffect(() => {
    let timerRef: any;

    const scheduleEyeAnimation = () => {
      // If Talking: Mainly maintain eye contact, blink occasionally
      if (emotion === RobotEmotion.TALKING) {
         const nextBlinkDelay = 2000 + Math.random() * 3000;
         timerRef = setTimeout(() => {
           setEyeState('closed');
           setTimeout(() => {
             setEyeState('open');
             scheduleEyeAnimation();
           }, 150);
         }, nextBlinkDelay);
         return;
      }

      // If Idle: Look around naturally
      const nextActionDelay = 2000 + Math.random() * 2500;
      
      timerRef = setTimeout(() => {
        const rand = Math.random();
        
        if (rand < 0.20) {
          // Blink
          setEyeState('closed');
          setTimeout(() => {
            setEyeState('open');
            scheduleEyeAnimation();
          }, 150);
        } else if (rand < 0.25) {
          // Wink
          setEyeState('wink');
          setTimeout(() => {
             setEyeState('open');
             scheduleEyeAnimation();
          }, 600);
        } else if (rand < 0.45) {
          // Look Up Left
          setEyeState('upLeft');
          setTimeout(() => {
            setEyeState('open');
            scheduleEyeAnimation();
          }, 1800);
        } else if (rand < 0.65) {
          // Look Up Right
          setEyeState('upRight');
          setTimeout(() => {
             setEyeState('open');
             scheduleEyeAnimation();
          }, 1800);
        } else if (rand < 0.75) {
           // Look Up
           setEyeState('up');
           setTimeout(() => {
              setEyeState('open');
              scheduleEyeAnimation();
           }, 1500);
        } else {
           // Just stay open
           setEyeState('open');
           scheduleEyeAnimation();
        }
      }, nextActionDelay);
    };

    scheduleEyeAnimation();
    return () => clearTimeout(timerRef);
  }, [emotion]);


  // --- MOUTH ANIMATION LOGIC (Lip Sync Simulation) ---
  useEffect(() => {
    if (isTalking) {
      // We switch mouth shapes rapidly to simulate natural speech patterns
      mouthIntervalRef.current = setInterval(() => {
        const rand = Math.random();
        
        // Weighted probabilities for different mouth shapes based on typical speech freq
        if (rand < 0.45) {
            setMouthFrame('aei');   // Most frequent (A, E, I sounds)
        } else if (rand < 0.70) {
            setMouthFrame('uuoo');  // Rounded vowels (O, U)
        } else if (rand < 0.85) {
            setMouthFrame('bmp');   // Bilabials (closes mouth momentarily)
        } else {
            setMouthFrame('fv');    // Labiodentals
        }
      }, 90); // ~90ms per phoneme looks fluid
    } else {
      if (mouthIntervalRef.current) clearInterval(mouthIntervalRef.current);
      setMouthFrame('neutral');
    }

    return () => {
      if (mouthIntervalRef.current) clearInterval(mouthIntervalRef.current);
    };
  }, [isTalking]);


  // --- ASSET RESOLUTION ---
  let currentEyeImg = ASSETS.eyesOpen;
  if (emotion === RobotEmotion.ERROR) {
      currentEyeImg = ASSETS.eyesClosed;
  } else {
      switch (eyeState) {
        case 'closed': currentEyeImg = ASSETS.eyesClosed; break;
        case 'wink': currentEyeImg = ASSETS.eyesWink; break;
        case 'upLeft': currentEyeImg = ASSETS.eyesUpLeft; break;
        case 'upRight': currentEyeImg = ASSETS.eyesUpRight; break;
        case 'up': currentEyeImg = ASSETS.eyesUp; break;
        default: currentEyeImg = ASSETS.eyesOpen; break;
      }
  }

  let currentMouthImg = ASSETS.mouthNeutral;
  if (isTalking) {
      switch (mouthFrame) {
          case 'aei': currentMouthImg = ASSETS.mouthAEI; break;
          case 'bmp': currentMouthImg = ASSETS.mouthBMP; break;
          case 'fv': currentMouthImg = ASSETS.mouthFV; break;
          case 'uuoo': currentMouthImg = ASSETS.mouthUuOo; break;
          default: currentMouthImg = ASSETS.mouthNeutral; break;
      }
  } else {
      currentMouthImg = ASSETS.mouthNeutral;
  }

  return (
    <div className="relative w-full max-w-[420px] aspect-square flex items-center justify-center">
       {/* CSS Keyframes for Parallax & Bobbing */}
       <style>{`
          /* Idle Breathing: Gentle float up and down */
          @keyframes breathe-base {
            0%, 100% { transform: translateY(0px); }
            50% { transform: translateY(-8px); }
          }
          @keyframes breathe-features {
            0%, 100% { transform: translateY(0px); }
            50% { transform: translateY(-12px); } /* Features move more = Parallax depth */
          }

          /* Talking Bob: Energetic bounce */
          @keyframes talk-base {
            0%, 100% { transform: translateY(0px); }
            50% { transform: translateY(3px); }
          }
          @keyframes talk-features {
            0%, 100% { transform: translateY(0px); }
            50% { transform: translateY(5px); } /* Features bounce more */
          }

          .anim-idle-base { animation: breathe-base 4s ease-in-out infinite; }
          .anim-idle-features { animation: breathe-features 4s ease-in-out infinite; }
          
          .anim-talk-base { animation: talk-base 0.4s ease-in-out infinite; }
          .anim-talk-features { animation: talk-features 0.4s ease-in-out infinite; }
       `}</style>

       {/* 
          LAYER 1: FACE BASE (Body) 
          Moves slightly less to simulate being "further back".
       */}
       <div className={`absolute inset-0 z-0 transition-all duration-500 ${isTalking ? 'anim-talk-base' : 'anim-idle-base'}`}>
         <img 
           src={ASSETS.face} 
           className="w-full h-full object-contain pointer-events-none drop-shadow-2xl" 
           alt="Mika Face" 
         />
       </div>

       {/* 
          LAYER 2: FEATURES (Eyes + Mouth)
          Moves slightly MORE to simulate 3D depth/floating.
       */}
       <div className={`absolute inset-0 z-10 transition-all duration-500 ${isTalking ? 'anim-talk-features' : 'anim-idle-features'}`}>
          {/* Eyes */}
          <div className="absolute inset-0">
            <img 
              src={currentEyeImg} 
              className="w-full h-full object-contain pointer-events-none" 
              alt="Mika Eyes" 
            />
          </div>

          {/* Mouth */}
          <div className="absolute inset-0">
            <img 
              src={currentMouthImg} 
              className="w-full h-full object-contain pointer-events-none" 
              alt="Mika Mouth" 
            />
          </div>
       </div>
    </div>
  );
};