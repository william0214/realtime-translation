import { useEffect } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Loader2, MessageSquare, Clock, FileText } from "lucide-react";
import { useLocation } from "wouter";
import { toast } from "sonner";

/**
 * 對話列表頁面
 * 
 * 顯示所有對話記錄，供後台人員查看
 */
export default function ConversationList() {
  const [, setLocation] = useLocation();
  
  // Fetch conversations
  const { data, isLoading, refetch } = trpc.conversation.list.useQuery({ limit: 50 });

  useEffect(() => {
    // Auto-refresh every 30 seconds
    const interval = setInterval(() => {
      refetch();
    }, 30000);

    return () => clearInterval(interval);
  }, [refetch]);

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-950">
        <Loader2 className="w-8 h-8 animate-spin text-blue-400" />
      </div>
    );
  }

  const conversations = data?.conversations || [];

  return (
    <div className="min-h-screen bg-gray-950 text-white">
      {/* Header */}
      <header className="border-b border-gray-800 bg-gray-900/50 backdrop-blur-sm sticky top-0 z-10">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold">對話記錄管理</h1>
              <p className="text-sm text-gray-400 mt-1">查看所有對話記錄、翻譯內容與摘要</p>
            </div>
            <Button
              variant="outline"
              onClick={() => setLocation("/")}
            >
              返回首頁
            </Button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="container mx-auto px-4 py-6">
        {/* Stats */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
          <Card className="bg-gray-900 border-gray-800">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium text-gray-400">總對話數</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{conversations.length}</div>
            </CardContent>
          </Card>
          
          <Card className="bg-gray-900 border-gray-800">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium text-gray-400">總翻譯數</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {conversations.reduce((sum, conv) => sum + (conv.translationCount || 0), 0)}
              </div>
            </CardContent>
          </Card>
          
          <Card className="bg-gray-900 border-gray-800">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium text-gray-400">進行中</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {conversations.filter(conv => !conv.endedAt).length}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Conversation List */}
        {conversations.length === 0 ? (
          <Card className="bg-gray-900 border-gray-800">
            <CardContent className="flex flex-col items-center justify-center py-12">
              <MessageSquare className="w-12 h-12 text-gray-600 mb-4" />
              <p className="text-gray-400">尚無對話記錄</p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-4">
            {conversations.map((conversation) => {
              const duration = conversation.endedAt
                ? Math.round((new Date(conversation.endedAt).getTime() - new Date(conversation.startedAt).getTime()) / 1000 / 60)
                : null;

              return (
                <Card
                  key={conversation.id}
                  className="bg-gray-900 border-gray-800 hover:border-blue-500/50 transition-colors cursor-pointer"
                  onClick={() => setLocation(`/conversation/${conversation.id}`)}
                >
                  <CardHeader>
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <CardTitle className="text-lg flex items-center gap-2">
                          <MessageSquare className="w-5 h-5 text-blue-400" />
                          {conversation.title || `對話 #${conversation.id}`}
                        </CardTitle>
                        <CardDescription className="mt-2 flex items-center gap-4 text-sm">
                          <span className="flex items-center gap-1">
                            <Clock className="w-4 h-4" />
                            {new Date(conversation.startedAt).toLocaleString("zh-TW")}
                          </span>
                          {duration !== null && (
                            <span className="text-gray-500">
                              時長: {duration} 分鐘
                            </span>
                          )}
                        </CardDescription>
                      </div>
                      
                      <div className="flex flex-col items-end gap-2">
                        {!conversation.endedAt && (
                          <span className="px-2 py-1 text-xs rounded-full bg-green-500/20 text-green-400 border border-green-500/30">
                            進行中
                          </span>
                        )}
                        <span className="text-sm text-gray-400">
                          目標語言: {conversation.targetLanguage}
                        </span>
                      </div>
                    </div>
                  </CardHeader>
                  
                  <CardContent>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-4 text-sm text-gray-400">
                        <span className="flex items-center gap-1">
                          <FileText className="w-4 h-4" />
                          {conversation.translationCount || 0} 則翻譯
                        </span>
                      </div>
                      
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={(e) => {
                          e.stopPropagation();
                          setLocation(`/conversation/${conversation.id}`);
                        }}
                      >
                        查看詳情
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </main>
    </div>
  );
}
