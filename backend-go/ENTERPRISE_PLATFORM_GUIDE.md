# 企業級多模態翻譯平台指南

## 🎯 平台概述

這是一個為醫療機構設計的企業級多模態翻譯平台，提供完全可插拔的 ASR（語音識別）、Translation（翻譯）、TTS（語音合成）服務，並支援智能路由、自動 failover 和客戶級別的 SLA 管理。

### 核心特色

1. **三層可插拔服務架構**
   - ASR Layer: Manus / OpenAI Whisper / Google Speech-to-Text
   - Translation Layer: OpenAI GPT / Google Translation / Azure Translator / DeepL
   - TTS Layer: OpenAI TTS / Azure TTS / Google TTS

2. **智能路由系統**
   - 優先級路由（Priority）
   - 語言自動切換（Language-based）
   - 成本優化路由（Cost）
   - 延遲優化路由（Latency）
   - 輪詢路由（Round-robin）

3. **Multi-provider Failover**
   - 自動偵測服務失敗
   - 無縫切換到備援服務
   - 健康檢查和狀態監控

4. **客戶方案管理**
   - 醫院級別配置
   - SLA 保證（延遲、可用性、錯誤率）
   - 成本追蹤和預算管理
   - 動態配置熱更新

---

## 📁 專案結構

```
backend-go/
├── internal/
│   └── provider/
│       ├── provider.go              # 核心介面定義
│       ├── asr.go                   # ASR 服務介面
│       ├── translation.go           # Translation 服務介面
│       ├── tts.go                   # TTS 服務介面
│       ├── asr_openai.go            # OpenAI Whisper Provider
│       ├── translation_openai.go    # OpenAI GPT Translation Provider
│       ├── translation_google.go    # Google Translation Provider
│       ├── tts_openai.go            # OpenAI TTS Provider
│       ├── manager.go               # Provider 管理器（路由和 failover）
│       └── config_loader.go         # 配置載入器
├── configs/
│   └── client_plans.example.json   # 客戶方案配置範例
└── ENTERPRISE_PLATFORM_GUIDE.md    # 本文件
```

---

## 🚀 快速開始

### 1. 安裝依賴

```bash
cd backend-go
go mod tidy
```

### 2. 設定環境變數

```bash
export OPENAI_API_KEY="your-openai-api-key"
export GOOGLE_API_KEY="your-google-api-key"
export AZURE_API_KEY="your-azure-api-key"
export DEEPL_API_KEY="your-deepl-api-key"
```

### 3. 建立客戶方案配置

複製範例配置並修改：

```bash
cp configs/client_plans.example.json configs/client_plans.json
```

### 4. 初始化 Provider Manager

```go
package main

import (
    "context"
    "log"
    "your-project/internal/provider"
)

func main() {
    // 載入客戶方案配置
    plans, err := provider.LoadClientPlans("configs/client_plans.json")
    if err != nil {
        log.Fatalf("Failed to load client plans: %v", err)
    }
    
    // 建立 Provider Manager
    manager := provider.NewProviderManager()
    
    // 初始化所有 providers
    if err := provider.InitializeProviders(manager, plans); err != nil {
        log.Fatalf("Failed to initialize providers: %v", err)
    }
    
    log.Println("Provider Manager initialized successfully")
    
    // 使用範例
    ctx := context.Background()
    
    // ASR 範例
    asrReq := provider.ASRRequest{
        AudioData:  audioBytes,
        AudioFormat: "webm",
        SampleRate: 48000,
        Language:   "zh",
        Mode:       provider.ASRModeSegment,
        Context: provider.RequestContext{
            ClientID: "hospital_a",
        },
    }
    
    asrResp, err := manager.Transcribe(ctx, asrReq)
    if err != nil {
        log.Printf("ASR failed: %v", err)
    } else {
        log.Printf("Transcript: %s", asrResp.Transcript)
    }
    
    // Translation 範例
    transReq := provider.TranslationRequest{
        Text:       asrResp.Transcript,
        SourceLang: asrResp.DetectedLanguage,
        TargetLang: "en",
        Context: provider.RequestContext{
            ClientID: "hospital_a",
        },
    }
    
    transResp, err := manager.Translate(ctx, transReq)
    if err != nil {
        log.Printf("Translation failed: %v", err)
    } else {
        log.Printf("Translation: %s", transResp.TranslatedText)
    }
    
    // TTS 範例
    ttsReq := provider.TTSRequest{
        Text:     transResp.TranslatedText,
        Language: transResp.TargetLang,
        Voice:    "alloy",
        Context: provider.RequestContext{
            ClientID: "hospital_a",
        },
    }
    
    ttsResp, err := manager.Synthesize(ctx, ttsReq)
    if err != nil {
        log.Printf("TTS failed: %v", err)
    } else {
        log.Printf("Audio generated: %d bytes", len(ttsResp.AudioData))
    }
}
```

