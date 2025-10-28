/**
 * Converts a standard Google Drive file sharing link into a direct, embeddable link.
 * @param url The original Google Drive URL (e.g., https://drive.google.com/file/d/FILE_ID/view?usp=sharing)
 * @returns A direct image link (e.g., https://drive.google.com/uc?id=FILE_ID) or the original URL if it's not a valid Google Drive link.
 */
const extractDriveFileId = (url: string): string | null => {
  try {
    const parsed = new URL(url.trim());

    // Only attempt to coerce known Google Drive hosts
    if (!/\.google\./.test(parsed.hostname) || !parsed.hostname.includes('drive')) {
      return null;
    }

    // Pattern: https://drive.google.com/file/d/FILE_ID/... or /folders/
    const fileIndex = parsed.pathname.split('/').findIndex(segment => segment === 'd');
    if (fileIndex !== -1) {
      const segments = parsed.pathname.split('/');
      const candidate = segments[fileIndex + 1];
      if (candidate) {
        return candidate;
      }
    }

    // Pattern: https://drive.google.com/open?id=FILE_ID or uc?id=FILE_ID
    const searchId = parsed.searchParams.get('id');
    if (searchId) {
      return searchId;
    }

    // Pattern: https://drive.google.com/thumbnail?sz=w320&id=FILE_ID
    const thumbnailId = parsed.searchParams.get('thumbnail');
    if (thumbnailId) {
      return thumbnailId;
    }

    return null;
  } catch {
    return null;
  }
};

export const convertToDirectGoogleDriveLink = (url: string | undefined): string | undefined => {
  if (!url || typeof url !== 'string') {
    return undefined;
  }

  const fileId = extractDriveFileId(url);
  if (!fileId) {
    return url.trim();
  }

  // `export=view` keeps Google Drive from forcing a download prompt in some browsers
  return `https://drive.google.com/uc?export=view&id=${fileId}`;
};
