/**
 * Dedicated Ringtone Service for Grezto Admin / Merchant Panel.
 * Uses real-time physical Web Audio API synthesis for high priority, zero-latency, offline-ready premium ringtones.
 * Bypasses CORS blocks, slow network loading, and asset failures on web and Android WebViews.
 */

import { startContinuousCallVibration, stopContinuousCallVibration } from './nativeService';
import { clearAllNativeNotifications } from './notifications';

interface RingtoneOptions {
  volume?: number;
  pitchScale?: number;
}

let activeInterval: any = null;
let activeRiderInterval: any = null;
let globalAudioCtx: AudioContext | null = null;
let lastPlayTime = 0;
let lastRiderPlayTime = 0;
let activeOscillators: OscillatorNode[] = [];
let isAcceptingOrderLock = false; // Lock to prevent race conditions during acceptance

/**
 * Lazy initializer for AudioContext to conform to browser autoplay security policies.
 */
function getAudioContext(): AudioContext | null {
  if (!globalAudioCtx) {
    const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
    if (AudioContextClass) {
      globalAudioCtx = new AudioContextClass();
    }
  }
  return globalAudioCtx;
}

/**
 * High-Audibility Synthesized Partner Ringtone (Swiggy/Zepto/Blinkit Partner Style Double-Arpeggiated Double-Triplet Chime).
 */
export function playPremiumOrderSound(options: RingtoneOptions = {}) {
  try {
    const nowMs = Date.now();
    // Throttle playback to prevent dual/overlapping ringtones running at the same time
    if (nowMs - lastPlayTime < 2200) {
      console.log("🔊 Ringtone playback throttled to prevent overlapping/double sound.");
      return null;
    }
    lastPlayTime = nowMs;

    const ctx = getAudioContext();
    if (!ctx) return null;
    
    // Ensure the audio context is resumed (browser safety)
    if (ctx.state === 'suspended') {
      ctx.resume().catch(() => {});
    }

    const now = ctx.currentTime;
    const volume = options.volume ?? 3.2; // Set high digital gain (3.2x) to maximize speaker volume for loud environments

    // Dynamics Compressor to maximize loudness and prevent speaker clipping/distortion
    const compressor = ctx.createDynamicsCompressor();
    compressor.threshold.setValueAtTime(-8, now);
    compressor.knee.setValueAtTime(40, now);
    compressor.ratio.setValueAtTime(16, now);
    compressor.attack.setValueAtTime(0.002, now);
    compressor.release.setValueAtTime(0.04, now);
    compressor.connect(ctx.destination);

    // Helper to synthesize a crisp, highly resonant and penetrative alarm note
    const playChimeNote = (freq: number, startTime: number, duration: number) => {
      // 1. Primary crystal oscillator (crisp sine wave)
      const osc = ctx.createOscillator();
      const gainNode = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, startTime);

      // 2. Supplementary warm brass core (triangle wave)
      const overtone = ctx.createOscillator();
      const overtoneGain = ctx.createGain();
      overtone.type = 'triangle';
      overtone.frequency.setValueAtTime(freq * 1.5, startTime);

      // 3. Ultra-penetrating buzz core (sawtooth wave at low volume to cut through ambient noise)
      const sharpOsc = ctx.createOscillator();
      const sharpGain = ctx.createGain();
      sharpOsc.type = 'sawtooth';
      sharpOsc.frequency.setValueAtTime(freq / 2, startTime); // Low octave power

      // Gain envelopes
      gainNode.gain.setValueAtTime(0, startTime);
      gainNode.gain.linearRampToValueAtTime(volume * 0.8, startTime + 0.02);
      gainNode.gain.exponentialRampToValueAtTime(0.0001, startTime + duration);

      overtoneGain.gain.setValueAtTime(0, startTime);
      overtoneGain.gain.linearRampToValueAtTime(volume * 0.28, startTime + 0.015);
      overtoneGain.gain.exponentialRampToValueAtTime(0.0001, startTime + duration * 0.6);

      sharpGain.gain.setValueAtTime(0, startTime);
      sharpGain.gain.linearRampToValueAtTime(volume * 0.10, startTime + 0.01);
      sharpGain.gain.exponentialRampToValueAtTime(0.0001, startTime + duration * 0.35);

      // Connect nodes
      osc.connect(gainNode);
      overtone.connect(overtoneGain);
      sharpOsc.connect(sharpGain);
      
      gainNode.connect(compressor);
      overtoneGain.connect(compressor);
      sharpGain.connect(compressor);

      // Start / Stop oscillators
      osc.start(startTime);
      overtone.start(startTime);
      sharpOsc.start(startTime);

      osc.stop(startTime + duration);
      overtone.stop(startTime + duration);
      sharpOsc.stop(startTime + duration);

      activeOscillators.push(osc, overtone, sharpOsc);

      setTimeout(() => {
        activeOscillators = activeOscillators.filter(n => n !== osc && n !== overtone && n !== sharpOsc);
      }, (startTime - ctx.currentTime + duration) * 1000 + 100);
    };

    // --- Double-Arpeggiated Double-Triplet Chime Pattern ---
    
    // First Triplet (Ascending Crystal Arpeggio)
    playChimeNote(880.00, now, 0.45);          // A5
    playChimeNote(1046.50, now + 0.07, 0.45);   // C6
    playChimeNote(1318.51, now + 0.14, 0.6);    // E6

    // Second Triplet (Higher Resolution Resolve)
    playChimeNote(1174.66, now + 0.28, 0.45);   // D6
    playChimeNote(1396.91, now + 0.35, 0.45);   // F6
    playChimeNote(1760.00, now + 0.42, 0.85);   // A6 (high crystal ring)

    // Repeat Double-Arpeggio with a pitch shift (offset of 0.65 seconds)
    const secondWaveOffset = 0.65;
    playChimeNote(987.77, now + secondWaveOffset, 0.45);         // B5
    playChimeNote(1174.66, now + secondWaveOffset + 0.07, 0.45);  // D6
    playChimeNote(1479.98, now + secondWaveOffset + 0.14, 0.6);   // F#6

    playChimeNote(1318.51, now + secondWaveOffset + 0.28, 0.45);  // E6
    playChimeNote(1567.98, now + secondWaveOffset + 0.35, 0.45);  // G6
    playChimeNote(1959.98, now + secondWaveOffset + 0.42, 0.9);   // B6 (ultra high piercing)

    // Trigger high-power physical phone feedback vibration sequence
    // Vibration is now managed continuously via the AlarmLoop start/stop bounds!

    return ctx;
  } catch (err) {
    console.warn("Failed to play synthesized audio alert in RingtoneService:", err);
    return null;
  }
}

