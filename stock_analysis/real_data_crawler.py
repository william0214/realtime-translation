#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
台股數據爬取腳本
使用 Yahoo Finance API 獲取50檔熱門台股數據
"""

import yfinance as yf
import json
import os
import sys
from datetime import datetime, date
import time
import logging

# 設定日誌
log_dir = "/home/ubuntu/stock_analysis/logs"
os.makedirs(log_dir, exist_ok=True)
today_str = datetime.now().strftime("%Y%m%d")
log_file = os.path.join(log_dir, f"auto_analysis_{today_str}.log")

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(message)s",
    handlers=[
        logging.FileHandler(log_file, encoding="utf-8"),
        logging.StreamHandler(sys.stdout)
    ]
)
logger = logging.getLogger(__name__)

# 50檔熱門台股（涵蓋電子、金融、傳產、小型股）
TAIWAN_STOCKS = [
    # 電子大型股
    "2330.TW",  # 台積電
    "2317.TW",  # 鴻海
    "2454.TW",  # 聯發科
    "2308.TW",  # 台達電
    "3711.TW",  # 日月光投控
    "2382.TW",  # 廣達
    "2357.TW",  # 華碩
    "2379.TW",  # 瑞昱
    "2395.TW",  # 研華
    "3034.TW",  # 聯詠
    # 半導體/IC設計
    "2303.TW",  # 聯電
    "2344.TW",  # 華邦電
    "2408.TW",  # 南亞科
    "2449.TW",  # 京元電子
    "3443.TW",  # 創意
    "6415.TW",  # 矽力-KY
    "2337.TW",  # 旺宏
    "3006.TW",  # 晶豪科
    "4966.TW",  # 譜瑞-KY
    "6770.TW",  # 力積電
    # 金融股
    "2882.TW",  # 國泰金
    "2881.TW",  # 富邦金
    "2891.TW",  # 中信金
    "2886.TW",  # 兆豐金
    "2884.TW",  # 玉山金
    # 傳產/其他
    "1301.TW",  # 台塑
    "1303.TW",  # 南亞
    "1326.TW",  # 台化
    "2002.TW",  # 中鋼
    "1101.TW",  # 台泥
    # 中小型活躍股
    "6669.TW",  # 緯穎
    "2376.TW",  # 技嘉
    "2377.TW",  # 微星
    "3231.TW",  # 緯創
    "4938.TW",  # 和碩
    "2353.TW",  # 宏碁
    "2356.TW",  # 英業達
    "3045.TW",  # 台灣大
    "4904.TW",  # 遠傳
    "2412.TW",  # 中華電
    # 小型/活躍股
    "6488.TW",  # 環球晶
    "3035.TW",  # 智原
    "5483.TW",  # 中美晶
    "3037.TW",  # 欣興
    "2360.TW",  # 致茂
    "6271.TW",  # 同欣電
    "3533.TW",  # 嘉澤
    "6239.TW",  # 力成
    "8046.TW",  # 南電
    "3661.TW",  # 世芯-KY
]

def fetch_stock_data(ticker_symbol):
    """獲取單一股票數據"""
    try:
        ticker = yf.Ticker(ticker_symbol)
        
        # 獲取近5天歷史數據
        hist = ticker.history(period="5d")
        
        if hist.empty or len(hist) < 1:
            logger.warning(f"{ticker_symbol}: 無法獲取歷史數據")
            return None
        
        # 取最新一天數據
        latest = hist.iloc[-1]
        prev = hist.iloc[-2] if len(hist) >= 2 else None
        
        close_price = float(latest['Close'])
        open_price = float(latest['Open'])
        high_price = float(latest['High'])
        low_price = float(latest['Low'])
        volume = int(latest['Volume'])
        
        # 計算漲跌幅
        if prev is not None:
            prev_close = float(prev['Close'])
            change_pct = ((close_price - prev_close) / prev_close) * 100
            change_amount = close_price - prev_close
        else:
            change_pct = ((close_price - open_price) / open_price) * 100
            change_amount = close_price - open_price
        
        # 計算振幅
        amplitude = ((high_price - low_price) / low_price) * 100 if low_price > 0 else 0
        
        # 獲取股票基本資訊
        info = {}
        try:
            info = ticker.info
        except Exception:
            pass
        
        market_cap = info.get('marketCap', 0) or 0
        short_name = info.get('shortName', ticker_symbol.replace('.TW', ''))
        long_name = info.get('longName', short_name)
        
        # 過濾ETF（名稱包含ETF或代碼特徵）
        if 'ETF' in short_name.upper() or 'ETF' in long_name.upper():
            logger.info(f"{ticker_symbol}: 跳過ETF")
            return None
        
        stock_code = ticker_symbol.replace('.TW', '')
        
        return {
            "code": stock_code,
            "ticker": ticker_symbol,
            "name": short_name,
            "close": round(close_price, 2),
            "open": round(open_price, 2),
            "high": round(high_price, 2),
            "low": round(low_price, 2),
            "volume": volume,
            "change_pct": round(change_pct, 2),
            "change_amount": round(change_amount, 2),
            "amplitude": round(amplitude, 2),
            "market_cap": market_cap,
            "fetch_time": datetime.now().strftime("%Y-%m-%d %H:%M:%S")
        }
        
    except Exception as e:
        logger.error(f"{ticker_symbol}: 爬取失敗 - {str(e)}")
        return None

def main():
    logger.info("=" * 60)
    logger.info("台股數據爬取開始")
    logger.info(f"目標股票數量：{len(TAIWAN_STOCKS)}")
    logger.info("=" * 60)
    
    stocks_data = []
    success_count = 0
    fail_count = 0
    
    for i, ticker in enumerate(TAIWAN_STOCKS, 1):
        logger.info(f"[{i}/{len(TAIWAN_STOCKS)}] 爬取 {ticker}...")
        data = fetch_stock_data(ticker)
        
        if data:
            stocks_data.append(data)
            success_count += 1
            logger.info(f"  成功：{data['name']} ({data['code']}) "
                       f"收盤={data['close']} 漲跌={data['change_pct']:+.2f}%")
        else:
            fail_count += 1
        
        # 避免請求過快
        if i % 10 == 0:
            time.sleep(1)
    
    logger.info(f"\n爬取完成：成功 {success_count} 檔，失敗 {fail_count} 檔")
    
    # 輸出結果
    output = {
        "fetch_date": datetime.now().strftime("%Y-%m-%d"),
        "fetch_time": datetime.now().strftime("%Y-%m-%d %H:%M:%S"),
        "total_count": len(stocks_data),
        "stocks": stocks_data
    }
    
    output_path = "/home/ubuntu/stock_analysis/real_stocks_data.json"
    with open(output_path, "w", encoding="utf-8") as f:
        json.dump(output, f, ensure_ascii=False, indent=2)
    
    logger.info(f"數據已儲存至：{output_path}")
    logger.info("數據爬取步驟完成 ✓")
    
    return 0 if success_count > 0 else 1

if __name__ == "__main__":
    sys.exit(main())
