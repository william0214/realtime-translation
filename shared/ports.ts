/**
 * PORT Configuration
 * 
 * Centralized port management to prevent conflicts.
 * See PORTS.md for detailed documentation.
 */

export const PORTS = {
  /**
   * Node.js Frontend + Backend
   * Main web application (Vite + Express + tRPC)
   */
  NODEJS_APP: 3000,

  /**
   * Go Hybrid ASR Service
   * WebSocket real-time speech recognition
   */
  GO_HYBRID_ASR: 8080,

  /**
   * Go REST API Service (DISABLED)
   * REST API for speech translation
   */
  GO_REST_API: 8081,
} as const;

/**
 * Get port from environment variable or use default
 */
export function getPort(service: keyof typeof PORTS): number {
  const envKey = `${service}_PORT`;
  const envValue = process.env[envKey];
  
  if (envValue) {
    const port = parseInt(envValue, 10);
    if (!isNaN(port) && port > 0 && port < 65536) {
      return port;
    }
  }
  
  return PORTS[service];
}

/**
 * Check if a port is in use
 */
export async function isPortInUse(port: number): Promise<boolean> {
  const { exec } = await import('child_process');
  const { promisify } = await import('util');
  const execAsync = promisify(exec);
  
  try {
    const { stdout } = await execAsync(`lsof -i :${port} | grep LISTEN`);
    return stdout.trim().length > 0;
  } catch {
    return false;
  }
}

/**
 * Get available port starting from the given port
 */
export async function getAvailablePort(startPort: number): Promise<number> {
  let port = startPort;
  while (await isPortInUse(port)) {
    port++;
    if (port > 65535) {
      throw new Error('No available port found');
    }
  }
  return port;
}
