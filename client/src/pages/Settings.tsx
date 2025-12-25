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
import { Slider } from "@/components/ui/slider";
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

  // VAD Parameters
  const [rmsThreshold, setRmsThreshold] = useState<number>(() => {
    const saved = localStorage.getItem("vad-rms-threshold");
    return saved ? parseFloat(saved) : 0.055;
  });

  const [silenceDuration, setSilenceDuration] = useState<number>(() => {
    const saved = localStorage.getItem("vad-silence-duration");
    return saved ? parseInt(saved) : 650;
  });

  const [minSpeechDuration, setMinSpeechDuration] = useState<number>(() => {
    const saved = localStorage.getItem("vad-min-speech-duration");
    return saved ? parseInt(saved) : 800;
  });

  // VAD Hysteresis Parameters (v1.5.3)
  const [vadStartThreshold, setVadStartThreshold] = useState<number>(() => {
    const saved = localStorage.getItem("vad-start-threshold");
    return saved ? parseFloat(saved) : 0.045;
  });

  const [vadEndThreshold, setVadEndThreshold] = useState<number>(() => {
    const saved = localStorage.getItem("vad-end-threshold");
    return saved ? parseFloat(saved) : 0.035;
  });

  const [vadStartFrames, setVadStartFrames] = useState<number>(() => {
    const saved = localStorage.getItem("vad-start-frames");
    return saved ? parseInt(saved) : 2;
  });

  const [vadEndFrames, setVadEndFrames] = useState<number>(() => {
    const saved = localStorage.getItem("vad-end-frames");
    return saved ? parseInt(saved) : 8;
  });

  // Save ASR model to localStorage
  useEffect(() => {
    localStorage.setItem("asr-model", asrModel);
  }, [asrModel]);

  // Save Translation model to localStorage
  useEffect(() => {
    localStorage.setItem("translation-model", translationModel);
  }, [translationModel]);

  // Save VAD parameters to localStorage
  useEffect(() => {
    localStorage.setItem("vad-rms-threshold", rmsThreshold.toString());
  }, [rmsThreshold]);

  useEffect(() => {
    localStorage.setItem("vad-silence-duration", silenceDuration.toString());
  }, [silenceDuration]);

  useEffect(() => {
    localStorage.setItem("vad-min-speech-duration", minSpeechDuration.toString());
  }, [minSpeechDuration]);

  useEffect(() => {
    localStorage.setItem("vad-start-threshold", vadStartThreshold.toString());
  }, [vadStartThreshold]);

  useEffect(() => {
    localStorage.setItem("vad-end-threshold", vadEndThreshold.toString());
  }, [vadEndThreshold]);

  useEffect(() => {
    localStorage.setItem("vad-start-frames", vadStartFrames.toString());
  }, [vadStartFrames]);

  useEffect(() => {
    localStorage.setItem("vad-end-frames", vadEndFrames.toString());
  }, [vadEndFrames]);

  const handleResetToDefaults = () => {
    setAsrModel(WHISPER_CONFIG.MODEL);
    setRmsThreshold(0.055);
    setSilenceDuration(650);
    setMinSpeechDuration(800);
    setVadStartThreshold(0.045);
    setVadEndThreshold(0.035);
    setVadStartFrames(2);
    setVadEndFrames(8);
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
            <p className="text-gray-400 mt-1">調整 ASR 模型、翻譯模型和 VAD 參數</p>
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

          {/* VAD Settings */}
          <Card className="bg-gray-800/50 border-gray-700">
            <CardHeader>
              <CardTitle className="text-white">🎚️ VAD 語音活動偵測參數</CardTitle>
              <CardDescription className="text-gray-400">
                調整語音偵測的靈敏度和行為，影響語音片段的擷取
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* RMS Threshold */}
              <div className="space-y-3">
                <div className="flex justify-between items-center">
                  <Label className="text-white">RMS 音量閾值</Label>
                  <span className="text-sm text-gray-400">{rmsThreshold.toFixed(3)}</span>
                </div>
                <Slider
                  value={[rmsThreshold]}
                  onValueChange={(value) => setRmsThreshold(value[0])}
                  min={0.01}
                  max={0.15}
                  step={0.005}
                  className="w-full"
                />
                <p className="text-xs text-gray-400">
                  高於此音量才視為有效語音。建議值：安靜環境 0.03，一般環境 0.055，嘈雜環境 0.08
                </p>
              </div>

              {/* Silence Duration */}
              <div className="space-y-3">
                <div className="flex justify-between items-center">
                  <Label className="text-white">靜音持續時間</Label>
                  <span className="text-sm text-gray-400">{silenceDuration} ms</span>
                </div>
                <Slider
                  value={[silenceDuration]}
                  onValueChange={(value) => setSilenceDuration(value[0])}
                  min={300}
                  max={1200}
                  step={50}
                  className="w-full"
                />
                <p className="text-xs text-gray-400">
                  偵測到靜音超過此時間後，判定為句子結束。建議值：快速回應 500-600ms，平衡模式 650ms，完整句子 700-800ms
                </p>
              </div>

              {/* Min Speech Duration */}
              <div className="space-y-3">
                <div className="flex justify-between items-center">
                  <Label className="text-white">最小語音持續時間</Label>
                  <span className="text-sm text-gray-400">{minSpeechDuration} ms</span>
                </div>
                <Slider
                  value={[minSpeechDuration]}
                  onValueChange={(value) => setMinSpeechDuration(value[0])}
                  min={200}
                  max={1500}
                  step={50}
                  className="w-full"
                />
                <p className="text-xs text-gray-400">
                  短於此時間的語音片段會被過濾。建議值：安靜環境 200ms，一般環境 250ms，嘵雜環境 300ms，防止幻覺 800ms
                </p>
              </div>

              {/* VAD Hysteresis Section (v1.5.3) */}
              <div className="border-t border-gray-700 pt-4 mt-4">
                <h3 className="text-white font-semibold mb-3">🔄 VAD 雙門檻參數 (Hysteresis)</h3>
                <p className="text-xs text-gray-400 mb-4">
                  雙門檻機制可防止語音偵測在臨界值附近抖動，提升穩定性。
                </p>
                
                {/* VAD Start Threshold */}
                <div className="space-y-3 mb-4">
                  <div className="flex justify-between items-center">
                    <Label className="text-white">語音開始門檻 (Start Threshold)</Label>
                    <span className="text-sm text-gray-400">{vadStartThreshold.toFixed(3)}</span>
                  </div>
                  <Slider
                    value={[vadStartThreshold]}
                    onValueChange={(value) => setVadStartThreshold(value[0])}
                    min={0.01}
                    max={0.15}
                    step={0.005}
                    className="w-full"
                  />
                  <p className="text-xs text-gray-400">
                    音量超過此門檻才觸發語音開始。建議值：0.045 (預設)
                  </p>
                </div>

                {/* VAD End Threshold */}
                <div className="space-y-3 mb-4">
                  <div className="flex justify-between items-center">
                    <Label className="text-white">語音結束門檻 (End Threshold)</Label>
                    <span className="text-sm text-gray-400">{vadEndThreshold.toFixed(3)}</span>
                  </div>
                  <Slider
                    value={[vadEndThreshold]}
                    onValueChange={(value) => setVadEndThreshold(value[0])}
                    min={0.01}
                    max={0.15}
                    step={0.005}
                    className="w-full"
                  />
                  <p className="text-xs text-gray-400">
                    音量低於此門檻才觸發語音結束。建議值：0.035 (預設)
                  </p>
                </div>

                {/* VAD Start Frames */}
                <div className="space-y-3 mb-4">
                  <div className="flex justify-between items-center">
                    <Label className="text-white">開始連續幀數 (Start Frames)</Label>
                    <span className="text-sm text-gray-400">{vadStartFrames}</span>
                  </div>
                  <Slider
                    value={[vadStartFrames]}
                    onValueChange={(value) => setVadStartFrames(value[0])}
                    min={1}
                    max={10}
                    step={1}
                    className="w-full"
                  />
                  <p className="text-xs text-gray-400">
                    連續超過開始門檻多少幀才觸發語音開始。建議值：2 (預設)
                  </p>
                </div>

                {/* VAD End Frames */}
                <div className="space-y-3">
                  <div className="flex justify-between items-center">
                    <Label className="text-white">結束連續幀數 (End Frames)</Label>
                    <span className="text-sm text-gray-400">{vadEndFrames}</span>
                  </div>
                  <Slider
                    value={[vadEndFrames]}
                    onValueChange={(value) => setVadEndFrames(value[0])}
                    min={1}
                    max={20}
                    step={1}
                    className="w-full"
                  />
                  <p className="text-xs text-gray-400">
                    連續低於結束門檻多少幀才觸發語音結束。建議值：8 (預設)
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Action Buttons */}
          <div className="flex gap-4">
            <Button
              variant="outline"
              onClick={handleResetToDefaults}
              className="flex-1 bg-gray-800 border-gray-700 text-white hover:bg-gray-700"
            >
              重置為預設值
            </Button>
            <Button
              onClick={() => {
                toast.success("設定已儲存");
                setLocation("/");
              }}
              className="flex-1 bg-blue-600 hover:bg-blue-700 text-white"
            >
              儲存並返回
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
