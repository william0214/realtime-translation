import { promises as fs } from "fs";
import { exec } from "child_process";
import { promisify } from "util";
import path from "path";

const execAsync = promisify(exec);

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
 * Merge all chunks in a session and create a complete WebM file using ffmpeg
 * Returns the path to the merged WebM file
 */
export async function mergeSessionChunks(sessionId: string): Promise<string> {
  const chunks = sessionBuffers.get(sessionId);
  if (!chunks || chunks.length === 0) {
    throw new Error(`No chunks found for session: ${sessionId}`);
  }

  console.log(`[chunkBuffer] Merging ${chunks.length} chunks for session: ${sessionId}`);

  const tempDir = "/tmp/webm-chunks";
  await fs.mkdir(tempDir, { recursive: true });

  // Write all chunks to temporary files
  const chunkFiles: string[] = [];
  for (let i = 0; i < chunks.length; i++) {
    const chunkPath = path.join(tempDir, `${sessionId}-chunk-${i}.webm`);
    await fs.writeFile(chunkPath, chunks[i]);
    chunkFiles.push(chunkPath);
  }

  // Create concat file list for ffmpeg
  const concatListPath = path.join(tempDir, `${sessionId}-concat.txt`);
  const concatContent = chunkFiles.map((f) => `file '${f}'`).join("\n");
  await fs.writeFile(concatListPath, concatContent);

  // Output merged file path
  const outputPath = path.join(tempDir, `${sessionId}-merged.webm`);

  try {
    // Use ffmpeg to concatenate chunks
    // -f concat: use concat demuxer
    // -safe 0: allow absolute paths
    // -i: input concat list
    // -c copy: copy streams without re-encoding (fast!)
    const ffmpegCmd = `ffmpeg -f concat -safe 0 -i "${concatListPath}" -c copy "${outputPath}" -y`;
    console.log(`[chunkBuffer] Running ffmpeg: ${ffmpegCmd}`);

    const { stdout, stderr } = await execAsync(ffmpegCmd);
    if (stderr) {
      console.log(`[chunkBuffer] ffmpeg stderr: ${stderr}`);
    }

    // Verify output file exists
    const stats = await fs.stat(outputPath);
    console.log(`[chunkBuffer] Merged file created: ${outputPath}, size: ${stats.size} bytes`);

    // Clean up chunk files
    for (const chunkFile of chunkFiles) {
      await fs.unlink(chunkFile).catch(() => {});
    }
    await fs.unlink(concatListPath).catch(() => {});

    return outputPath;
  } catch (error: any) {
    console.error(`[chunkBuffer] ffmpeg error:`, error);
    throw new Error(`Failed to merge chunks: ${error.message}`);
  }
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
