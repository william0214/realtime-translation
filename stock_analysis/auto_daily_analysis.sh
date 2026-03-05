#!/bin/bash
# 台股每日自動分析系統
# 執行時間：週一至週五 14:30（盤後）

WORK_DIR="/home/ubuntu/stock_analysis"
LOG_DIR="$WORK_DIR/logs"
TODAY=$(date +%Y%m%d)
LOG_FILE="$LOG_DIR/auto_analysis_$TODAY.log"

# 建立目錄
mkdir -p "$LOG_DIR"

echo "========================================" | tee -a "$LOG_FILE"
echo "台股每日自動分析系統啟動" | tee -a "$LOG_FILE"
echo "執行時間：$(date '+%Y-%m-%d %H:%M:%S')" | tee -a "$LOG_FILE"
echo "========================================" | tee -a "$LOG_FILE"

# 步驟1：數據爬取
echo "" | tee -a "$LOG_FILE"
echo "[步驟 1/3] 開始數據爬取..." | tee -a "$LOG_FILE"
python3 "$WORK_DIR/real_data_crawler.py" 2>&1 | tee -a "$LOG_FILE"
STEP1_EXIT=${PIPESTATUS[0]}

if [ $STEP1_EXIT -ne 0 ]; then
    echo "[錯誤] 數據爬取失敗（退出碼：$STEP1_EXIT），終止後續步驟" | tee -a "$LOG_FILE"
    exit 1
fi
echo "[步驟 1/3] 數據爬取完成 ✓" | tee -a "$LOG_FILE"

# 步驟2：數據分析
echo "" | tee -a "$LOG_FILE"
echo "[步驟 2/3] 開始數據分析..." | tee -a "$LOG_FILE"
python3 "$WORK_DIR/real_analyzer.py" 2>&1 | tee -a "$LOG_FILE"
STEP2_EXIT=${PIPESTATUS[0]}

if [ $STEP2_EXIT -ne 0 ]; then
    echo "[錯誤] 數據分析失敗（退出碼：$STEP2_EXIT），終止後續步驟" | tee -a "$LOG_FILE"
    exit 2
fi
echo "[步驟 2/3] 數據分析完成 ✓" | tee -a "$LOG_FILE"

# 步驟3：發送郵件報告
echo "" | tee -a "$LOG_FILE"
echo "[步驟 3/3] 開始發送郵件報告..." | tee -a "$LOG_FILE"
python3 "$WORK_DIR/send_email_report.py" 2>&1 | tee -a "$LOG_FILE"
STEP3_EXIT=${PIPESTATUS[0]}

if [ $STEP3_EXIT -ne 0 ]; then
    echo "[錯誤] 郵件發送失敗（退出碼：$STEP3_EXIT）" | tee -a "$LOG_FILE"
    exit 3
fi
echo "[步驟 3/3] 郵件報告發送完成 ✓" | tee -a "$LOG_FILE"

# 清理7天前的日誌
find "$LOG_DIR" -name "auto_analysis_*.log" -mtime +7 -delete
echo "" | tee -a "$LOG_FILE"
echo "========================================" | tee -a "$LOG_FILE"
echo "所有步驟執行完成！" | tee -a "$LOG_FILE"
echo "結束時間：$(date '+%Y-%m-%d %H:%M:%S')" | tee -a "$LOG_FILE"
echo "========================================" | tee -a "$LOG_FILE"

exit 0
