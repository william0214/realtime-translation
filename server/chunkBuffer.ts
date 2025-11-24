import { promises as fs } from "fs";
import path from "path";

// Session buffer storage
const sessionBuffers = new Map<string, Buffer[]>();

/**
 * Add a WebM chunk to the session buffer
 */
export function addChunkToSession(sessionId: string, chunkBuffer: Buffer): void {
  if (!sessionBuffers.has(sessionId)) {
    sessionBuffers.set(sessionId, []);
    console.log(`[chunkBuffer] Created new session: ${sessionId}`);
  }

  const chunks = sessionBuffers.get(sessionId)!;
  chunks.push(chunkBuffer);
  console.log(`[chunkBuffer] Added chunk to session ${sessionId}, total chunks: ${chunks.length}, size: ${chunkBuffer.length} bytes`);
}

/**
 * Merge all chunks in a session by concatenating buffers
 * Returns the path to the merged WebM file
 * 
 * Note: This simple concatenation works for WebM chunks from MediaRecorder
 * because they share the same codec and format. For production use, consider
 * using a proper WebM muxer library for better reliability.
 */
export async function mergeSessionChunks(sessionId: string): Promise<string> {
  const chunks = sessionBuffers.get(sessionId);
  if (!chunks || chunks.length === 0) {
    throw new Error(`No chunks found for session: ${sessionId}`);
  }

  console.log(`[chunkBuffer] Merging ${chunks.length} chunks for session: ${sessionId}`);

  // Calculate total size
  const totalSize = chunks.reduce((sum, chunk) => sum + chunk.length, 0);
  console.log(`[chunkBuffer] Total size: ${totalSize} bytes`);

  // Concatenate all chunks into a single buffer
  const mergedBuffer = Buffer.concat(chunks);

  // Write to temporary file
  const tempDir = "/tmp/webm-chunks";
  await fs.mkdir(tempDir, { recursive: true });
  const outputPath = path.join(tempDir, `${sessionId}-merged.webm`);
  await fs.writeFile(outputPath, mergedBuffer);

  console.log(`[chunkBuffer] Merged file created: ${outputPath}, size: ${mergedBuffer.length} bytes`);

  return outputPath;
}

/**
 * Clear session buffer and clean up temporary files
 */
export async function clearSession(sessionId: string): Promise<void> {
  sessionBuffers.delete(sessionId);

  // Clean up any remaining temporary files
  const tempDir = "/tmp/webm-chunks";
  const mergedFile = path.join(tempDir, `${sessionId}-merged.webm`);
  await fs.unlink(mergedFile).catch(() => {});

  console.log(`[chunkBuffer] Cleared session: ${sessionId}`);
}

/**
 * Get session buffer status
 */
export function getSessionStatus(sessionId: string): { exists: boolean; chunkCount: number } {
  const chunks = sessionBuffers.get(sessionId);
  return {
    exists: !!chunks,
    chunkCount: chunks?.length || 0,
  };
}