---

## ⚙️ 客戶方案配置

### 配置結構

```json
{
  "client_plans": [
    {
      "client_id": "hospital_a",
      "plan_name": "Premium Hospital Plan",
      "asr_config": { ... },
      "translation_config": { ... },
      "tts_config": { ... },
      "sla": { ... },
      "cost_tracking": { ... }
    }
  ]
}
```

### ASR 配置範例

```json
"asr_config": {
  "service_type": "asr",
  "providers": [
    {
      "type": "openai_asr",
      "enabled": true,
      "priority": 100,
      "max_retries": 2,
      "timeout": "30s",
      "credentials": {
        "api_key": "${OPENAI_API_KEY}"
      },
      "options": {
        "model": "whisper-1"
      }
    },
    {
      "type": "google_asr",
      "enabled": true,
      "priority": 90,
      "max_retries": 2,
      "timeout": "30s",
      "credentials": {
        "api_key": "${GOOGLE_API_KEY}"
      }
    }
  ],
  "failover_strategy": "next",
  "routing_strategy": "priority"
}
```

### Translation 配置範例（語言自動切換）

```json
"translation_config": {
  "service_type": "translation",
  "providers": [
    {
      "type": "openai_translation",
      "enabled": true,
      "priority": 100,
      "max_retries": 2,
      "timeout": "30s",
      "credentials": {
        "api_key": "${OPENAI_API_KEY}"
      },
      "options": {
        "model": "gpt-4o-mini"
      }
    },
    {
      "type": "google_translation",
      "enabled": true,
      "priority": 90,
      "max_retries": 2,
      "timeout": "30s",
      "credentials": {
        "api_key": "${GOOGLE_API_KEY}"
      }
    }
  ],
  "failover_strategy": "next",
  "routing_strategy": "priority",
  "language_providers": {
    "vi": "google_translation",
    "id": "google_translation",
    "th": "google_translation"
  }
}
```

**語言自動切換說明**：
- 越南語（vi）、印尼語（id）、泰語（th）自動使用 Google Translation
- 其他語言使用優先級最高的 OpenAI Translation
- 如果 Google Translation 失敗，會 failover 到 OpenAI Translation

### TTS 配置範例

```json
"tts_config": {
  "service_type": "tts",
  "providers": [
    {
      "type": "openai_tts",
      "enabled": true,
      "priority": 100,
      "max_retries": 2,
      "timeout": "60s",
      "credentials": {
        "api_key": "${OPENAI_API_KEY}"
      },
      "options": {
        "model": "tts-1"
      }
    }
  ],
  "failover_strategy": "next",
  "routing_strategy": "priority"
}
```

### SLA 配置

```json
"sla": {
  "max_latency_ms": 5000,
  "min_availability": 0.99,
  "max_error_rate": 0.01
}
```

- `max_latency_ms`: 最大延遲（毫秒）
- `min_availability`: 最小可用性（0.99 = 99%）
- `max_error_rate`: 最大錯誤率（0.01 = 1%）

### 成本追蹤配置

