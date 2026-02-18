<script lang="ts">
	const year = new Date().getFullYear();
</script>

<footer class="bg-slate-900">
	<div class="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8">
		<div class="grid gap-8 sm:grid-cols-3">
			<!-- Brand -->
			<div>
				<a href="/" class="flex items-center gap-2.5">
					<span class="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-red-500 to-red-600 text-xs font-extrabold text-white">V</span>
					<span class="text-lg font-bold text-white">Veent Tix</span>
				</a>
				<p class="mt-3 text-sm leading-relaxed text-gray-500">
					Professional event ticketing tools. Design, generate, and export tickets with ease.
				</p>
			</div>

			<!-- Links -->
			<div>
				<h3 class="mb-4 text-xs font-semibold uppercase tracking-wider text-gray-400">Navigation</h3>
				<div class="space-y-2.5">
					<a href="/" class="block text-sm text-gray-500 transition-colors hover:text-white">Home</a>
					<a href="/about" class="block text-sm text-gray-500 transition-colors hover:text-white">About</a>
					<a href="/contact" class="block text-sm text-gray-500 transition-colors hover:text-white">Contact Us</a>
				</div>
			</div>

			<!-- Tools -->
			<div>
				<h3 class="mb-4 text-xs font-semibold uppercase tracking-wider text-gray-400">Tools</h3>
				<div class="space-y-2.5">
					<a href="/ticket-generator" class="block text-sm text-gray-500 transition-colors hover:text-white">Ticket Generator</a>
					<a href="/dev-chat" class="block text-sm text-gray-500 transition-colors hover:text-white">Dev Chat</a>
				</div>
			</div>
		</div>

		<div class="mt-10 border-t border-white/10 pt-6">
			<p class="text-center text-xs text-gray-600">&copy; {year} Veent Tix. All rights reserved.</p>
		</div>
	</div>
</footer>
