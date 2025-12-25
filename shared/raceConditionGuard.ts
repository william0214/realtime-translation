/**
 * Race Condition Guard for Quality Pass Translation
 * 
 * Purpose: Prevent stale Quality Pass results from updating UI after:
 * - Conversation has ended
 * - Message has been updated by a newer Quality Pass
 * - Quality Pass has timed out (> 15-20 seconds)
 * 
 * Medical Product Ethics:
 * - MUST NOT update UI after conversation ends (user confusion)
 * - MUST NOT overwrite newer translations with older ones (data integrity)
 * - MUST NOT show delayed results that are no longer relevant (user trust)
 */

/**
 * Generate a unique conversation session key (UUID v4)
 */
export function generateConversationKey(): string {
  return crypto.randomUUID();
}

/**
 * Check if Quality Pass result should be applied
 * 
 * @param messageVersion - The version of the message when Quality Pass was started
 * @param currentVersion - The current version of the message
 * @param conversationKey - The conversation session key when Quality Pass was started
 * @param currentConversationKey - The current conversation session key
 * @param startTime - The timestamp when Quality Pass was started (in ms)
 * @param timeoutMs - The timeout threshold (default: 20000ms = 20 seconds)
 * @returns true if Quality Pass result should be applied, false otherwise
 */
export function shouldApplyQualityPassResult(
  messageVersion: number,
  currentVersion: number,
  conversationKey: string | null,
  currentConversationKey: string | null,
  startTime: number,
  timeoutMs: number = 20000
): boolean {
  // Check 1: Conversation has ended (conversationKey changed or null)
  if (!currentConversationKey || conversationKey !== currentConversationKey) {
    console.log(`[Race Guard] ❌ Conversation ended (${conversationKey} !== ${currentConversationKey}), discarding Quality Pass result`);
    return false;
  }

  // Check 2: Message version mismatch (message has been updated)
  if (messageVersion !== currentVersion) {
    console.log(`[Race Guard] ❌ Message version mismatch (${messageVersion} !== ${currentVersion}), discarding Quality Pass result`);
    return false;
  }

  // Check 3: Quality Pass timeout
  const elapsedTime = Date.now() - startTime;
  if (elapsedTime > timeoutMs) {
    console.log(`[Race Guard] ❌ Quality Pass timeout (${elapsedTime}ms > ${timeoutMs}ms), discarding Quality Pass result`);
    return false;
  }

  // All checks passed
  console.log(`[Race Guard] ✅ Quality Pass result is valid (version: ${messageVersion}, elapsed: ${elapsedTime}ms)`);
  return true;
}

/**
 * Increment message version
 * 
 * @param currentVersion - The current version of the message
 * @returns The new version number
 */
export function incrementMessageVersion(currentVersion: number): number {
  return currentVersion + 1;
}

/**
 * Example usage:
 * 
 * ```typescript
 * // When starting Quality Pass
 * const qualityPassStartTime = Date.now();
 * const originalConversationKey = currentConversationKeyRef.current;
 * const originalMessageVersion = targetMessage.version;
 * 
 * // When Quality Pass completes
 * const targetMessage = conversations.find(msg => msg.id === provisionalMessageId);
 * if (!targetMessage) {
 *   console.log(`[Quality Pass] Message not found, discarding result`);
 *   return;
 * }
 * 
 * if (!shouldApplyQualityPassResult(
 *   originalMessageVersion,
 *   targetMessage.version,
 *   originalConversationKey,
 *   currentConversationKeyRef.current,
 *   qualityPassStartTime,
 *   20000
 * )) {
 *   return; // Discard result
 * }
 * 
 * // Apply Quality Pass result
 * setConversations((prev) =>
 *   prev.map((msg) =>
 *     msg.id === provisionalMessageId
 *       ? {
 *           ...msg,
 *           translatedText: finalTranslation,
 *           translationStage: "final",
 *           qualityPassStatus: "completed",
 *           version: incrementMessageVersion(msg.version),
 *         }
 *       : msg
 *   )
 * );
 * ```
 */