/**
 * Unlocks the Web Audio context of notifications in response to user interaction.
 * This resolves browser and container WebView silent autoplay policies.
 */
export function unlockNotificationAudio() {
  try {
    const ctx = getAudioContext();
    if (!ctx) return;

    if (ctx.state === 'suspended') {
      ctx.resume().then(() => {
        console.log("🔓 Ringtone AudioContext successfully unlocked on user gesture!");
      }).catch(err => {
        console.warn("Could not resume Ringtone AudioContext:", err);
      });
    }
  } catch (e) {
    console.warn("Failed to unlock ringtone audio context:", e);
  }
}

/**
 * Starts a recurring loop for our high-priority order alarm sound.
 */
export function startAlertAlarmLoop() {
  if (isAcceptingOrderLock) return; // Prevent race conditions
  if (activeInterval) {
    // Alarm loop is already active, do not start another one
    return;
  }
  
  const ctx = getAudioContext();
  if (ctx && ctx.state === 'suspended') {
    ctx.resume().catch(() => {});
  }

  // Play immediately AND trigger continuous physical call vibration
  playPremiumOrderSound();
  startContinuousCallVibration();
  
  // Loop every 2.8 seconds
  activeInterval = setInterval(() => {
    playPremiumOrderSound();
  }, 2800);
}

/**
 * Stops any active order alarm sounds.
 */
export function stopAlertAlarmLoop(permanentlyLockForAcceptance = false) {
  if (permanentlyLockForAcceptance) {
    isAcceptingOrderLock = true;
    setTimeout(() => { isAcceptingOrderLock = false; }, 3000); // 3 seconds lock to swallow late real-time updates
  }

  stopContinuousCallVibration();
  clearAllNativeNotifications(); // 🧹 MAGIC: Clear push notification from tray instantly!

  if (activeInterval) {
    clearInterval(activeInterval);
    activeInterval = null;
  }
  
  // IMMEDIATELY kill all currently playing audio nodes so they don't finish their chime
  // and prevent memory leaks and "heavy" app behavior.
  activeOscillators.forEach(osc => {
    try {
      osc.stop();
      osc.disconnect();
    } catch (e) {
      // Ignore if already stopped
    }
  });
  activeOscillators = [];
  lastPlayTime = 0; // Allow next alarm to start instantly without throttling
}

