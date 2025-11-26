import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "sonner";
import { Upload, Loader2 } from "lucide-react";

interface TestResult {
  sourceText: string;
  translatedText: string;
  sourceLang: string;
  targetLang: string;
  direction: string;
  whisperLanguage?: string;
  detectedLanguage?: string;
}

export default function Test() {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [testResult, setTestResult] = useState<TestResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const autoTranslateMutation = trpc.translation.autoTranslate.useMutation();

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      // 檢查檔案類型
      const validTypes = ["audio/webm", "audio/wav", "audio/mp3", "audio/mpeg", "audio/ogg"];
      if (!validTypes.includes(file.type) && !file.name.match(/\.(webm|wav|mp3|ogg)$/i)) {
        toast.error("請上傳有效的音訊檔案（WebM, WAV, MP3, OGG）");
        return;
      }

      // 檢查檔案大小（最大 10MB）
      if (file.size > 10 * 1024 * 1024) {
        toast.error("檔案大小不能超過 10MB");
        return;
      }

      setSelectedFile(file);
      setTestResult(null);
      setError(null);
      toast.success(`已選擇檔案: ${file.name}`);
    }
  };

  const handleTest = async () => {
    if (!selectedFile) {
      toast.error("請先選擇音訊檔案");
      return;
    }

    setIsProcessing(true);
    setError(null);
    setTestResult(null);

    try {
      // 讀取檔案為 base64
      const reader = new FileReader();
      reader.onload = async (e) => {
        try {
          const arrayBuffer = e.target?.result as ArrayBuffer;
          const uint8Array = new Uint8Array(arrayBuffer);
          const base64Audio = btoa(String.fromCharCode(...Array.from(uint8Array)));

          console.log(`[Test] Processing file: ${selectedFile.name}, size: ${selectedFile.size} bytes`);

          // 呼叫 API
          const result = await autoTranslateMutation.mutateAsync({
            audioBase64: base64Audio,
            filename: selectedFile.name,
            preferredTargetLang: "vi", // 預設越南語
          });

          console.log("[Test] API result:", result);

          if (result.success && result.sourceText && result.translatedText) {
            setTestResult({
              sourceText: result.sourceText,
              translatedText: result.translatedText,
              sourceLang: result.sourceLang || "unknown",
              targetLang: result.targetLang || "unknown",
              direction: result.direction || "unknown",
            });
            toast.success("測試完成！");
          } else {
            setError(result.error || "翻譯失敗");
            toast.error(result.error || "翻譯失敗");
          }
        } catch (err: any) {
          console.error("[Test] Error:", err);
          setError(err.message || "處理失敗");
          toast.error(err.message || "處理失敗");
        } finally {
          setIsProcessing(false);
        }
      };

      reader.onerror = () => {
        setError("無法讀取檔案");
        toast.error("無法讀取檔案");
        setIsProcessing(false);
      };

      reader.readAsArrayBuffer(selectedFile);
    } catch (err: any) {
      console.error("[Test] Error:", err);
      setError(err.message || "處理失敗");
      toast.error(err.message || "處理失敗");
      setIsProcessing(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-900 dark:to-slate-800 p-4">
      <div className="container max-w-4xl mx-auto py-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold mb-2">音檔測試工具</h1>
          <p className="text-muted-foreground">
            上傳音訊檔案，查看詳細的語音識別和翻譯結果
          </p>
        </div>

        <Card className="mb-6">
          <CardHeader>
            <CardTitle>上傳音訊檔案</CardTitle>
            <CardDescription>
              支援格式：WebM, WAV, MP3, OGG（最大 10MB）
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center gap-4">
              <label
                htmlFor="file-upload"
                className="flex-1 cursor-pointer"
              >
                <div className="border-2 border-dashed border-border rounded-lg p-8 text-center hover:border-primary transition-colors">
                  <Upload className="w-12 h-12 mx-auto mb-4 text-muted-foreground" />
                  <p className="text-sm text-muted-foreground mb-2">
                    {selectedFile ? selectedFile.name : "點擊選擇檔案或拖曳到此處"}
                  </p>
                  {selectedFile && (
                    <p className="text-xs text-muted-foreground">
                      大小: {(selectedFile.size / 1024).toFixed(2)} KB
                    </p>
                  )}
                </div>
                <input
                  id="file-upload"
                  type="file"
                  accept="audio/webm,audio/wav,audio/mp3,audio/mpeg,audio/ogg,.webm,.wav,.mp3,.ogg"
                  onChange={handleFileSelect}
                  className="hidden"
                />
              </label>
            </div>

            <Button
              onClick={handleTest}
              disabled={!selectedFile || isProcessing}
              className="w-full"
              size="lg"
            >
              {isProcessing ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  處理中...
                </>
              ) : (
                "開始測試"
              )}
            </Button>
          </CardContent>
        </Card>

        {error && (
          <Card className="mb-6 border-destructive">
            <CardHeader>
              <CardTitle className="text-destructive">錯誤</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm">{error}</p>
            </CardContent>
          </Card>
        )}

        {testResult && (
          <Card>
            <CardHeader>
              <CardTitle>測試結果</CardTitle>
              <CardDescription>詳細的處理結果和語言資訊</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-sm font-medium mb-1">翻譯方向</p>
                  <p className="text-lg font-mono bg-muted p-2 rounded">
                    {testResult.direction}
                  </p>
                  <p className="text-xs text-muted-foreground mt-1" translate="no">
                    {testResult.direction === "nurse_to_patient"
                      ? "台灣人 → 外國人"
                      : "外國人 → 台灣人"}
                  </p>
                </div>

                <div>
                  <p className="text-sm font-medium mb-1">語言對</p>
                  <p className="text-lg font-mono bg-muted p-2 rounded">
                    {testResult.sourceLang} → {testResult.targetLang}
                  </p>
                </div>
              </div>

              <div>
                <p className="text-sm font-medium mb-1">原文（識別結果）</p>
                <div className="bg-blue-50 dark:bg-blue-950 p-4 rounded-lg">
                  <p className="text-lg">{testResult.sourceText}</p>
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  語言: {testResult.sourceLang}
                </p>
              </div>

              <div>
                <p className="text-sm font-medium mb-1">譯文（翻譯結果）</p>
                <div className="bg-green-50 dark:bg-green-950 p-4 rounded-lg">
                  <p className="text-lg">{testResult.translatedText}</p>
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  語言: {testResult.targetLang}
                </p>
              </div>

              <div className="border-t pt-4">
                <p className="text-sm font-medium mb-2">顯示邏輯分析</p>
                <div className="space-y-2 text-sm" translate="no">
                  {testResult.direction === "nurse_to_patient" ? (
                    <>
                      <div className="flex items-start gap-2">
                        <span className="font-medium min-w-[100px]">台灣人對話框:</span>
                        <span className="bg-blue-100 dark:bg-blue-900 px-2 py-1 rounded">
                          {testResult.sourceText}
                        </span>
                        <span className="text-muted-foreground">（原文）</span>
                      </div>
                      <div className="flex items-start gap-2">
                        <span className="font-medium min-w-[100px]">外國人對話框:</span>
                        <span className="bg-green-100 dark:bg-green-900 px-2 py-1 rounded">
                          {testResult.translatedText}
                        </span>
                        <span className="text-muted-foreground">（譯文）</span>
                      </div>
                    </>
                  ) : (
                    <>
                      <div className="flex items-start gap-2">
                        <span className="font-medium min-w-[100px]">外國人對話框:</span>
                        <span className="bg-blue-100 dark:bg-blue-900 px-2 py-1 rounded">
                          {testResult.sourceText}
                        </span>
                        <span className="text-muted-foreground">（原文）</span>
                      </div>
                      <div className="flex items-start gap-2">
                        <span className="font-medium min-w-[100px]">台灣人對話框:</span>
                        <span className="bg-green-100 dark:bg-green-900 px-2 py-1 rounded">
                          {testResult.translatedText}
                        </span>
                        <span className="text-muted-foreground">（譯文）</span>
                      </div>
                    </>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
