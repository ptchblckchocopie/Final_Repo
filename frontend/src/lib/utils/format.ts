/**
 * Replace {columnName} placeholders in a text format string with actual values from row data.
 */
export function formatTextWithData(textFormat: string, data: Record<string, string>): string {
	return textFormat.replace(/\{([^}]+)\}/g, (match, key) => {
		return key in data ? data[key] : match;
	});
}