/**
 * High-Audibility Synthesized Siren for Rider App.
 * Uses a rapid oscillating square wave (like an urgent telephone ring or siren).
 */
export function playRiderSirenSound(options: RingtoneOptions = {}) {
  try {
    const nowMs = Date.now();
    // Throttle playback
    if (nowMs - lastRiderPlayTime < 2200) {
      return null;
    }
    lastRiderPlayTime = nowMs;

    const ctx = getAudioContext();
    if (!ctx) return null;
    
    if (ctx.state === 'suspended') {
      ctx.resume().catch(() => {});
    }

    const now = ctx.currentTime;
    const volume = options.volume ?? 3.8; // Very loud

    // Dynamics Compressor
    const compressor = ctx.createDynamicsCompressor();
    compressor.threshold.setValueAtTime(-8, now);
    compressor.knee.setValueAtTime(40, now);
    compressor.ratio.setValueAtTime(16, now);
    compressor.attack.setValueAtTime(0.002, now);
    compressor.release.setValueAtTime(0.04, now);
    compressor.connect(ctx.destination);

    // Urgent fast oscillating siren using an LFO for a classic electronic phone ring
    const osc = ctx.createOscillator();
    const gainNode = ctx.createGain();
    
    osc.type = 'square'; // Harsher, piercing tone
    osc.frequency.setValueAtTime(800, now);
    
    // Create LFO for the rapid trill effect (ringing sound)
    const lfo = ctx.createOscillator();
    lfo.type = 'square';
    lfo.frequency.setValueAtTime(20, now); // 20 Hz fast trill
    const lfoGain = ctx.createGain();
    lfoGain.gain.setValueAtTime(150, now); // Swing by 150 Hz
    
    lfo.connect(lfoGain);
    lfoGain.connect(osc.frequency);

    // Gain Envelopes (Ring for 1.8 seconds, then gap)
    gainNode.gain.setValueAtTime(0, now);
    gainNode.gain.linearRampToValueAtTime(volume * 0.4, now + 0.05);
    gainNode.gain.setValueAtTime(volume * 0.4, now + 1.8);
    gainNode.gain.exponentialRampToValueAtTime(0.0001, now + 1.95);

    osc.connect(gainNode);
    gainNode.connect(compressor);

    osc.start(now);
    lfo.start(now);
    
    osc.stop(now + 2.0);
    lfo.stop(now + 2.0);

    activeOscillators.push(osc, lfo);

    setTimeout(() => {
      activeOscillators = activeOscillators.filter(n => n !== osc && n !== lfo);
    }, 2100);

    return ctx;
  } catch (err) {
    console.warn("Failed to play Rider Siren audio alert:", err);
    return null;
  }
}

/**
 * Starts a recurring loop for our high-priority RIDER alarm sound.
 */
export function startRiderAlertAlarmLoop() {
  if (isAcceptingOrderLock) return; // Prevent race conditions
  if (activeRiderInterval) {
    return;
  }
  
  const ctx = getAudioContext();
  if (ctx && ctx.state === 'suspended') {
    ctx.resume().catch(() => {});
  }

  playRiderSirenSound();
  startContinuousCallVibration();
  
  activeRiderInterval = setInterval(() => {
    playRiderSirenSound();
  }, 2500); // slightly faster repetition
}

/**
 * Stops any active RIDER alarm sounds.
 */
export function stopRiderAlertAlarmLoop(permanentlyLockForAcceptance = false) {
  if (permanentlyLockForAcceptance) {
    isAcceptingOrderLock = true;
    setTimeout(() => { isAcceptingOrderLock = false; }, 3000);
  }

  stopContinuousCallVibration();
  clearAllNativeNotifications(); // 🧹 Clear push notifications for rider too!

  if (activeRiderInterval) {
    clearInterval(activeRiderInterval);
    activeRiderInterval = null;
  }
  
  activeOscillators.forEach(osc => {
    try {
      osc.stop();
      osc.disconnect();
    } catch (e) {}
  });
  activeOscillators = [];
  lastRiderPlayTime = 0;
}


