<script lang="ts">
	import type { TextElement, HAlign, VAlign } from '$lib/types/ticket';
	import { updateElement } from '$lib/stores/elements.svelte';
	import { pushState } from '$lib/stores/history.svelte';

	interface Props {
		element: TextElement;
	}

	const { element }: Props = $props();

	function update(updates: Partial<TextElement>) {
		pushState();
		updateElement(element.id, updates);
	}

	function updateStyle(updates: Partial<TextElement['styles']>) {
		update({ styles: { ...element.styles, ...updates } });
	}
</script>

<div class="space-y-3">
	<!-- Text Format -->
	<div>
		<label class="mb-1 block text-xs font-medium text-gray-500">Text Format</label>
		<input
			type="text"
			value={element.textFormat}
			onchange={(e) => update({ textFormat: (e.target as HTMLInputElement).value })}
			class="w-full rounded border border-gray-300 px-2 py-1.5 text-xs"
			placeholder="{'{ColumnName}'}"
		/>
	</div>

	<!-- Font Family & Size -->
	<div class="flex gap-2">
		<div class="flex-1">
			<label class="mb-1 block text-xs font-medium text-gray-500">Font</label>
			<select value={element.styles.fontFamily} onchange={(e) => updateStyle({ fontFamily: (e.target as HTMLSelectElement).value })} class="w-full rounded border border-gray-300 px-2 py-1 text-xs">
				<option value="Arial">Arial</option>
				<option value="Helvetica">Helvetica</option>
				<option value="Georgia">Georgia</option>
				<option value="Times New Roman">Times New Roman</option>
				<option value="Courier New">Courier New</option>
				<option value="Verdana">Verdana</option>
				<option value="Trebuchet MS">Trebuchet MS</option>
				<option value="Impact">Impact</option>
			</select>
		</div>
		<div class="w-16">
			<label class="mb-1 block text-xs font-medium text-gray-500">Size</label>
			<input type="number" value={element.styles.fontSize} onchange={(e) => updateStyle({ fontSize: parseInt((e.target as HTMLInputElement).value) || 16 })} min="6" max="300" class="w-full rounded border border-gray-300 px-2 py-1 text-xs" />
		</div>
	</div>

	<!-- Style Toggles (Bold, Italic, Underline) -->
	<div>
		<label class="mb-1 block text-xs font-medium text-gray-500">Style</label>
		<div class="flex gap-1">
			<button
				onclick={() => updateStyle({ fontBold: !element.styles.fontBold })}
				class="cursor-pointer rounded border px-3 py-1.5 text-xs font-bold {element.styles.fontBold ? 'border-indigo-400 bg-indigo-100 text-indigo-800' : 'border-gray-300 text-gray-500 hover:bg-gray-50'}"
			>B</button>
			<button
				onclick={() => updateStyle({ fontItalic: !element.styles.fontItalic })}
				class="cursor-pointer rounded border px-3 py-1.5 text-xs italic {element.styles.fontItalic ? 'border-indigo-400 bg-indigo-100 text-indigo-800' : 'border-gray-300 text-gray-500 hover:bg-gray-50'}"
			>I</button>
			<button
				onclick={() => updateStyle({ fontUnderline: !element.styles.fontUnderline })}
				class="cursor-pointer rounded border px-3 py-1.5 text-xs underline {element.styles.fontUnderline ? 'border-indigo-400 bg-indigo-100 text-indigo-800' : 'border-gray-300 text-gray-500 hover:bg-gray-50'}"
			>U</button>
		</div>
	</div>

	<!-- Color & Background Color -->
	<div class="flex gap-2">
		<div class="flex-1">
			<label class="mb-1 block text-xs font-medium text-gray-500">Text Color</label>
			<input type="color" value={element.styles.color} onchange={(e) => updateStyle({ color: (e.target as HTMLInputElement).value })} class="h-8 w-full cursor-pointer rounded border-0" />
		</div>
		<div class="flex-1">
			<label class="mb-1 block text-xs font-medium text-gray-500">BG Color</label>
			<div class="flex items-center gap-1">
				<input type="color" value={element.styles.backgroundColor || '#ffffff'} onchange={(e) => updateStyle({ backgroundColor: (e.target as HTMLInputElement).value })} class="h-8 flex-1 cursor-pointer rounded border-0" />
				{#if element.styles.backgroundColor}
					<button onclick={() => updateStyle({ backgroundColor: '' })} class="cursor-pointer rounded px-1.5 py-1 text-xs text-red-500 hover:bg-red-50" title="Clear background">&#10005;</button>
				{/if}
			</div>
		</div>
	</div>

	<!-- Opacity -->
	<div>
		<label class="mb-1 block text-xs font-medium text-gray-500">Opacity ({Math.round((element.styles.opacity ?? 1) * 100)}%)</label>
		<input type="range" min="0" max="1" step="0.05" value={element.styles.opacity ?? 1} oninput={(e) => updateStyle({ opacity: parseFloat((e.target as HTMLInputElement).value) })} class="w-full" />
	</div>

	<!-- Alignment -->
	<div class="flex gap-2">
		<div class="flex-1">
			<label class="mb-1 block text-xs font-medium text-gray-500">H-Align</label>
			<div class="flex rounded border border-gray-300">
				{#each [['left', '⬅'], ['center', '⬆'], ['right', '➡']] as [val, icon]}
					<button
						onclick={() => updateStyle({ horizontalAlign: val as HAlign })}
						class="flex-1 cursor-pointer py-1 text-xs {element.styles.horizontalAlign === val ? 'bg-indigo-100 text-indigo-700' : 'text-gray-500 hover:bg-gray-50'}"
					>{icon}</button>
				{/each}
			</div>
		</div>
		<div class="flex-1">
			<label class="mb-1 block text-xs font-medium text-gray-500">V-Align</label>
			<div class="flex rounded border border-gray-300">
				{#each [['top', 'T'], ['center', 'M'], ['bottom', 'B']] as [val, icon]}
					<button
						onclick={() => updateStyle({ verticalAlign: val as VAlign })}
						class="flex-1 cursor-pointer py-1 text-xs {element.styles.verticalAlign === val ? 'bg-indigo-100 text-indigo-700' : 'text-gray-500 hover:bg-gray-50'}"
					>{icon}</button>
				{/each}
			</div>
		</div>
	</div>

	<!-- Rotation -->
	<div>
		<label class="mb-1 block text-xs font-medium text-gray-500">Rotation ({element.rotation}°)</label>
		<input type="range" min="0" max="359" value={element.rotation} oninput={(e) => update({ rotation: parseInt((e.target as HTMLInputElement).value) })} class="w-full" />
	</div>

	<!-- Size -->
	<div class="flex gap-2">
		<div class="flex-1">
			<label class="mb-1 block text-xs font-medium text-gray-500">Width</label>
			<input type="number" value={element.size.width} onchange={(e) => update({ size: { ...element.size, width: Math.max(20, parseInt((e.target as HTMLInputElement).value) || 150) } })} min="20" class="w-full rounded border border-gray-300 px-2 py-1 text-xs" />
		</div>
		<div class="flex-1">
			<label class="mb-1 block text-xs font-medium text-gray-500">Height</label>
			<input type="number" value={element.size.height} onchange={(e) => update({ size: { ...element.size, height: Math.max(10, parseInt((e.target as HTMLInputElement).value) || 30) } })} min="10" class="w-full rounded border border-gray-300 px-2 py-1 text-xs" />
		</div>
	</div>

	<!-- Position -->
	<div class="flex gap-2">
		<div class="flex-1">
			<label class="mb-1 block text-xs font-medium text-gray-500">X</label>
			<input type="number" value={Math.round(element.position.x)} onchange={(e) => update({ position: { ...element.position, x: parseInt((e.target as HTMLInputElement).value) || 0 } })} class="w-full rounded border border-gray-300 px-2 py-1 text-xs" />
		</div>
		<div class="flex-1">
			<label class="mb-1 block text-xs font-medium text-gray-500">Y</label>
			<input type="number" value={Math.round(element.position.y)} onchange={(e) => update({ position: { ...element.position, y: parseInt((e.target as HTMLInputElement).value) || 0 } })} class="w-full rounded border border-gray-300 px-2 py-1 text-xs" />
		</div>
	</div>

	<!-- Toggles -->
	<div class="space-y-1.5">
		<label class="flex items-center gap-2 text-xs text-gray-600">
			<input type="checkbox" checked={element.containInBox} onchange={() => update({ containInBox: !element.containInBox })} class="rounded" />
			Contain in box (auto-fit)
		</label>
		<label class="flex items-center gap-2 text-xs text-gray-600">
			<input type="checkbox" checked={element.allowOverflow} onchange={() => update({ allowOverflow: !element.allowOverflow })} class="rounded" />
			Allow overflow
		</label>
		<label class="flex items-center gap-2 text-xs text-gray-600">
			<input type="checkbox" checked={element.disableNewLine} onchange={() => update({ disableNewLine: !element.disableNewLine })} class="rounded" />
			No line breaks
		</label>
	</div>
</div>
