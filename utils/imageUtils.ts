/**
 * Converts a standard Google Drive file sharing link into a direct, embeddable link.
 * @param url The original Google Drive URL (e.g., https://drive.google.com/file/d/FILE_ID/view?usp=sharing)
 * @returns A direct image link (e.g., https://drive.google.com/uc?id=FILE_ID) or the original URL if it's not a valid Google Drive link.
 */
export const convertToDirectGoogleDriveLink = (url: string | undefined): string | undefined => {
  if (!url || typeof url !== 'string') {
    return undefined;
  }

  // Regex to capture the file ID from various Google Drive URL formats
  // Handles /file/d/FILE_ID/ and /open?id=FILE_ID
  const regex = /drive\.google\.com\/(?:file\/d\/|open\?id=)([a-zA-Z0-9_-]+)/;
  const match = url.match(regex);

  if (match && match[1]) {
    const fileId = match[1];
    // This format is generally more reliable for direct embedding
    return `https://drive.google.com/uc?id=${fileId}`;
  }

  // Return the original URL if it doesn't match a known Google Drive pattern
  return url;
};