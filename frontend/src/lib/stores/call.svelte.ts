import {
	createCallSignal,
	getIncomingCalls,
	getNewCallSignals,
	updateCallSignalStatus,
} from '$lib/api/calls';
import { startOutgoingRingtone, startIncomingRingtone, stopRingtone } from '$lib/utils/ringtone';
import type { PayloadCallSignal } from '$lib/types/payload';

type CallState = 'idle' | 'calling' | 'incoming' | 'active';

let callState = $state<CallState>('idle');
let remoteUser = $state('');
let isMuted = $state(false);
let incomingSignal = $state<PayloadCallSignal | null>(null);

let localUsername = '';
let callId = '';
let offerSignalId: number | null = null;
let peerConnection: RTCPeerConnection | null = null;
let localStream: MediaStream | null = null;
let remoteStream: MediaStream | null = null;
let remoteAudioEl: HTMLAudioElement | null = null;
let incomingPollTimer: ReturnType<typeof setInterval> | null = null;
let signalingPollTimer: ReturnType<typeof setInterval> | null = null;
let lastSignalTimestamp = '';
let pendingIceCandidates: RTCIceCandidate[] = [];

const RTC_CONFIG: RTCConfiguration = {
	iceServers: [
		{ urls: 'stun:stun.l.google.com:19302' },
		{ urls: 'stun:stun1.l.google.com:19302' },
		{ urls: 'stun:stun.cloudflare.com:3478' },
	],
};

export function getCallState() {
	return callState;
}

export function getRemoteUser() {
	return remoteUser;
}

export function getIsMuted() {
	return isMuted;
}

export function getIncomingSignal() {
	return incomingSignal;
}

export function setRemoteAudioElement(el: HTMLAudioElement) {
	remoteAudioEl = el;
	if (remoteStream) {
		remoteAudioEl.srcObject = remoteStream;
	}
}

export function initCallSystem(username: string) {
	localUsername = username;
	incomingPollTimer = setInterval(pollForIncomingCalls, 3000);
}

export function destroyCallSystem() {
	cleanup();
	if (incomingPollTimer) {
		clearInterval(incomingPollTimer);
		incomingPollTimer = null;
	}
}

async function pollForIncomingCalls() {
	if (callState !== 'idle') return;
	try {
		const res = await getIncomingCalls(localUsername);
		// BUG-C3: Re-check state after async gap — user may have started a call during the request
		if (callState !== 'idle') return;
		if (res.docs.length > 0) {
			const offer = res.docs[0];
			incomingSignal = offer;
			callId = offer.callId;
			remoteUser = offer.from;
			callState = 'incoming';
			startIncomingRingtone();
		}
	} catch {
		// silent fail
	}
}

export async function startCall(targetUser: string) {
	if (callState !== 'idle') return;

	remoteUser = targetUser;
	callId = crypto.randomUUID();
	callState = 'calling';

	try {
		localStream = await navigator.mediaDevices.getUserMedia({ audio: true });
		peerConnection = new RTCPeerConnection(RTC_CONFIG);

		localStream.getTracks().forEach((track) => {
			peerConnection!.addTrack(track, localStream!);
		});

		setupPeerConnectionHandlers();

		const offer = await peerConnection.createOffer();
		await peerConnection.setLocalDescription(offer);

		const offerSignal = await createCallSignal({
			callId,
			from: localUsername,
			to: targetUser,
			type: 'offer',
			data: { sdp: offer.sdp, type: offer.type },
			status: 'pending',
		});
		offerSignalId = offerSignal.id;

		lastSignalTimestamp = new Date().toISOString();
		startSignalingPoll();
		startOutgoingRingtone();
	} catch {
		cleanup();
	}
}

export async function acceptCall() {
	if (callState !== 'incoming' || !incomingSignal) return;

	stopRingtone();
	callState = 'active';

	try {
		localStream = await navigator.mediaDevices.getUserMedia({ audio: true });
		peerConnection = new RTCPeerConnection(RTC_CONFIG);

		localStream.getTracks().forEach((track) => {
			peerConnection!.addTrack(track, localStream!);
		});

		setupPeerConnectionHandlers();

		const offerData = incomingSignal.data as { sdp: string; type: RTCSdpType };
		await peerConnection.setRemoteDescription(
			new RTCSessionDescription({ sdp: offerData.sdp, type: offerData.type })
		);

		// Flush any ICE candidates that were queued before remote description was set
		for (const candidate of pendingIceCandidates) {
			await peerConnection.addIceCandidate(candidate);
		}
		pendingIceCandidates = [];

		const answer = await peerConnection.createAnswer();
		await peerConnection.setLocalDescription(answer);

		await createCallSignal({
			callId,
			from: localUsername,
			to: remoteUser,
			type: 'answer',
			data: { sdp: answer.sdp, type: answer.type },
			status: 'active',
		});

		await updateCallSignalStatus(incomingSignal.id, 'active');

		// Use the offer's createdAt so we pick up ICE candidates the caller
		// sent between creating the offer and us accepting the call.
		lastSignalTimestamp = incomingSignal.createdAt;
		startSignalingPoll();
	} catch {
		cleanup();
	}
}

