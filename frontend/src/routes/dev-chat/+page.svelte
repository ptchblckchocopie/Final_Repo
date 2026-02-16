<script lang="ts">
	import { onMount, tick } from 'svelte';
	import { getMessages, sendMessage } from '$lib/api/messages';
	import { showToast } from '$lib/stores/toast.svelte';
	import {
		getCallState,
		getRemoteUser,
		getIsMuted,
		getIncomingSignal,
		initCallSystem,
		destroyCallSystem,
		startCall,
		acceptCall,
		declineCall,
		hangUp,
		toggleMute,
		setRemoteAudioElement,
	} from '$lib/stores/call.svelte';
	import { getIsDark } from '$lib/stores/theme.svelte';
	import ThemeToggle from '$lib/components/ui/ThemeToggle.svelte';
	import type { PayloadMessage } from '$lib/types/payload';

	let username = $state('');
	let usernameInput = $state('');
	let messages = $state<PayloadMessage[]>([]);
	let newMessage = $state('');
	let loading = $state(true);
	let sending = $state(false);
	let pollInterval = $state<ReturnType<typeof setInterval> | null>(null);
	let messageContainer = $state<HTMLDivElement>(undefined!);

	let showCallDialog = $state(false);
	let callTargetInput = $state('');
	let remoteAudioEl = $state<HTMLAudioElement>(undefined!);

	let currentCallState = $derived(getCallState());
	let currentRemoteUser = $derived(getRemoteUser());
	let currentIsMuted = $derived(getIsMuted());
	let currentIncomingSignal = $derived(getIncomingSignal());
	const isDark = $derived(getIsDark());

	onMount(() => {
		const stored = localStorage.getItem('dev-chat-username');
		if (stored) {
			username = stored;
			startChat();
		}
		return () => {
			if (pollInterval) clearInterval(pollInterval);
			destroyCallSystem();
		};
	});

	$effect(() => {
		if (remoteAudioEl) {
			setRemoteAudioElement(remoteAudioEl);
		}
	});

	function joinChat(e: SubmitEvent) {
		e.preventDefault();
		const trimmed = usernameInput.trim();
		if (!trimmed) return;
		username = trimmed;
		localStorage.setItem('dev-chat-username', trimmed);
		startChat();
	}

	function changeUsername() {
		if (pollInterval) clearInterval(pollInterval);
		pollInterval = null;
		destroyCallSystem();
		localStorage.removeItem('dev-chat-username');
		username = '';
		usernameInput = '';
		messages = [];
		loading = true;
	}

	async function fetchMessages() {
		try {
			const res = await getMessages({ limit: 100, sort: 'createdAt' });
			messages = res.docs;
		} catch {
			// Silent fail on poll errors to avoid toast spam
		} finally {
			loading = false;
		}
	}

	function startChat() {
		fetchMessages().then(() => scrollToBottom());
		pollInterval = setInterval(async () => {
			const prevCount = messages.length;
			await fetchMessages();
			if (messages.length > prevCount) {
				scrollToBottom();
			}
		}, 3000);
		initCallSystem(username);
	}

	function openCallDialog() {
		callTargetInput = '';
		showCallDialog = true;
	}

	function handleStartCall(e: SubmitEvent) {
		e.preventDefault();
		const target = callTargetInput.trim();
		if (!target) return;
		showCallDialog = false;
		startCall(target);
	}

	async function scrollToBottom() {
		await tick();
		if (messageContainer) {
			messageContainer.scrollTop = messageContainer.scrollHeight;
		}
	}

	async function handleSend(e: SubmitEvent) {
		e.preventDefault();
		const trimmed = newMessage.trim();
		if (!trimmed || sending) return;

		sending = true;
		try {
			await sendMessage(username, trimmed);
			newMessage = '';
			await fetchMessages();
			scrollToBottom();
		} catch {
			showToast('error', 'Failed to send', 'Could not send your message. Please try again.');
		} finally {
			sending = false;
		}
	}

	function formatTime(dateStr: string): string {
		const date = new Date(dateStr);
		const now = new Date();
		const isToday = date.toDateString() === now.toDateString();

		if (isToday) {
			return date.toLocaleTimeString('en-US', {
				hour: 'numeric',
				minute: '2-digit',
				hour12: true
			});
		}
		return date.toLocaleDateString('en-US', {
			month: 'short',
			day: 'numeric',
			hour: 'numeric',
			minute: '2-digit',
			hour12: true
		});
	}
</script>

<svelte:head>
	<title>Dev Chat - Veent</title>
</svelte:head>