```json
"cost_tracking": {
  "enabled": true,
  "monthly_budget": 1000.0,
  "alert_threshold": 0.8
}
```

- `enabled`: 是否啟用成本追蹤
- `monthly_budget`: 每月預算（美元）
- `alert_threshold`: 警告閾值（0.8 = 80%）

---

## 🔀 路由策略

### 1. Priority（優先級）

根據 provider 的 `priority` 欄位選擇，數值越高優先級越高。

```json
"routing_strategy": "priority"
```

### 2. Language（語言）

根據目標語言自動選擇最佳 provider。

```json
"routing_strategy": "language",
"language_providers": {
  "vi": "google_translation",
  "id": "google_translation"
}
```

### 3. Cost（成本）

選擇成本最低的 provider。

```json
"routing_strategy": "cost"
```

### 4. Latency（延遲）

選擇平均延遲最低的 provider（基於歷史數據）。

```json
"routing_strategy": "latency"
```

### 5. Round-robin（輪詢）

輪流使用所有可用的 providers，平均分配負載。

```json
"routing_strategy": "round_robin"
```

---

## 🔄 Failover 策略

### 1. None（無 failover）

失敗時立即返回錯誤，不嘗試其他 provider。

```json
"failover_strategy": "none"
```

### 2. Next（下一個）

失敗時嘗試下一個可用的 provider。

```json
"failover_strategy": "next"
```

### 3. All（全部）

失敗時嘗試所有可用的 providers，直到成功或全部失敗。

```json
"failover_strategy": "all"
```

### 4. Round-robin（輪詢 failover）

使用輪詢方式分配請求，失敗時嘗試下一個。

```json
"failover_strategy": "round_robin"
```

---

## 📊 健康檢查和監控

### 健康檢查

```go
// 檢查所有 providers 的健康狀態
statuses := manager.HealthCheck(ctx)

for providerType, status := range statuses {
    log.Printf("Provider %s: %s", providerType, status)
}
```

### 獲取指標

```go
// 獲取所有 providers 的指標
metrics := manager.GetMetrics()

for providerType, metric := range metrics {
    log.Printf("Provider %s:", providerType)
    log.Printf("  Requests: %d", metric.RequestCount)
    log.Printf("  Success: %d", metric.SuccessCount)
    log.Printf("  Failures: %d", metric.FailureCount)
    log.Printf("  Avg Latency: %v", metric.AverageLatency)
}
```

### Provider 狀態

- `healthy`: 正常運作
- `degraded`: 部分失敗（錯誤率 10-50%）
- `unhealthy`: 大量失敗（錯誤率 > 50%）
- `unknown`: 尚未測試

---

## 🏥 使用場景範例

### 場景 1：高級醫院（Premium Plan）

**需求**：
- 最高品質的翻譯
- 最低延遲
- 多重 failover 保障
- 99% 可用性

**配置**：
```json
{
  "client_id": "hospital_a",
  "plan_name": "Premium Hospital Plan",
  "asr_config": {
    "providers": [
      {"type": "openai_asr", "priority": 100},
      {"type": "google_asr", "priority": 90}
    ],
    "failover_strategy": "next",
    "routing_strategy": "priority"
  },
  "translation_config": {
    "providers": [
      {"type": "openai_translation", "priority": 100},
      {"type": "google_translation", "priority": 90}
    ],
    "failover_strategy": "next",
    "routing_strategy": "priority",
    "language_providers": {
      "vi": "google_translation",
      "id": "google_translation"
    }
  },
  "sla": {
    "max_latency_ms": 5000,
    "min_availability": 0.99,
    "max_error_rate": 0.01
  }
}
```

### 場景 2：標準醫院（Standard Plan）

**需求**：
- 平衡品質和成本
- 95% 可用性
- 單一 provider（降低成本）

