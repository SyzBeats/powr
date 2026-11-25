/**
 * Web Share with files (PWA-09, §8.3.7). Chrome's allowlist excludes `.ics`, `.zip` and `.json`
 * (PRD P-04), so sharing is offered only when `navigator.canShare` accepts the actual file at
 * runtime; the download stays the default delivery.
 */
export interface ShareableFile {
  readonly name: string;
  readonly bytes: Uint8Array;
  readonly mime: string;
}

export type ShareOutcome = 'shared' | 'cancelled' | 'failed';

export interface FileShare {
  canShare(file: ShareableFile): boolean;
  share(file: ShareableFile, title: string): Promise<ShareOutcome>;
}

function toFile(file: ShareableFile): File {
  return new File([file.bytes as Uint8Array<ArrayBuffer>], file.name, { type: file.mime });
}

export const fileShare: FileShare = {
  canShare(file) {
    if (typeof navigator.canShare !== 'function' || typeof navigator.share !== 'function') {
      return false;
    }
    try {
      return navigator.canShare({ files: [toFile(file)] });
    } catch {
      return false;
    }
  },
  async share(file, title) {
    try {
      await navigator.share({ files: [toFile(file)], title });
      return 'shared';
    } catch (error) {
      return error instanceof DOMException && error.name === 'AbortError' ? 'cancelled' : 'failed';
    }
  },
};