export async function declineCall() {
	if (!incomingSignal) return;

	try {
		await updateCallSignalStatus(incomingSignal.id, 'ended');
		await createCallSignal({
			callId,
			from: localUsername,
			to: remoteUser,
			type: 'hangup',
			data: null,
			status: 'ended',
		});
	} catch {
		// silent fail
	}
	cleanup();
}

export async function hangUp() {
	try {
		if (offerSignalId) {
			await updateCallSignalStatus(offerSignalId, 'ended');
		}
		await createCallSignal({
			callId,
			from: localUsername,
			to: remoteUser,
			type: 'hangup',
			data: null,
			status: 'ended',
		});
	} catch {
		// silent fail
	}
	cleanup();
}

export function toggleMute() {
	if (!localStream) return;
	const audioTrack = localStream.getAudioTracks()[0];
	if (audioTrack) {
		audioTrack.enabled = !audioTrack.enabled;
		isMuted = !audioTrack.enabled;
	}
}

function setupPeerConnectionHandlers() {
	if (!peerConnection) return;

	peerConnection.onicecandidate = async (event) => {
		if (event.candidate) {
			try {
				await createCallSignal({
					callId,
					from: localUsername,
					to: remoteUser,
					type: 'ice-candidate',
					data: {
						candidate: event.candidate.candidate,
						sdpMid: event.candidate.sdpMid,
						sdpMLineIndex: event.candidate.sdpMLineIndex,
					},
				});
			} catch {
				// silent fail
			}
		}
	};

	peerConnection.ontrack = (event) => {
		if (event.streams[0]) {
			remoteStream = event.streams[0];
			if (remoteAudioEl) {
				remoteAudioEl.srcObject = remoteStream;
			}
		}
	};

	peerConnection.onconnectionstatechange = () => {
		if (
			peerConnection?.connectionState === 'disconnected' ||
			peerConnection?.connectionState === 'failed'
		) {
			cleanup();
		}
	};
}

function startSignalingPoll() {
	if (signalingPollTimer) clearInterval(signalingPollTimer);
	signalingPollTimer = setInterval(pollForSignals, 1000);
}

async function pollForSignals() {
	if (!callId) return;

	try {
		const res = await getNewCallSignals(callId, lastSignalTimestamp);
		for (const signal of res.docs) {
			if (signal.from === localUsername) continue;

			if (signal.type === 'answer' && peerConnection) {
				const answerData = signal.data as { sdp: string; type: RTCSdpType };
				await peerConnection.setRemoteDescription(
					new RTCSessionDescription({ sdp: answerData.sdp, type: answerData.type })
				);
				stopRingtone();
				callState = 'active';

				// Flush any ICE candidates that arrived before the answer
				for (const candidate of pendingIceCandidates) {
					await peerConnection.addIceCandidate(candidate);
				}
				pendingIceCandidates = [];
			} else if (signal.type === 'ice-candidate' && peerConnection) {
				const candidateData = signal.data as {
					candidate: string;
					sdpMid: string | null;
					sdpMLineIndex: number | null;
				};
				const candidate = new RTCIceCandidate({
					candidate: candidateData.candidate,
					sdpMid: candidateData.sdpMid,
					sdpMLineIndex: candidateData.sdpMLineIndex,
				});

				if (peerConnection.remoteDescription) {
					await peerConnection.addIceCandidate(candidate);
				} else {
					pendingIceCandidates.push(candidate);
				}
			} else if (signal.type === 'hangup') {
				cleanup();
				return;
			}
		}

		if (res.docs.length > 0) {
			lastSignalTimestamp = res.docs[res.docs.length - 1].createdAt;
		}
	} catch {
		// silent fail
	}
}

function cleanup() {
	stopRingtone();

	if (signalingPollTimer) {
		clearInterval(signalingPollTimer);
		signalingPollTimer = null;
	}

	if (peerConnection) {
		peerConnection.close();
		peerConnection = null;
	}

	if (localStream) {
		localStream.getTracks().forEach((track) => track.stop());
		localStream = null;
	}

	if (remoteAudioEl) {
		remoteAudioEl.srcObject = null;
	}
	remoteStream = null;

	callState = 'idle';
	remoteUser = '';
	isMuted = false;
	callId = '';
	offerSignalId = null;
	incomingSignal = null;
	lastSignalTimestamp = '';
	pendingIceCandidates = [];
}