**配置**：
```json
{
  "client_id": "hospital_b",
  "plan_name": "Standard Hospital Plan",
  "asr_config": {
    "providers": [
      {"type": "openai_asr", "priority": 100}
    ],
    "failover_strategy": "none",
    "routing_strategy": "priority"
  },
  "translation_config": {
    "providers": [
      {"type": "google_translation", "priority": 100}
    ],
    "failover_strategy": "none",
    "routing_strategy": "cost"
  },
  "sla": {
    "max_latency_ms": 8000,
    "min_availability": 0.95,
    "max_error_rate": 0.05
  }
}
```

### 場景 3：基礎診所（Basic Plan）

**需求**：
- 最低成本
- 90% 可用性
- 特定語言優化（越南語、印尼語）

**配置**：
```json
{
  "client_id": "clinic_c",
  "plan_name": "Basic Clinic Plan",
  "translation_config": {
    "providers": [
      {"type": "google_translation", "priority": 100}
    ],
    "failover_strategy": "none",
    "routing_strategy": "cost",
    "language_providers": {
      "vi": "google_translation",
      "id": "google_translation"
    }
  },
  "sla": {
    "max_latency_ms": 10000,
    "min_availability": 0.90,
    "max_error_rate": 0.10
  },
  "cost_tracking": {
    "enabled": true,
    "monthly_budget": 200.0,
    "alert_threshold": 0.95
  }
}
```

---

## 🔌 新增 Provider

### 1. 實作介面

以新增 Azure Translation Provider 為例：

```go
package provider

import (
    "context"
    "time"
)

type AzureTranslationProvider struct {
    *TranslationProviderBase
    apiKey   string
    endpoint string
    // ... other fields
}

func NewAzureTranslationProvider(config ProviderConfig) (TranslationService, error) {
    // Initialize provider
    base := NewTranslationProviderBase(ProviderAzureTranslation, "Azure Translator", config)
    
    return &AzureTranslationProvider{
        TranslationProviderBase: base,
        apiKey:                  config.Credentials["api_key"],
        endpoint:                config.Credentials["endpoint"],
    }, nil
}

func (p *AzureTranslationProvider) Translate(ctx context.Context, req TranslationRequest) (*TranslationResponse, error) {
    startTime := time.Now()
    
    // Call Azure Translator API
    translatedText, err := p.callAzureAPI(ctx, req)
    latency := time.Since(startTime)
    
    // Update metrics
    p.UpdateMetrics(latency, err == nil, err)
    
    if err != nil {
        return &TranslationResponse{
            ProviderResponse: ProviderResponse{
                Provider:  p.GetType(),
                Success:   false,
                LatencyMs: latency.Milliseconds(),
                Error:     err.Error(),
                Timestamp: time.Now(),
            },
        }, err
    }
    
    return &TranslationResponse{
        ProviderResponse: ProviderResponse{
            Provider:  p.GetType(),
            Success:   true,
            LatencyMs: latency.Milliseconds(),
            Timestamp: time.Now(),
        },
        TranslatedText: translatedText,
        SourceLang:     req.SourceLang,
        TargetLang:     req.TargetLang,
    }, nil
}

// Implement other required methods...
```

### 2. 註冊到 Config Loader

在 `config_loader.go` 的 `createTranslationProvider` 函數中新增：

```go
func createTranslationProvider(config ProviderConfig) (TranslationService, error) {
    switch config.Type {
    case ProviderOpenAITranslation:
        return NewOpenAITranslationProvider(config)
    case ProviderGoogleTranslation:
        return NewGoogleTranslationProvider(config)
    case ProviderAzureTranslation:
        return NewAzureTranslationProvider(config)  // 新增這行
    case ProviderDeepLTranslation:
        return NewDeepLTranslationProvider(config)
    default:
        return nil, fmt.Errorf("unknown translation provider type: %s", config.Type)
    }
}
```

### 3. 在配置中使用

```json
{
  "type": "azure_translation",
  "enabled": true,
  "priority": 85,
  "max_retries": 2,
  "timeout": "30s",
  "credentials": {
    "api_key": "${AZURE_API_KEY}",
    "endpoint": "https://api.cognitive.microsofttranslator.com"
  }
}
```

