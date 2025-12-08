import { useEffect, useState } from "react";
import { useRoute, useLocation } from "wouter";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Loader2, ArrowLeft, Sparkles, FileText, Clock, User } from "lucide-react";
import { toast } from "sonner";

/**
 * 對話詳情頁面
 * 
 * 顯示完整對話記錄、翻譯內容與 AI 摘要
 */
export default function ConversationDetail() {
  const [, params] = useRoute("/conversation/:id");
  const [, setLocation] = useLocation();
  const conversationId = params?.id ? parseInt(params.id) : null;

  const [isGeneratingSummary, setIsGeneratingSummary] = useState(false);

  // Fetch conversation with translations
  const { data: conversationData, isLoading: isLoadingConversation, refetch: refetchConversation } = trpc.conversation.getWithTranslations.useQuery(
    { conversationId: conversationId! },
    { enabled: !!conversationId }
  );

  // Fetch summary
  const { data: summaryData, isLoading: isLoadingSummary, refetch: refetchSummary } = trpc.conversation.getSummary.useQuery(
    { conversationId: conversationId! },
    { enabled: !!conversationId }
  );

  // Generate summary mutation
  const generateSummaryMutation = trpc.conversation.generateSummary.useMutation();

  const handleGenerateSummary = async () => {
    if (!conversationId) return;

    setIsGeneratingSummary(true);
    try {
      const result = await generateSummaryMutation.mutateAsync({ conversationId });
      
      if (result.success) {
        toast.success("摘要生成成功！");
        refetchSummary();
      } else {
        toast.error(`摘要生成失敗: ${result.error}`);
      }
    } catch (error: any) {
      toast.error(`摘要生成失敗: ${error.message || "未知錯誤"}`);
    } finally {
      setIsGeneratingSummary(false);
    }
  };

  if (!conversationId) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-950 text-white">
        <p>無效的對話 ID</p>
      </div>
    );
  }

  if (isLoadingConversation) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-950">
        <Loader2 className="w-8 h-8 animate-spin text-blue-400" />
      </div>
    );
  }

  const conversation = conversationData?.conversation;
  const translations = conversationData?.translations || [];
  const summary = summaryData?.summary;

  if (!conversation) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-950 text-white">
        <p>找不到對話記錄</p>
      </div>
    );
  }

  const duration = conversation.endedAt
    ? Math.round((new Date(conversation.endedAt).getTime() - new Date(conversation.startedAt).getTime()) / 1000 / 60)
    : null;

  return (
    <div className="min-h-screen bg-gray-950 text-white">
      {/* Header */}
      <header className="border-b border-gray-800 bg-gray-900/50 backdrop-blur-sm sticky top-0 z-10">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setLocation("/conversations")}
              >
                <ArrowLeft className="w-4 h-4 mr-2" />
                返回列表
              </Button>
              <div>
                <h1 className="text-2xl font-bold">{conversation.title || `對話 #${conversation.id}`}</h1>
                <p className="text-sm text-gray-400 mt-1">
                  {new Date(conversation.startedAt).toLocaleString("zh-TW")}
                  {duration !== null && ` · 時長 ${duration} 分鐘`}
                </p>
              </div>
            </div>
            
            {!conversation.endedAt && (
              <span className="px-3 py-1 text-sm rounded-full bg-green-500/20 text-green-400 border border-green-500/30">
                進行中
              </span>
            )}
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="container mx-auto px-4 py-6">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left Column: Conversation Details */}
          <div className="lg:col-span-2 space-y-6">
            {/* Info Card */}
            <Card className="bg-gray-900 border-gray-800">
              <CardHeader>
                <CardTitle className="text-lg">對話資訊</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-gray-400">對話 ID:</span>
                  <span>{conversation.id}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-400">目標語言:</span>
                  <span>{conversation.targetLanguage}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-400">開始時間:</span>
                  <span>{new Date(conversation.startedAt).toLocaleString("zh-TW")}</span>
                </div>
                {conversation.endedAt && (
                  <div className="flex justify-between">
                    <span className="text-gray-400">結束時間:</span>
                    <span>{new Date(conversation.endedAt).toLocaleString("zh-TW")}</span>
                  </div>
                )}
                <div className="flex justify-between">
                  <span className="text-gray-400">翻譯數量:</span>
                  <span>{translations.length}</span>
                </div>
              </CardContent>
            </Card>

            {/* Translations */}
            <Card className="bg-gray-900 border-gray-800">
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <FileText className="w-5 h-5 text-blue-400" />
                  完整對話記錄
                </CardTitle>
                <CardDescription>
                  共 {translations.length} 則翻譯
                </CardDescription>
              </CardHeader>
              <CardContent>
                {translations.length === 0 ? (
                  <p className="text-gray-400 text-center py-8">尚無翻譯記錄</p>
                ) : (
                  <div className="space-y-4">
                    {translations.map((translation, index) => {
                      const isNurse = translation.direction === "nurse_to_patient";
                      
                      return (
                        <div
                          key={translation.id}
                          className={`p-4 rounded-lg border ${
                            isNurse
                              ? "bg-blue-500/10 border-blue-500/30"
                              : "bg-green-500/10 border-green-500/30"
                          }`}
                        >
                          <div className="flex items-start gap-3">
                            <User className={`w-5 h-5 mt-1 ${isNurse ? "text-blue-400" : "text-green-400"}`} />
                            <div className="flex-1">
                              <div className="flex items-center justify-between mb-2">
                                <span className={`font-medium ${isNurse ? "text-blue-400" : "text-green-400"}`}>
                                  {isNurse ? "護理人員" : "病患"}
                                </span>
                                <span className="text-xs text-gray-500">
                                  {new Date(translation.createdAt).toLocaleTimeString("zh-TW")}
                                </span>
                              </div>
                              
                              <div className="space-y-2">
                                <div>
                                  <span className="text-xs text-gray-400 block mb-1">原文 ({translation.sourceLang}):</span>
                                  <p className="text-white">{translation.sourceText}</p>
                                </div>
                                
                                <div>
                                  <span className="text-xs text-gray-400 block mb-1">翻譯 ({translation.targetLang}):</span>
                                  <p className="text-gray-300">{translation.translatedText}</p>
                                </div>
                              </div>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Right Column: Summary */}
          <div className="space-y-6">
            <Card className="bg-gray-900 border-gray-800">
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <Sparkles className="w-5 h-5 text-purple-400" />
                  AI 對話摘要
                </CardTitle>
                <CardDescription>
                  使用 AI 自動生成對話摘要與關鍵要點
                </CardDescription>
              </CardHeader>
              <CardContent>
                {isLoadingSummary ? (
                  <div className="flex items-center justify-center py-8">
                    <Loader2 className="w-6 h-6 animate-spin text-purple-400" />
                  </div>
                ) : summary ? (
                  <div className="space-y-4">
                    <div>
                      <h3 className="text-sm font-medium text-gray-400 mb-2">摘要</h3>
                      <p className="text-white leading-relaxed">{summary.summary}</p>
                    </div>
                    
                    {summary.keyPoints && (
                      <div>
                        <h3 className="text-sm font-medium text-gray-400 mb-2">關鍵要點</h3>
                        <ul className="space-y-2">
                          {summary.keyPoints.split("|").map((point, index) => (
                            <li key={index} className="flex items-start gap-2">
                              <span className="text-purple-400 mt-1">•</span>
                              <span className="text-gray-300">{point.trim()}</span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                    
                    <div className="pt-4 border-t border-gray-800 text-xs text-gray-500">
                      <div className="flex justify-between">
                        <span>訊息數量:</span>
                        <span>{summary.messageCount}</span>
                      </div>
                      <div className="flex justify-between mt-1">
                        <span>更新時間:</span>
                        <span>{new Date(summary.updatedAt).toLocaleString("zh-TW")}</span>
                      </div>
                    </div>
                    
                    <Button
                      variant="outline"
                      size="sm"
                      className="w-full"
                      onClick={handleGenerateSummary}
                      disabled={isGeneratingSummary}
                    >
                      {isGeneratingSummary ? (
                        <>
                          <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                          重新生成中...
                        </>
                      ) : (
                        <>
                          <Sparkles className="w-4 h-4 mr-2" />
                          重新生成摘要
                        </>
                      )}
                    </Button>
                  </div>
                ) : (
                  <div className="text-center py-8">
                    <Sparkles className="w-12 h-12 text-gray-600 mx-auto mb-4" />
                    <p className="text-gray-400 mb-4">尚未生成摘要</p>
                    <Button
                      variant="default"
                      onClick={handleGenerateSummary}
                      disabled={isGeneratingSummary || translations.length === 0}
                    >
                      {isGeneratingSummary ? (
                        <>
                          <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                          生成中...
                        </>
                      ) : (
                        <>
                          <Sparkles className="w-4 h-4 mr-2" />
                          生成 AI 摘要
                        </>
                      )}
                    </Button>
                    {translations.length === 0 && (
                      <p className="text-xs text-gray-500 mt-2">需要至少一則翻譯記錄才能生成摘要</p>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      </main>
    </div>
  );
}