<div class:dark={isDark}>
{#if !username}
	<!-- USERNAME ENTRY SCREEN -->
	<section class="relative overflow-hidden bg-slate-900 py-24 text-white">
		<div
			class="absolute inset-0 bg-gradient-to-br from-indigo-600/15 via-transparent to-purple-600/10"
		></div>
		<div class="relative mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
			<div class="mx-auto max-w-3xl text-center">
				<p class="mb-4 text-sm font-semibold uppercase tracking-wider text-indigo-400">
					Community
				</p>
				<h1 class="text-4xl font-extrabold tracking-tight sm:text-5xl">Dev Chat</h1>
				<p class="mt-6 text-lg leading-relaxed text-gray-400">
					A space for developers to collaborate and discuss in real time.
				</p>
			</div>
		</div>
	</section>

	<section class="bg-white dark:bg-gray-900 py-20">
		<div class="mx-auto max-w-md px-4 sm:px-6 lg:px-8">
			<div class="rounded-2xl border border-gray-100 dark:border-gray-700 bg-white dark:bg-gray-800 p-8 shadow-sm">
				<!-- Theme toggle in corner -->
				<div class="flex justify-end -mt-2 -mr-2 mb-2">
					<ThemeToggle />
				</div>

				<div
					class="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-indigo-500 to-purple-600 shadow-lg shadow-indigo-500/25"
				>
					<svg
						class="h-8 w-8 text-white"
						fill="none"
						viewBox="0 0 24 24"
						stroke="currentColor"
						stroke-width="1.5"
					>
						<path
							stroke-linecap="round"
							stroke-linejoin="round"
							d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"
						/>
					</svg>
				</div>

				<h2 class="text-center text-xl font-bold text-gray-900 dark:text-gray-100">Join the conversation</h2>
				<p class="mt-2 text-center text-sm text-gray-500 dark:text-gray-400">
					Choose a display name to get started
				</p>

				<form onsubmit={joinChat} class="mt-6">
					<label for="username" class="mb-2 block text-sm font-medium text-gray-700 dark:text-gray-300"
						>Display Name</label
					>
					<input
						id="username"
						type="text"
						bind:value={usernameInput}
						required
						maxlength={50}
						class="w-full rounded-xl border border-gray-200 dark:border-gray-600 bg-gray-50 dark:bg-gray-700 px-4 py-3 text-gray-900 dark:text-gray-100 transition-all focus:border-indigo-500 focus:bg-white dark:focus:bg-gray-600 focus:ring-2 focus:ring-indigo-500/20 focus:outline-none"
						placeholder="Enter your name"
					/>
					<button
						type="submit"
						class="group mt-4 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-indigo-600 to-indigo-500 px-6 py-3.5 text-sm font-semibold text-white shadow-lg shadow-indigo-600/25 transition-all hover:shadow-xl hover:shadow-indigo-600/30 hover:brightness-110"
					>
						Join Chat
						<svg
							class="h-4 w-4 transition-transform group-hover:translate-x-0.5"
							fill="none"
							viewBox="0 0 24 24"
							stroke="currentColor"
							stroke-width="2"
						>
							<path
								stroke-linecap="round"
								stroke-linejoin="round"
								d="M13 7l5 5m0 0l-5 5m5-5H6"
							/>
						</svg>
					</button>
				</form>
			</div>
		</div>
	</section>
{:else}
	<!-- CHAT INTERFACE -->
	<section class="flex h-[calc(100vh-4rem)] flex-col bg-gray-50 dark:bg-gray-900">
		<!-- Chat header -->
		<div class="border-b border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 px-6 py-4 shadow-sm">
			<div class="mx-auto flex max-w-4xl items-center justify-between">
				<div class="flex items-center gap-3">
					<div
						class="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-indigo-500 to-purple-600 shadow-md"
					>
						<svg
							class="h-5 w-5 text-white"
							fill="none"
							viewBox="0 0 24 24"
							stroke="currentColor"
							stroke-width="1.5"
						>
							<path
								stroke-linecap="round"
								stroke-linejoin="round"
								d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"
							/>
						</svg>
					</div>
					<div>
						<h1 class="text-lg font-bold text-gray-900 dark:text-gray-100">Dev Chat</h1>
						<p class="text-xs text-gray-500 dark:text-gray-400">
							Logged in as <span class="font-semibold text-indigo-600 dark:text-indigo-400">{username}</span>
						</p>
					</div>
				</div>
				<div class="flex items-center gap-2">
					{#if currentCallState === 'idle'}
						<ThemeToggle />
						<button
							onclick={openCallDialog}
							class="cursor-pointer rounded-lg bg-green-500 px-3 py-1.5 text-sm font-medium text-white transition-colors hover:bg-green-600"
						>
							Call
						</button>
						<button
							onclick={changeUsername}
							class="cursor-pointer rounded-lg px-3 py-1.5 text-sm font-medium text-gray-500 dark:text-gray-400 transition-colors hover:bg-gray-100 dark:hover:bg-gray-700 hover:text-gray-700 dark:hover:text-gray-200"
						>
							Change Name
						</button>
					{:else if currentCallState === 'calling'}
						<span class="text-sm text-gray-500 dark:text-gray-400">Calling {currentRemoteUser}...</span>
						<button
							onclick={hangUp}
							class="cursor-pointer rounded-lg bg-red-500 px-3 py-1.5 text-sm font-medium text-white transition-colors hover:bg-red-600"
						>
							Cancel
						</button>
					{:else if currentCallState === 'active'}
						<span class="text-sm font-medium text-green-600 dark:text-green-400">In call with {currentRemoteUser}</span>
						<button
							onclick={toggleMute}
							class="cursor-pointer rounded-lg px-3 py-1.5 text-sm font-medium transition-colors {currentIsMuted ? 'bg-yellow-100 dark:bg-yellow-900/40 text-yellow-700 dark:text-yellow-300 hover:bg-yellow-200 dark:hover:bg-yellow-900/60' : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-200 hover:bg-gray-200 dark:hover:bg-gray-600'}"
						>
							{currentIsMuted ? 'Unmute' : 'Mute'}
						</button>
						<button
							onclick={hangUp}
							class="cursor-pointer rounded-lg bg-red-500 px-3 py-1.5 text-sm font-medium text-white transition-colors hover:bg-red-600"
						>
							Hang Up
						</button>
					{/if}
				</div>
			</div>
		</div>

		<!-- Messages area -->
		<div bind:this={messageContainer} class="flex-1 overflow-y-auto px-4 py-6">
			<div class="mx-auto max-w-4xl space-y-4">
				{#if loading}
					<div class="flex justify-center py-12">
						<div
							class="h-10 w-10 animate-spin rounded-full border-4 border-indigo-200 dark:border-indigo-800 border-t-indigo-600"
						></div>
					</div>
				{:else if messages.length === 0}
					<div
						class="rounded-2xl border-2 border-dashed border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-16 text-center"
					>
						<svg
							class="mx-auto h-12 w-12 text-gray-300 dark:text-gray-600"
							fill="none"
							viewBox="0 0 24 24"
							stroke="currentColor"
							stroke-width="1"
						>
							<path
								stroke-linecap="round"
								stroke-linejoin="round"
								d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"
							/>
						</svg>
						<p class="mt-4 text-gray-500 dark:text-gray-400">No messages yet. Be the first to say something!</p>
					</div>
				{:else}
					{#each messages as message (message.id)}
						{@const isOwn = message.sender === username}
						<div class="flex {isOwn ? 'justify-end' : 'justify-start'}">
							<div class="max-w-[75%]">
								{#if !isOwn}
									<p class="mb-1 ml-3 text-xs font-semibold text-gray-500 dark:text-gray-400">
										{message.sender}
									</p>
								{/if}
								<div
									class="rounded-2xl px-4 py-3 shadow-sm {isOwn
										? 'bg-gradient-to-r from-indigo-600 to-indigo-500 text-white'
										: 'border border-gray-100 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100'}"
								>
									<p class="whitespace-pre-wrap text-sm leading-relaxed">
										{message.content}
									</p>
								</div>
								<p
									class="mt-1 text-xs text-gray-400 dark:text-gray-500 {isOwn
										? 'mr-3 text-right'
										: 'ml-3'}"
								>
									{formatTime(message.createdAt)}
								</p>
							</div>
						</div>
					{/each}
				{/if}
			</div>
		</div>

		<!-- Message input -->
		<div class="border-t border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 px-4 py-4">
			<form onsubmit={handleSend} class="mx-auto flex max-w-4xl gap-3">
				<input
					type="text"
					bind:value={newMessage}
					placeholder="Type a message..."
					maxlength={1000}
					class="flex-1 rounded-xl border border-gray-200 dark:border-gray-600 bg-gray-50 dark:bg-gray-700 px-4 py-3 text-gray-900 dark:text-gray-100 transition-all focus:border-indigo-500 focus:bg-white dark:focus:bg-gray-600 focus:ring-2 focus:ring-indigo-500/20 focus:outline-none"
				/>
				<button
					type="submit"
					disabled={sending || !newMessage.trim()}
					class="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-indigo-600 to-indigo-500 px-6 py-3 text-sm font-semibold text-white shadow-lg shadow-indigo-600/25 transition-all hover:shadow-xl hover:shadow-indigo-600/30 hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-50"
				>
					{#if sending}
						<svg class="h-4 w-4 animate-spin" fill="none" viewBox="0 0 24 24">
							<circle
								class="opacity-25"
								cx="12"
								cy="12"
								r="10"
								stroke="currentColor"
								stroke-width="4"
							></circle>
							<path
								class="opacity-75"
								fill="currentColor"
								d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
							></path>
						</svg>
					{:else}
						<svg
							class="h-4 w-4"
							fill="none"
							viewBox="0 0 24 24"
							stroke="currentColor"
							stroke-width="2"
						>
							<path
								stroke-linecap="round"
								stroke-linejoin="round"
								d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8"
							/>
						</svg>
					{/if}
					Send
				</button>
			</form>
		</div>
	</section>

	<!-- Call Dialog Modal -->
	{#if showCallDialog}
		<div class="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
			<div class="mx-4 w-full max-w-sm rounded-2xl bg-white dark:bg-gray-800 p-6 shadow-xl">
				<h3 class="text-lg font-bold text-gray-900 dark:text-gray-100">Start a Voice Call</h3>
				<p class="mt-1 text-sm text-gray-500 dark:text-gray-400">Enter the name of who you want to call</p>
				<form onsubmit={handleStartCall} class="mt-4">
					<input
						type="text"
						bind:value={callTargetInput}
						required
						maxlength={50}
						class="w-full rounded-xl border border-gray-200 dark:border-gray-600 bg-gray-50 dark:bg-gray-700 px-4 py-3 text-gray-900 dark:text-gray-100 transition-all focus:border-indigo-500 focus:bg-white dark:focus:bg-gray-600 focus:ring-2 focus:ring-indigo-500/20 focus:outline-none"
						placeholder="Username to call"
					/>
					<div class="mt-4 flex gap-3">
						<button
							type="button"
							onclick={() => (showCallDialog = false)}
							class="flex-1 cursor-pointer rounded-xl border border-gray-200 dark:border-gray-600 px-4 py-2.5 text-sm font-medium text-gray-700 dark:text-gray-300 transition-colors hover:bg-gray-50 dark:hover:bg-gray-700"
						>
							Cancel
						</button>
						<button
							type="submit"
							disabled={!callTargetInput.trim()}
							class="flex-1 cursor-pointer rounded-xl bg-green-500 px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-green-600 disabled:cursor-not-allowed disabled:opacity-50"
						>
							Call
						</button>
					</div>
				</form>
			</div>
		</div>
	{/if}

	<!-- Incoming Call Modal -->
	{#if currentCallState === 'incoming' && currentIncomingSignal}
		<div class="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
			<div class="mx-4 w-full max-w-sm rounded-2xl bg-white dark:bg-gray-800 p-6 text-center shadow-xl">
				<div class="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-green-100 dark:bg-green-900/40">
					<svg class="h-8 w-8 text-green-600 dark:text-green-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.5">
						<path stroke-linecap="round" stroke-linejoin="round" d="M2.25 6.75c0 8.284 6.716 15 15 15h2.25a2.25 2.25 0 002.25-2.25v-1.372c0-.516-.351-.966-.852-1.091l-4.423-1.106c-.44-.11-.902.055-1.173.417l-.97 1.293c-.282.376-.769.542-1.21.38a12.035 12.035 0 01-7.143-7.143c-.162-.441.004-.928.38-1.21l1.293-.97c.363-.271.527-.734.417-1.173L6.963 3.102a1.125 1.125 0 00-1.091-.852H4.5A2.25 2.25 0 002.25 4.5v2.25z" />
					</svg>
				</div>
				<h3 class="text-lg font-bold text-gray-900 dark:text-gray-100">Incoming Call</h3>
				<p class="mt-1 text-sm text-gray-500 dark:text-gray-400">
					<span class="font-semibold text-indigo-600 dark:text-indigo-400">{currentRemoteUser}</span> is calling you
				</p>
				<div class="mt-6 flex gap-3">
					<button
						onclick={declineCall}
						class="flex-1 cursor-pointer rounded-xl bg-red-500 px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-red-600"
					>
						Decline
					</button>
					<button
						onclick={acceptCall}
						class="flex-1 cursor-pointer rounded-xl bg-green-500 px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-green-600"
					>
						Accept
					</button>
				</div>
			</div>
		</div>
	{/if}

	<!-- Hidden audio element for remote audio playbackzzzz -->
	<audio bind:this={remoteAudioEl} autoplay></audio>
{/if}

</div>