---

## 📈 成本估算

### OpenAI 成本

**Whisper (ASR)**:
- $0.006 / 分鐘
- 平均音訊長度：1.5 秒
- 單次成本：~$0.00015

**GPT-4o-mini (Translation)**:
- 輸入：$0.15 / 1M tokens
- 輸出：$0.60 / 1M tokens
- 平均 tokens：50（輸入）+ 50（輸出）
- 單次成本：~$0.006

**TTS**:
- tts-1: $15 / 1M 字元
- tts-1-hd: $30 / 1M 字元
- 平均字元數：50
- 單次成本：~$0.00075

**總成本（單次完整對話）**：~$0.007

### Google 成本

**Translation**:
- $20 / 1M 字元
- 平均字元數：50
- 單次成本：~$0.001

### 每月成本估算

假設每天 1000 次對話：

**Premium Plan（OpenAI）**：
- 每月對話數：30,000
- 每月成本：30,000 × $0.007 = **$210**

**Standard Plan（Google Translation + OpenAI ASR/TTS）**：
- 每月對話數：30,000
- 每月成本：30,000 × $0.002 = **$60**

**Basic Plan（Google Translation only）**：
- 每月對話數：30,000
- 每月成本：30,000 × $0.001 = **$30**

---

## 🔐 安全性建議

1. **API Key 管理**
   - 使用環境變數儲存 API keys
   - 不要將 API keys 提交到版本控制
   - 定期輪換 API keys

2. **配置檔案安全**
   - 使用 `${VAR_NAME}` 格式引用環境變數
   - 配置檔案應設定適當的檔案權限（600）

3. **網路安全**
   - 所有 API 呼叫使用 HTTPS
   - 設定適當的 timeout 避免長時間等待

4. **錯誤處理**
   - 不要在錯誤訊息中洩漏 API keys
   - 記錄錯誤但不記錄敏感資訊

---

## 🧪 測試

### 單元測試範例

```go
package provider

import (
    "context"
    "testing"
)

func TestOpenAITranslationProvider(t *testing.T) {
    config := ProviderConfig{
        Type:    ProviderOpenAITranslation,
        Enabled: true,
        Credentials: map[string]string{
            "api_key": "test-api-key",
        },
        Options: map[string]interface{}{
            "model": "gpt-4o-mini",
        },
    }
    
    provider, err := NewOpenAITranslationProvider(config)
    if err != nil {
        t.Fatalf("Failed to create provider: %v", err)
    }
    
    req := TranslationRequest{
        Text:       "Hello, world!",
        SourceLang: "en",
        TargetLang: "zh",
        Context:    RequestContext{ClientID: "test"},
    }
    
    resp, err := provider.Translate(context.Background(), req)
    if err != nil {
        t.Fatalf("Translation failed: %v", err)
    }
    
    if resp.TranslatedText == "" {
        t.Error("Expected non-empty translation")
    }
}
```

---

## 📚 參考資料

### API 文件

- [OpenAI Whisper API](https://platform.openai.com/docs/guides/speech-to-text)
- [OpenAI Chat Completions API](https://platform.openai.com/docs/guides/text-generation)
- [OpenAI TTS API](https://platform.openai.com/docs/guides/text-to-speech)
- [Google Cloud Translation API](https://cloud.google.com/translate/docs)
- [Azure Cognitive Services Translator](https://docs.microsoft.com/azure/cognitive-services/translator/)
- [DeepL API](https://www.deepl.com/docs-api)

### 定價資訊

- [OpenAI Pricing](https://openai.com/pricing)
- [Google Cloud Translation Pricing](https://cloud.google.com/translate/pricing)
- [Azure Translator Pricing](https://azure.microsoft.com/pricing/details/cognitive-services/translator/)
- [DeepL API Pricing](https://www.deepl.com/pro-api)

---

## 🤝 貢獻

歡迎提交 Issue 和 Pull Request！

---

## 📄 授權

MIT License
