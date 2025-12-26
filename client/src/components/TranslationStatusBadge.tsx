/**
 * TranslationStatusBadge - 翻譯狀態指示器
 * 
 * 顯示兩段式翻譯的狀態：
 * - provisional + pending: 無顯示（等待 Quality Pass 開始）
 * - provisional + processing: ⏳ 黃色閃爍（Quality Pass 處理中）
 * - provisional + failed: ⚠️ 黃色警告（Quality Pass 失敗，保留 Fast Pass）
 * - final + completed: ✅ 綠色勾勾（Quality Pass 完成）
 * - final + skipped: ✓ 灰色勾勾（短句跳過 Quality Pass）
 */

interface TranslationStatusBadgeProps {
  translationStage?: "provisional" | "final";
  qualityPassStatus?: "pending" | "processing" | "completed" | "failed" | "skipped";
}

export function TranslationStatusBadge({
  translationStage,
  qualityPassStatus,
}: TranslationStatusBadgeProps) {
  // provisional + pending: 不顯示（等待 Quality Pass 開始）
  if (translationStage === "provisional" && qualityPassStatus === "pending") {
    return null;
  }

  // provisional + processing: ⏳ 黃色閃爍（Quality Pass 處理中）
  if (translationStage === "provisional" && qualityPassStatus === "processing") {
    return (
      <span className="ml-2 text-xs text-yellow-400 animate-pulse" title="Quality Pass 處理中">
        ⏳
      </span>
    );
  }

  // provisional + failed: ⚠️ 黃色警告（Quality Pass 失敗，保留 Fast Pass）
  if (translationStage === "provisional" && qualityPassStatus === "failed") {
    return (
      <span className="ml-2 text-xs text-yellow-500" title="Quality Pass 失敗，顯示 Fast Pass 結果">
        ⚠️
      </span>
    );
  }

  // final + completed: ✅ 綠色勾勾（Quality Pass 完成）
  if (translationStage === "final" && qualityPassStatus === "completed") {
    return (
      <span className="ml-2 text-xs text-green-400" title="Quality Pass 完成">
        ✅
      </span>
    );
  }

  // final + skipped: ✓ 灰色勾勾（短句跳過 Quality Pass）
  if (translationStage === "final" && qualityPassStatus === "skipped") {
    return (
      <span className="ml-2 text-xs text-gray-400" title="短句跳過 Quality Pass">
        ✓
      </span>
    );
  }

  // 其他情況：不顯示
  return null;
}
