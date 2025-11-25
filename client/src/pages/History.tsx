import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { trpc } from "@/lib/trpc";
import { ArrowLeft, Download, FileJson, FileSpreadsheet } from "lucide-react";
import { useState } from "react";
import { Link } from "wouter";
import { toast } from "sonner";

type Conversation = {
  id: number;
  title: string;
  targetLanguage: string;
  createdAt: Date;
  endedAt: Date | null;
  translationCount: number;
};

type Translation = {
  id: number;
  direction: string;
  sourceLang: string;
  targetLang: string;
  sourceText: string;
  translatedText: string;
  createdAt: Date;
};

const LANGUAGE_MAP: Record<string, string> = {
  vi: "越南語",
  id: "印尼語",
  fil: "菲律賓語",
  en: "英文",
  it: "義大利語",
  ja: "日文",
  ko: "韓文",
  th: "泰文",
  zh: "中文",
};

export default function History() {
  const [selectedConversationId, setSelectedConversationId] = useState<number | null>(null);
  const [languageFilter, setLanguageFilter] = useState<string>("all");
  const [dateFilter, setDateFilter] = useState<string>("all");

  // Fetch conversations
  const { data: conversationsData, isLoading } = trpc.conversation.list.useQuery({
    limit: 100,
  });

  // Fetch selected conversation details
  const { data: conversationDetails } = trpc.conversation.getWithTranslations.useQuery(
    { conversationId: selectedConversationId! },
    { enabled: selectedConversationId !== null }
  );

  const conversations = conversationsData?.conversations || [];

  // Filter conversations
  const filteredConversations = conversations.filter((conv) => {
    // Language filter
    if (languageFilter !== "all" && conv.targetLanguage !== languageFilter) {
      return false;
    }

    // Date filter
    if (dateFilter !== "all") {
      const convDate = new Date(conv.createdAt);
      const today = new Date();
      const diffDays = Math.floor((today.getTime() - convDate.getTime()) / (1000 * 60 * 60 * 24));

      if (dateFilter === "today" && diffDays !== 0) return false;
      if (dateFilter === "week" && diffDays > 7) return false;
      if (dateFilter === "month" && diffDays > 30) return false;
    }

    return true;
  });

  // Export to CSV
  const exportToCSV = (conversationId: number) => {
    const conv = conversations.find((c) => c.id === conversationId);
    if (!conv || !conversationDetails?.translations) {
      toast.error("無法匯出對話");
      return;
    }

    const translations = conversationDetails.translations;
    const csvHeader = "時間,方向,原文語言,譯文語言,原文,譯文\n";
    const csvRows = translations
      .map((t: Translation) => {
        const time = new Date(t.createdAt).toLocaleString("zh-TW");
        const direction = t.direction === "nurse_to_patient" ? "台灣人→外國人" : "外國人→台灣人";
        return `"${time}","${direction}","${LANGUAGE_MAP[t.sourceLang] || t.sourceLang}","${LANGUAGE_MAP[t.targetLang] || t.targetLang}","${t.sourceText.replace(/"/g, '""')}","${t.translatedText.replace(/"/g, '""')}"`;
      })
      .join("\n");

    const csv = csvHeader + csvRows;
    const blob = new Blob(["\ufeff" + csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `對話記錄_${conv.title}_${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);

    toast.success("已匯出 CSV 檔案");
  };

  // Export to JSON
  const exportToJSON = (conversationId: number) => {
    const conv = conversations.find((c) => c.id === conversationId);
    if (!conv || !conversationDetails?.translations) {
      toast.error("無法匯出對話");
      return;
    }

    const data = {
      conversation: conv,
      translations: conversationDetails.translations,
    };

    const json = JSON.stringify(data, null, 2);
    const blob = new Blob([json], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `對話記錄_${conv.title}_${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);

    toast.success("已匯出 JSON 檔案");
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-blue-900 to-slate-900 text-white p-4 md:p-8">
      {/* Header */}
      <div className="max-w-6xl mx-auto mb-8">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-4">
            <Link href="/">
              <Button variant="outline" size="sm">
                <ArrowLeft className="w-4 h-4 mr-2" />
                返回
              </Button>
            </Link>
            <h1 className="text-2xl md:text-3xl font-bold">對話歷史</h1>
          </div>
        </div>

        {/* Filters */}
        <div className="flex flex-col md:flex-row gap-4 mb-6">
          <Select value={languageFilter} onValueChange={setLanguageFilter}>
            <SelectTrigger className="w-full md:w-48 bg-slate-800 border-slate-700">
              <SelectValue placeholder="選擇語言" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">所有語言</SelectItem>
              {Object.entries(LANGUAGE_MAP).map(([code, name]) => (
                <SelectItem key={code} value={code}>
                  {name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select value={dateFilter} onValueChange={setDateFilter}>
            <SelectTrigger className="w-full md:w-48 bg-slate-800 border-slate-700">
              <SelectValue placeholder="選擇日期" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">所有日期</SelectItem>
              <SelectItem value="today">今天</SelectItem>
              <SelectItem value="week">最近 7 天</SelectItem>
              <SelectItem value="month">最近 30 天</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Conversation List */}
      <div className="max-w-6xl mx-auto">
        {isLoading ? (
          <div className="text-center py-12">
            <p className="text-gray-400">載入中...</p>
          </div>
        ) : filteredConversations.length === 0 ? (
          <div className="text-center py-12">
            <p className="text-gray-400">沒有對話記錄</p>
          </div>
        ) : (
          <div className="grid gap-4">
            {filteredConversations.map((conv) => (
              <Card
                key={conv.id}
                className="bg-slate-800/50 border-slate-700 hover:bg-slate-800/70 transition-colors cursor-pointer"
                onClick={() => setSelectedConversationId(conv.id)}
              >
                <CardHeader>
                  <div className="flex items-start justify-between">
                    <div>
                      <CardTitle className="text-lg text-white">{conv.title}</CardTitle>
                      <p className="text-sm text-gray-400 mt-1">
                        {new Date(conv.createdAt).toLocaleString("zh-TW")}
                      </p>
                    </div>
                    <div className="flex gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={(e) => {
                          e.stopPropagation();
                          setSelectedConversationId(conv.id);
                          setTimeout(() => exportToCSV(conv.id), 500);
                        }}
                      >
                        <FileSpreadsheet className="w-4 h-4" />
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={(e) => {
                          e.stopPropagation();
                          setSelectedConversationId(conv.id);
                          setTimeout(() => exportToJSON(conv.id), 500);
                        }}
                      >
                        <FileJson className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="flex items-center gap-4 text-sm text-gray-400">
                    <span>目標語言: {LANGUAGE_MAP[conv.targetLanguage] || conv.targetLanguage}</span>
                    <span>•</span>
                    <span>{conv.translationCount} 條翻譯</span>
                    {conv.endedAt && (
                      <>
                        <span>•</span>
                        <span>已結束</span>
                      </>
                    )}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>

      {/* Conversation Detail Dialog */}
      <Dialog open={selectedConversationId !== null} onOpenChange={(open) => !open && setSelectedConversationId(null)}>
        <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto bg-slate-900 border-slate-700">
          <DialogHeader>
            <DialogTitle className="text-white">
              {conversationDetails?.conversation?.title || "對話詳情"}
            </DialogTitle>
          </DialogHeader>

          {conversationDetails?.translations && conversationDetails.translations.length > 0 ? (
            <div className="space-y-4">
              {conversationDetails.translations.map((translation: Translation) => (
                <Card key={translation.id} className="bg-slate-800/50 border-slate-700">
                  <CardContent className="pt-4">
                    <div className="flex items-start justify-between mb-2">
                      <span className="text-sm text-gray-400">
                        {new Date(translation.createdAt).toLocaleTimeString("zh-TW")}
                      </span>
                      <span className="text-sm text-blue-400">
                        {translation.direction === "nurse_to_patient" ? "台灣人 → 外國人" : "外國人 → 台灣人"}
                      </span>
                    </div>
                    <div className="space-y-2">
                      <div>
                        <p className="text-xs text-gray-500 mb-1">
                          原文 ({LANGUAGE_MAP[translation.sourceLang] || translation.sourceLang})
                        </p>
                        <p className="text-white">{translation.sourceText}</p>
                      </div>
                      <div>
                        <p className="text-xs text-gray-500 mb-1">
                          譯文 ({LANGUAGE_MAP[translation.targetLang] || translation.targetLang})
                        </p>
                        <p className="text-blue-300">{translation.translatedText}</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : (
            <p className="text-center text-gray-400 py-8">此對話沒有翻譯記錄</p>
          )}

          <div className="flex justify-end gap-2 mt-4">
            <Button
              variant="outline"
              onClick={() => selectedConversationId && exportToCSV(selectedConversationId)}
            >
              <Download className="w-4 h-4 mr-2" />
              匯出 CSV
            </Button>
            <Button
              variant="outline"
              onClick={() => selectedConversationId && exportToJSON(selectedConversationId)}
            >
              <Download className="w-4 h-4 mr-2" />
              匯出 JSON
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
