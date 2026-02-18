<script lang="ts">
	import { onMount } from 'svelte';
	import TicketGenerator from '$lib/components/ticket/TicketGenerator.svelte';
	import SessionRestoreModal from '$lib/components/ui/SessionRestoreModal.svelte';
	import { beforeNavigate } from '$app/navigation';
	import { getIsDirty } from '$lib/stores/dirty.svelte';
	import {
		checkForPendingSession,
		getPendingSessionTime,
		restoreSession,
		discardSession,
		initAutoSave
	} from '$lib/stores/autosave.svelte';

	let showRestoreModal = $state(false);
	let pendingTime = $state<string | null>(null);

	function handleBeforeUnload(e: BeforeUnloadEvent) {
		if (getIsDirty()) {
			e.preventDefault();
		}
	}

	beforeNavigate(({ cancel }) => {
		if (getIsDirty()) {
			if (!confirm('You have unsaved changes. Leave this page?')) {
				cancel();
			}
		}
	});

	onMount(async () => {
		const hasPending = await checkForPendingSession();
		if (hasPending) {
			pendingTime = getPendingSessionTime();
			showRestoreModal = true;
		} else {
			initAutoSave();
		}
	});

	async function handleRestore() {
		showRestoreModal = false;
		await restoreSession();
		initAutoSave();
	}

	async function handleDiscard() {
		showRestoreModal = false;
		await discardSession();
		initAutoSave();
	}
</script>

<svelte:head>
	<title>Ticket Generator - Veent Tix</title>
</svelte:head>

<svelte:window onbeforeunload={handleBeforeUnload} />

<TicketGenerator />

<SessionRestoreModal
	open={showRestoreModal}
	savedAt={pendingTime}
	onrestore={handleRestore}
	ondiscard={handleDiscard}
/>
