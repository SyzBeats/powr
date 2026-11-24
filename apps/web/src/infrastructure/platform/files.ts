import type { FileGateway } from '@powr/application';

/**
 * Delivers a file as a download (§6.4). Never Web Share: Chrome does not share .zip or .json
 * (PRD P-04). The save picker for Android (Chrome 132+) follows after device test S-2.
 */
export const downloadGateway: FileGateway = {
  async save({ name, bytes, mime }) {
    downloadBlob(name, new Blob([bytes as Uint8Array<ArrayBuffer>], { type: mime }));
    return 'downloaded';
  },
};

function downloadBlob(name: string, blob: Blob): void {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = name;
  link.rel = 'noopener';
  document.body.append(link);
  link.click();
  link.remove();
  // Give the browser time to start the download before the URL is released.
  setTimeout(() => URL.revokeObjectURL(url), 60_000);
}
