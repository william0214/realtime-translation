# 參數名稱對照表

## 錯誤 → 正確對照

### 模型相關
| 錯誤名稱 | 正確名稱 | 位置 |
|---------|---------|------|
| `ASR_MODEL_ALLOWLIST` | `ALLOWED_ASR_MODELS` | shared/config.ts line 18 |
| `TRANSLATION_MODEL_ALLOWLIST` | `ALLOWED_TRANSLATION_MODELS` | shared/config.ts line 36 |

### VAD 參數（常數）
| 錯誤名稱 | 正確名稱 | 位置 |
|---------|---------|------|
| `VAD_START_FRAMES` | `vadStartFrames` | ASR_MODE_CONFIG.normal/precise |
| `VAD_END_FRAMES` | `vadEndFrames` | ASR_MODE_CONFIG.normal/precise |
| `minSpeechMs` | `minSpeechDurationMs` | ASR_MODE_CONFIG.normal/precise |

## 需要修正的文件

### 1. docs/realtime-subtitle-translation-spec.md
- Line 534: `ASR_MODEL_ALLOWLIST` → `ALLOWED_ASR_MODELS`
- Line 540: `ASR_MODEL_ALLOWLIST` → `ALLOWED_ASR_MODELS`
- Line 1298-1299: `ASR_MODEL_ALLOWLIST` → `ALLOWED_ASR_MODELS`
- Line 1323-1324: `ASR_MODEL_ALLOWLIST` → `ALLOWED_ASR_MODELS`
- Line 1348-1349: `ASR_MODEL_ALLOWLIST` → `ALLOWED_ASR_MODELS`

### 2. docs/AUTOMATED_DOCUMENTATION_CHECK_DESIGN.md
- Line 288: `ASR_MODEL_ALLOWLIST` 和 `TRANSLATION_MODEL_ALLOWLIST` → `ALLOWED_ASR_MODELS` 和 `ALLOWED_TRANSLATION_MODELS`

### 3. docs/MEDICAL_COMPLIANCE_AUDIT.md
- Line 267: `VAD_START_FRAMES` → `vadStartFrames`（需要從 ASR_MODE_CONFIG 讀取）
- Line 274: `VAD_END_FRAMES` → `vadEndFrames`（需要從 ASR_MODE_CONFIG 讀取）

### 4. docs/BUG_FIX_REPORT_v1.5.2.md
- Line 364: `minSpeechMs` → `minSpeechDurationMs`

## 正確的參數引用方式

### ASR 模型
```typescript
// ✅ 正確
import { ALLOWED_ASR_MODELS } from '@/shared/config';

// ❌ 錯誤
import { ASR_MODEL_ALLOWLIST } from '@/shared/config';
```

### 翻譯模型
```typescript
// ✅ 正確
import { ALLOWED_TRANSLATION_MODELS } from '@/shared/config';

// ❌ 錯誤
import { TRANSLATION_MODEL_ALLOWLIST } from '@/shared/config';
```

### VAD 參數
```typescript
// ✅ 正確
import { getASRModeConfig } from '@/shared/config';
const config = getASRModeConfig('normal');
const startFrames = config.vadStartFrames;
const endFrames = config.vadEndFrames;
const minSpeech = config.minSpeechDurationMs;

// ❌ 錯誤
const startFrames = VAD_START_FRAMES;
const endFrames = VAD_END_FRAMES;
const minSpeech = minSpeechMs;
```
