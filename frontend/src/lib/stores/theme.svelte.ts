let darkMode = $state(false);

// BUG-M1: Wrap localStorage access in try-catch — throws in private browsing / sandboxed iframes
if (typeof window !== 'undefined') {
	try {
		const saved = localStorage.getItem('theme-dark');
		if (saved !== null) {
			darkMode = saved === 'true';
		} else {
			darkMode = window.matchMedia('(prefers-color-scheme: dark)').matches;
		}
	} catch {
		darkMode = window.matchMedia('(prefers-color-scheme: dark)').matches;
	}
}

$effect.root(() => {
	$effect(() => {
		if (typeof window !== 'undefined') {
			try {
				localStorage.setItem('theme-dark', String(darkMode));
			} catch {
				// BUG-M1: localStorage unavailable — skip persistence
			}
		}
	});
});

export function getIsDark(): boolean {
	return darkMode;
}

export function toggleTheme(): void {
	darkMode = !darkMode;
}
