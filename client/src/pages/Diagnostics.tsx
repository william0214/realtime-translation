import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { AlertCircle, CheckCircle, AlertTriangle } from "lucide-react";
import { useEffect } from "react";

export default function Diagnostics() {
  const { data, isLoading, refetch } = trpc.diagnostics.report.useQuery();

  // Auto-refresh every 2 seconds
  useEffect(() => {
    const interval = setInterval(() => {
      refetch();
    }, 2000);
    return () => clearInterval(interval);
  }, [refetch]);

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-900">
        <p className="text-gray-400">載入診斷資料...</p>
      </div>
    );
  }

  if (!data || !data.success || !data.data) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-900">
        <Card className="bg-gray-800 border-gray-700">
          <CardHeader>
            <CardTitle className="text-gray-100">無診斷資料</CardTitle>
            <CardDescription className="text-gray-400">請先開始對話以收集效能資料</CardDescription>
          </CardHeader>
        </Card>
      </div>
    );
  }

  const report = data.data;

  const getSeverityIcon = (severity: string) => {
    switch (severity) {
      case "green":
        return <CheckCircle className="h-5 w-5 text-green-500" />;
      case "yellow":
        return <AlertTriangle className="h-5 w-5 text-yellow-500" />;
      case "red":
        return <AlertCircle className="h-5 w-5 text-red-500" />;
      default:
        return <CheckCircle className="h-5 w-5 text-gray-500" />;
    }
  };

  const getSeverityColor = (value: number, yellowThreshold: number, redThreshold: number): string => {
    if (value > redThreshold) return "text-red-500";
    if (value > yellowThreshold) return "text-yellow-500";
    return "text-green-500";
  };

  return (
    <div className="min-h-screen bg-gray-900 p-6">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-gray-100">效能診斷儀表板</h1>
            <p className="text-gray-400 mt-2">即時監控系統效能與瓶頸分析</p>
          </div>
          <Badge variant={report.bottleneck.severity === "green" ? "default" : "destructive"} className="text-lg px-4 py-2">
            {getSeverityIcon(report.bottleneck.severity)}
            <span className="ml-2">{report.bottleneck.severity.toUpperCase()}</span>
          </Badge>
        </div>

        {/* Bottleneck Card */}
        <Card className="bg-gray-800 border-gray-700">
          <CardHeader>
            <CardTitle className="text-gray-100 flex items-center gap-2">
              {getSeverityIcon(report.bottleneck.severity)}
              系統瓶頸分析
            </CardTitle>
            <CardDescription className="text-gray-400">{report.bottleneck.bottleneck}</CardDescription>
          </CardHeader>
          <CardContent>
            <ul className="space-y-2">
              {report.bottleneck.details.map((detail: string, index: number) => (
                <li key={index} className="text-gray-300 flex items-start gap-2">
                  <span className="text-gray-500">•</span>
                  {detail}
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>

        {/* Metrics Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {/* ASR Latency */}
          {report.asr && (
            <Card className="bg-gray-800 border-gray-700">
              <CardHeader>
                <CardTitle className="text-gray-100 text-lg">ASR 延遲 (Whisper)</CardTitle>
              </CardHeader>
              <CardContent>
                <div className={`text-4xl font-bold ${getSeverityColor(report.asr.duration, 1000, 1500)}`}>
                  {report.asr.duration.toFixed(0)} ms
                </div>
                <div className="mt-4 space-y-2 text-sm text-gray-400">
                  <p>音訊時長: {report.asr.metadata.audioDuration.toFixed(2)}s</p>
                  <p>檔案大小: {(report.asr.metadata.fileSize / 1024).toFixed(0)} KB</p>
                  <p>模型: {report.asr.metadata.model}</p>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Translation Latency */}
          {report.translation && (
            <Card className="bg-gray-800 border-gray-700">
              <CardHeader>
                <CardTitle className="text-gray-100 text-lg">翻譯延遲</CardTitle>
              </CardHeader>
              <CardContent>
                <div className={`text-4xl font-bold ${getSeverityColor(report.translation.duration, 400, 600)}`}>
                  {report.translation.duration.toFixed(0)} ms
                </div>
                <div className="mt-4 space-y-2 text-sm text-gray-400">
                  <p>文字長度: {report.translation.metadata.textLength} 字</p>
                  <p>
                    方向: {report.translation.metadata.sourceLang} → {report.translation.metadata.targetLang}
                  </p>
                  <p>模型: {report.translation.metadata.model}</p>
                </div>
              </CardContent>
            </Card>
          )}

          {/* TTS Latency */}
          {report.tts && (
            <Card className="bg-gray-800 border-gray-700">
              <CardHeader>
                <CardTitle className="text-gray-100 text-lg">TTS 延遲</CardTitle>
              </CardHeader>
              <CardContent>
                <div className={`text-4xl font-bold ${getSeverityColor(report.tts.duration, 400, 600)}`}>
                  {report.tts.duration.toFixed(0)} ms
                </div>
                <div className="mt-4 space-y-2 text-sm text-gray-400">
                  <p>文字長度: {report.tts.metadata.textLength} 字</p>
                  <p>音訊時長: {report.tts.metadata.audioDuration.toFixed(2)}s</p>
                  <p>模型: {report.tts.metadata.model}</p>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Chunk Info */}
          {report.chunk && (
            <Card className="bg-gray-800 border-gray-700">
              <CardHeader>
                <CardTitle className="text-gray-100 text-lg">Chunk 資訊</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  <div>
                    <p className="text-sm text-gray-400">時長</p>
                    <p
                      className={`text-2xl font-bold ${getSeverityColor(report.chunk.metadata.chunkDuration, 1.0, 1.3)}`}
                    >
                      {report.chunk.metadata.chunkDuration.toFixed(2)}s
                    </p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-400">大小</p>
                    <p
                      className={`text-2xl font-bold ${getSeverityColor(report.chunk.metadata.chunkSize, 200 * 1024, 250 * 1024)}`}
                    >
                      {(report.chunk.metadata.chunkSize / 1024).toFixed(0)} KB
                    </p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-400">上傳時間</p>
                    <p className={`text-2xl font-bold ${getSeverityColor(report.chunk.metadata.uploadTime, 300, 400)}`}>
                      {report.chunk.metadata.uploadTime.toFixed(0)} ms
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {/* E2E Latency */}
          {report.e2e && (
            <Card className="bg-gray-800 border-gray-700">
              <CardHeader>
                <CardTitle className="text-gray-100 text-lg">端到端延遲</CardTitle>
              </CardHeader>
              <CardContent>
                <div className={`text-4xl font-bold ${getSeverityColor(report.e2e.duration, 1000, 1500)}`}>
                  {report.e2e.duration.toFixed(0)} ms
                </div>
                <div className="mt-4 space-y-2 text-sm text-gray-400">
                  <p>階段: {report.e2e.metadata.stage}</p>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Timestamp */}
          <Card className="bg-gray-800 border-gray-700">
            <CardHeader>
              <CardTitle className="text-gray-100 text-lg">最後更新</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-gray-300">
                {new Date(report.timestamp).toLocaleTimeString("zh-TW")}
              </div>
              <div className="mt-2 text-sm text-gray-400">{new Date(report.timestamp).toLocaleDateString("zh-TW")}</div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
