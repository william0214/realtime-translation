# 台股每日自動分析系統

每日自動爬取 Yahoo Finance 台股數據，進行技術面與籌碼面分析，並發送 HTML 格式郵件報告。

## 系統架構

```
stock_analysis/
├── auto_daily_analysis.sh   # 完整自動化執行腳本（主入口）
├── real_data_crawler.py     # 數據爬取（Yahoo Finance API）
├── real_analyzer.py         # 技術面/籌碼面分析
├── send_email_report.py     # HTML 郵件報告發送
└── README.md
```

## 執行方式

```bash
# 完整流程一鍵執行
bash /home/ubuntu/stock_analysis/auto_daily_analysis.sh

# 或分步執行
python3 real_data_crawler.py    # 步驟1：爬取數據
python3 real_analyzer.py        # 步驟2：分析數據
python3 send_email_report.py    # 步驟3：發送報告
```

## 分析邏輯

### 篩選條件
- 最低漲幅：≥ 3%
- 排除漲停股：≥ 9.5%
- 排除 ETF，只分析個股

### 評分機制（滿分 100 分）
| 面向 | 權重 | 說明 |
|------|------|------|
| 技術面 | 40% | 漲幅 + 成交量 + 振幅 |
| 籌碼面 | 40% | 市值（偏好中小型）+ 流動性 |
| 漲幅加成 | 20% | 當日漲幅表現 |

### 報告內容
- 市場情緒分析（極度樂觀 / 樂觀 / 偏多 / 中性 / 偏空 / 悲觀）
- Top 10 推薦股票（含進場價、目標價、停損價）
- Top 11-20 候選股票
- 進場時機建議
- 操作策略說明
- 風險等級評估

## 執行時間

建議設定 cron 排程：週一至週五 14:30（盤後）

```bash
30 14 * * 1-5 bash /home/ubuntu/stock_analysis/auto_daily_analysis.sh
```

## 依賴套件

```bash
pip3 install yfinance
```

## 輸出文件

| 文件 | 說明 |
|------|------|
| `real_stocks_data.json` | 爬取的原始股票數據 |
| `latest_analysis.json` | 最新分析結果 |
| `report_YYYY-MM-DD.md` | Markdown 格式報告 |
| `logs/auto_analysis_YYYYMMDD.log` | 執行日誌（保留 7 天） |

---
*數據來源：Yahoo Finance | 免責聲明：本系統僅供參考，不構成投資建議*
