// Meal photos are shrunk on the phone before they're saved: the longest side
// to MAX_SIDE px, as a JPEG data URL of ~100 KB. That fits in a Firestore doc
// (1 MiB max), and the free 1 GiB of storage holds thousands of them.
const MAX_SIDE = 1000;
const MAX_LENGTH = 700_000; // characters of data URL, well under the doc limit
const QUALITIES = [0.65, 0.5, 0.35];

// A picked image file → { src: JPEG data URL, width, height }. The browser
// applies the camera's rotation (EXIF) when it draws the image.
export async function shrinkPhoto(file) {
  const url = URL.createObjectURL(file);
  try {
    const img = await new Promise((resolve, reject) => {
      const el = new Image();
      el.onload = () => resolve(el);
      el.onerror = () => reject(new Error('unreadable image'));
      el.src = url;
    });
    const scale = Math.min(1, MAX_SIDE / Math.max(img.naturalWidth, img.naturalHeight));
    const canvas = document.createElement('canvas');
    canvas.width = Math.max(1, Math.round(img.naturalWidth * scale));
    canvas.height = Math.max(1, Math.round(img.naturalHeight * scale));
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = '#fff'; // JPEG has no transparency: white, not black
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
    for (const quality of QUALITIES) {
      const src = canvas.toDataURL('image/jpeg', quality);
      if (!src.startsWith('data:image/jpeg')) break; // the browser couldn't encode it
      if (src.length <= MAX_LENGTH) return { src, width: canvas.width, height: canvas.height };
    }
    throw new Error('image too large');
  } finally {
    URL.revokeObjectURL(url);
  }
}
