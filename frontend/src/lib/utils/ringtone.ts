let audioContext: AudioContext | null = null;
let ringtoneTimer: ReturnType<typeof setInterval> | null = null;
let activeOscillators: OscillatorNode[] = [];

function getContext(): AudioContext {
	if (!audioContext || audioContext.state === 'closed') {
		audioContext = new AudioContext();
	}
	if (audioContext.state === 'suspended') {
		audioContext.resume();
	}
	return audioContext;
}

function playTone(freq: number, duration: number, delay = 0, volume = 0.15) {
	const ctx = getContext();
	const osc = ctx.createOscillator();
	const gain = ctx.createGain();

	osc.type = 'sine';
	osc.frequency.value = freq;

	const start = ctx.currentTime + delay;
	gain.gain.setValueAtTime(volume, start);
	gain.gain.exponentialRampToValueAtTime(0.001, start + duration);

	osc.connect(gain);
	gain.connect(ctx.destination);

	osc.start(start);
	osc.stop(start + duration);

	activeOscillators.push(osc);
	osc.onended = () => {
		activeOscillators = activeOscillators.filter((o) => o !== osc);
	};
}

/** Outgoing ring-back: US-style dual tone (440+480 Hz), 2s on / 4s off */
export function startOutgoingRingtone() {
	stopRingtone();
	const ring = () => {
		playTone(440, 1.8, 0, 0.08);
		playTone(480, 1.8, 0, 0.08);
	};
	ring();
	ringtoneTimer = setInterval(ring, 4000);
}

/** Incoming ring: attention-grabbing alternating tones */
export function startIncomingRingtone() {
	stopRingtone();
	const ring = () => {
		// Two short bursts
		playTone(523, 0.25, 0, 0.15); // C5
		playTone(659, 0.25, 0, 0.12); // E5
		playTone(523, 0.25, 0.35, 0.15);
		playTone(659, 0.25, 0.35, 0.12);
	};
	ring();
	ringtoneTimer = setInterval(ring, 2500);
}

export function stopRingtone() {
	if (ringtoneTimer) {
		clearInterval(ringtoneTimer);
		ringtoneTimer = null;
	}
	for (const osc of activeOscillators) {
		try {
			osc.stop();
		} catch {
			// already stopped
		}
	}
	activeOscillators = [];
}
