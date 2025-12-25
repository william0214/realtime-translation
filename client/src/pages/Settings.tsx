import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { TRANSLATION_CONFIG, WHISPER_CONFIG } from "@shared/config";
import { ArrowLeft } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { useLocation } from "wouter";

export default function Settings() {
  const [, setLocation] = useLocation();

  // ASR Model
  const [asrModel, setAsrModel] = useState<string>(() => {
    const saved = localStorage.getItem("asr-model");
    return saved || WHISPER_CONFIG.MODEL;
  });

  // Translation Model
  const [translationModel, setTranslationModel] = useState<string>(() => {
    const saved = localStorage.getItem("translation-model");
    return saved || TRANSLATION_CONFIG.LLM_MODEL;
  });

  // Save ASR model to localStorage
  useEffect(() => {
    localStorage.setItem("asr-model", asrModel);
  }, [asrModel]);

  // Save Translation model to localStorage
  useEffect(() => {
    localStorage.setItem("translation-model", translationModel);
  }, [translationModel]);

  const handleResetToDefaults = () => {
    setAsrModel(WHISPER_CONFIG.MODEL);
    setTranslationModel(TRANSLATION_CONFIG.LLM_MODEL);
    toast.success("已重置為預設值");
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-blue-900 to-gray-900">
      <div className="container mx-auto px-4 py-8 max-w-4xl">
        {/* Header */}
        <div className="flex items-center gap-4 mb-8">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setLocation("/")}
            className="text-white hover:bg-white/10"
          >
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div>
            <h1 className="text-3xl font-bold text-white">系統設定</h1>
            <p className="text-gray-400 mt-1">調整 ASR 模型和翻譯模型</p>
          </div>
        </div>

        <div className="space-y-6">
          {/* ASR Model Settings */}
          <Card className="bg-gray-800/50 border-gray-700">
            <CardHeader>
              <CardTitle className="text-white">🎙️ ASR 語音識別模型</CardTitle>
              <CardDescription className="text-gray-400">
                選擇語音轉文字的模型，影響識別速度和準確度
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label className="text-white">ASR 模型</Label>
                <Select value={asrModel} onValueChange={setAsrModel}>
                  <SelectTrigger className="bg-gray-900 border-gray-700 text-white">
                    <SelectValue placeholder="選擇 ASR 模型" />
                  </SelectTrigger>
                  <SelectContent className="bg-gray-900 border-gray-700">
                    {WHISPER_CONFIG.AVAILABLE_MODELS.map((model) => (
                      <SelectItem key={model.value} value={model.value}>
                        <div className="flex flex-col">
                          <span className="text-white">
                            {model.icon} {model.label}
                          </span>
                          <span className="text-xs text-gray-400">{model.description}</span>
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="text-sm text-gray-400">
                  當前選擇：{
                    asrModel === "whisper-1" ? "Whisper-1（原版 Whisper）" :
                    asrModel === "gpt-4o-mini-transcribe" ? "GPT-4o Mini（快速、低成本）" :
                    asrModel === "gpt-4o-transcribe" ? "GPT-4o（高品質、較慢）" :
                    asrModel === "gpt-4o-transcribe-diarize" ? "GPT-4o Diarize（含說話者辨識）" :
                    asrModel
                  }
                </p>
              </div>
            </CardContent>
          </Card>

          {/* Translation Model Settings */}
          <Card className="bg-gray-800/50 border-gray-700">
            <CardHeader>
              <CardTitle className="text-white">🌐 翻譯模型</CardTitle>
              <CardDescription className="text-gray-400">
                用於翻譯的語言模型
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label className="text-white">翻譯模型</Label>
                <Select value={translationModel} onValueChange={setTranslationModel}>
                  <SelectTrigger className="bg-gray-900 border-gray-700 text-white">
                    <SelectValue placeholder="選擇翻譯模型" />
                  </SelectTrigger>
                  <SelectContent className="bg-gray-900 border-gray-700">
                    {TRANSLATION_CONFIG.AVAILABLE_TRANSLATION_MODELS.map((model) => (
                      <SelectItem key={model.id} value={model.id}>
                        <div className="flex flex-col">
                          <span className="text-white">
                            {model.icon} {model.name}
                          </span>
                          <span className="text-xs text-gray-400">{model.description}</span>
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="text-sm text-gray-400">
                  當前選擇：{TRANSLATION_CONFIG.AVAILABLE_TRANSLATION_MODELS.find(m => m.id === translationModel)?.name || translationModel}
                </p>
              </div>
            </CardContent>
          </Card>

          {/* Info Card - VAD Parameters */}
          <Card className="bg-gray-800/50 border-gray-700 border-blue-500/30">
            <CardHeader>
              <CardTitle className="text-white">ℹ️ VAD 參數說明</CardTitle>
              <CardDescription className="text-gray-400">
                語音活動偵測（VAD）參數已整合到 ASR 模式中
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-3 text-sm text-gray-300">
                <p>
                  VAD 參數（音量閾值、靜音持續時間、最小語音長度等）現在由系統根據 ASR 模式自動配置，無需手動調整。
                </p>
                <div className="space-y-2 pl-4 border-l-2 border-blue-500/30">
                  <p className="text-gray-400">
                    <span className="font-semibold text-white">Normal 模式：</span>
                    快速回應，適合日常對話
                  </p>
                  <p className="text-gray-400">
                    <span className="font-semibold text-white">Precise 模式：</span>
                    高準確度，適合醫療問診和重要對話
                  </p>
                </div>
                <p className="text-xs text-gray-500 mt-4">
                  如需調整 VAD 行為，請在首頁切換 ASR 模式。
                </p>
              </div>
            </CardContent>
          </Card>

          {/* Action Buttons */}
          <div className="flex gap-4">
            <Button
              onClick={handleResetToDefaults}
              variant="outline"
              className="flex-1 bg-gray-800 border-gray-700 text-white hover:bg-gray-700"
            >
              重置為預設值
            </Button>
            <Button
              onClick={() => setLocation("/")}
              className="flex-1 bg-blue-600 hover:bg-blue-700 text-white"
            >
              返回首頁
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
