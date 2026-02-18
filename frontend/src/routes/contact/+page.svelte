<script lang="ts">
	import { showToast } from '$lib/stores/toast.svelte';

	let name = $state('');
	let email = $state('');
	let message = $state('');
	let sending = $state(false);

	async function handleSubmit(e: SubmitEvent) {
		e.preventDefault();
		sending = true;

		await new Promise((r) => setTimeout(r, 1000));

		showToast('success', 'Message sent!', "We'll get back to you soon.");
		name = '';
		email = '';
		message = '';
		sending = false;
	}
</script>

<svelte:head>
	<title>Contact Us - Veent Tix</title>
</svelte:head>

<!-- Hero Header -->
<section class="relative overflow-hidden bg-slate-900 py-24 text-white">
	<div class="absolute inset-0 bg-gradient-to-br from-red-600/15 via-transparent to-red-600/10"></div>
	<div class="relative mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
		<div class="mx-auto max-w-3xl text-center">
			<p class="mb-4 text-sm font-semibold uppercase tracking-wider text-red-400">Get in touch</p>
			<h1 class="text-4xl font-extrabold tracking-tight sm:text-5xl">Contact Us</h1>
			<p class="mt-6 text-lg leading-relaxed text-gray-400">
				Have questions or feedback? We'd love to hear from you.
			</p>
		</div>
	</div>
</section>

<!-- Contact Form + Info -->
<section class="bg-white py-20">
	<div class="mx-auto max-w-5xl px-4 sm:px-6 lg:px-8">
		<div class="grid gap-12 lg:grid-cols-5">
			<!-- Form -->
			<div class="lg:col-span-3">
				<div class="rounded-2xl border border-gray-100 bg-white p-8 shadow-sm">
					<h2 class="mb-6 text-xl font-bold text-gray-900">Send us a message</h2>
					<form onsubmit={handleSubmit} class="space-y-5">
						<div>
							<label for="name" class="mb-2 block text-sm font-medium text-gray-700">Name</label>
							<input
								id="name"
								type="text"
								bind:value={name}
								required
								class="w-full rounded-xl border border-gray-200 bg-gray-50 px-4 py-3 text-gray-900 transition-all focus:border-red-500 focus:bg-white focus:ring-2 focus:ring-red-500/20 focus:outline-none"
								placeholder="Your name"
							/>
						</div>

						<div>
							<label for="email" class="mb-2 block text-sm font-medium text-gray-700">Email</label>
							<input
								id="email"
								type="email"
								bind:value={email}
								required
								class="w-full rounded-xl border border-gray-200 bg-gray-50 px-4 py-3 text-gray-900 transition-all focus:border-red-500 focus:bg-white focus:ring-2 focus:ring-red-500/20 focus:outline-none"
								placeholder="you@example.com"
							/>
						</div>

						<div>
							<label for="message" class="mb-2 block text-sm font-medium text-gray-700">Message</label>
							<textarea
								id="message"
								bind:value={message}
								required
								rows="5"
								class="w-full resize-none rounded-xl border border-gray-200 bg-gray-50 px-4 py-3 text-gray-900 transition-all focus:border-red-500 focus:bg-white focus:ring-2 focus:ring-red-500/20 focus:outline-none"
								placeholder="How can we help you?"
							></textarea>
						</div>

						<button
							type="submit"
							disabled={sending}
							class="group inline-flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-red-600 to-red-500 px-6 py-3.5 text-sm font-semibold text-white shadow-lg shadow-red-600/25 transition-all hover:shadow-xl hover:shadow-red-600/30 hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-50"
						>
							{#if sending}
								<svg class="h-4 w-4 animate-spin" fill="none" viewBox="0 0 24 24">
									<circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
									<path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
								</svg>
								Sending...
							{:else}
								Send Message
								<svg class="h-4 w-4 transition-transform group-hover:translate-x-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
									<path stroke-linecap="round" stroke-linejoin="round" d="M13 7l5 5m0 0l-5 5m5-5H6" />
								</svg>
							{/if}
						</button>
					</form>
				</div>
			</div>

			<!-- Contact Info -->
			<div class="space-y-6 lg:col-span-2">
				{#each [
					{
						icon: 'M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z',
						label: 'Email',
						value: 'hello@veent.app',
						color: 'from-red-500 to-red-600'
					},
					{
						icon: 'M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z M15 11a3 3 0 11-6 0 3 3 0 016 0z',
						label: 'Location',
						value: 'Philippines',
						color: 'from-red-500 to-red-600'
					},
					{
						icon: 'M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z',
						label: 'Hours',
						value: 'Mon–Fri, 9 AM – 6 PM',
						color: 'from-red-500 to-red-600'
					}
				] as info}
					<div class="group rounded-2xl border border-gray-100 bg-white p-6 shadow-sm transition-all hover:shadow-md">
						<div class="flex items-start gap-4">
							<div class="inline-flex rounded-xl bg-gradient-to-br {info.color} p-3 shadow-lg">
								<svg class="h-5 w-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.5">
									<path stroke-linecap="round" stroke-linejoin="round" d={info.icon} />
								</svg>
							</div>
							<div>
								<p class="text-sm font-semibold text-gray-900">{info.label}</p>
								<p class="mt-1 text-sm text-gray-500">{info.value}</p>
							</div>
						</div>
					</div>
				{/each}

				<!-- Extra CTA card -->
				<div class="rounded-2xl bg-gradient-to-br from-red-600 to-red-600 p-6 text-white shadow-lg">
					<h3 class="font-bold">Need quick help?</h3>
					<p class="mt-2 text-sm leading-relaxed text-red-100">
						Check out our Ticket Generator tool — no sign-up needed.
					</p>
					<a
						href="/ticket-generator"
						class="mt-4 inline-flex items-center gap-1.5 rounded-lg bg-white/20 px-4 py-2 text-sm font-semibold text-white backdrop-blur-sm transition-all hover:bg-white/30"
					>
						Try it now
						<svg class="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
							<path stroke-linecap="round" stroke-linejoin="round" d="M13 7l5 5m0 0l-5 5m5-5H6" />
						</svg>
					</a>
				</div>
			</div>
		</div>
	</div>
</section>
