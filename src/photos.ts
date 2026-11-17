import { validateFile } from "./domain";
/** Re-encode photos locally. Documents are never resampled; no remote image service. */
export async function optimizePhoto(
  file: File,
  category: string,
): Promise<File> {
  validateFile(file);
  if (
    !file.type.startsWith("image/") ||
    [
      "Prescription",
      "Sick-leave certificate",
      "Submission proof",
      "Report",
    ].includes(category)
  )
    return file;
  const bitmap = await createImageBitmap(file);
  try {
    const scale = Math.min(1, 3200 / Math.max(bitmap.width, bitmap.height));
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(bitmap.width * scale);
    canvas.height = Math.round(bitmap.height * scale);
    const ctx = canvas.getContext("2d");
    if (!ctx) return file;
    ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    const blob = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob(
        resolve,
        file.type === "image/png" ? "image/png" : "image/jpeg",
        0.94,
      ),
    );
    if (!blob || blob.size >= file.size) return file;
    return new File(
      [blob],
      file.name.replace(
        /\.[^.]+$/,
        blob.type === "image/png" ? ".png" : ".jpg",
      ),
      { type: blob.type, lastModified: file.lastModified },
    );
  } finally {
    bitmap.close();
  }
}
