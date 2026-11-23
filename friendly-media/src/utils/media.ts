import { getDownloadURL, ref, uploadBytes } from 'firebase/storage';
import { storage } from '../lib/firebase';

export const BRAND_ASSETS = {
  heroCommunity: '/src/assets/images/friendly_hero_community_1795414974926.jpg',
  defaultCover: '/src/assets/images/friendly_cover_default_1795414975303.jpg',
  editorialPhoto: '/src/assets/images/friendly_editorial_photo_1795414975726.jpg',
  videoThumb: '/src/assets/images/friendly_video_thumb_1795414975186.jpg',
  brandMark: '/src/assets/images/friendly_brand_mark_1795414975353.jpg',
};

const ALLOWED_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
const ALLOWED_VIDEO_TYPES = ['video/mp4', 'video/webm', 'video/quicktime'];

export async function compressImageToDataUrl(
  file: File,
  maxWidth = 1080,
  quality = 0.78
): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const img = new Image();
      img.onload = () => {
        const scale = Math.min(1, maxWidth / img.width);
        const width = Math.round(img.width * scale);
        const height = Math.round(img.height * scale);
        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          reject(new Error('Canvas context unavailable'));
          return;
        }
        ctx.drawImage(img, 0, 0, width, height);
        resolve(canvas.toDataURL('image/jpeg', quality));
      };
      img.onerror = () => reject(new Error('Failed to decode image'));
      img.src = String(reader.result);
    };
    reader.onerror = () => reject(new Error('Failed to read image file'));
    reader.readAsDataURL(file);
  });
}

export async function uploadImageAsset(
  file: File,
  folder: 'avatars' | 'covers' | 'posts' | 'messages' | 'thumbnails',
  uid: string
): Promise<string> {
  if (!ALLOWED_IMAGE_TYPES.includes(file.type)) {
    throw new Error('Only JPEG, PNG, WEBP, or GIF images are allowed.');
  }
  if (file.size > 10 * 1024 * 1024) {
    throw new Error('Image size must be under 10 MB.');
  }

  const maxWidth = folder === 'avatars' ? 400 : folder === 'thumbnails' ? 720 : 1080;
  const compressedDataUrl = await compressImageToDataUrl(file, maxWidth, 0.78);

  try {
    const res = await fetch(compressedDataUrl);
    const blob = await res.blob();
    const safeName = `${Date.now()}_${Math.random().toString(36).slice(2, 8)}.jpg`;
    const storageRef = ref(storage, `${folder}/${uid}/${safeName}`);
    const snapshot = await uploadBytes(storageRef, blob, { contentType: 'image/jpeg' });
    return await getDownloadURL(snapshot.ref);
  } catch {
    // Graceful compressed inline fallback if Firebase Storage bucket CORS/rules are not yet provisioned
    if (compressedDataUrl.length <= 95000) {
      return compressedDataUrl;
    }
    return await compressImageToDataUrl(file, 640, 0.62);
  }
}

export async function uploadVideoAsset(file: File, uid: string): Promise<string> {
  if (!ALLOWED_VIDEO_TYPES.includes(file.type)) {
    throw new Error('Only MP4, WebM, or MOV video files are supported.');
  }
  if (file.size > 60 * 1024 * 1024) {
    throw new Error('Video file must be under 60 MB.');
  }

  try {
    const ext = file.name.split('.').pop()?.replace(/[^a-z0-9]/gi, '') || 'mp4';
    const safeName = `${Date.now()}_${Math.random().toString(36).slice(2, 8)}.${ext}`;
    const storageRef = ref(storage, `videos/${uid}/${safeName}`);
    const snapshot = await uploadBytes(storageRef, file, { contentType: file.type });
    return await getDownloadURL(snapshot.ref);
  } catch {
    throw new Error(
      'Direct video file upload requires Firebase Storage rules to be enabled in Firebase Console, or you can paste an HTTPS MP4/WebM video URL.'
    );
  }
}
