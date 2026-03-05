#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
台股數據分析腳本
篩選強勢股、計算技術面/籌碼面評分、推薦Top 20股票
"""

import json
import os
import sys
from datetime import datetime
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


def calculate_technical_score(stock):
    """計算技術面評分（40分滿分）"""
    score = 0.0
    
    change_pct = stock.get('change_pct', 0)
    volume = stock.get('volume', 0)
    amplitude = stock.get('amplitude', 0)
    close = stock.get('close', 0)
    
    # 漲幅評分（0-20分）
    if change_pct >= 9.0:
        score += 18  # 接近漲停
    elif change_pct >= 7.0:
        score += 16
    elif change_pct >= 5.0:
        score += 14
    elif change_pct >= 3.0:
        score += 10
    elif change_pct >= 1.0:
        score += 5
    else:
        score += 0
    
    # 成交量評分（0-10分）- 相對評分，成交量越大越好
    if volume >= 50_000_000:
        score += 10
    elif volume >= 20_000_000:
        score += 8
    elif volume >= 10_000_000:
        score += 6
    elif volume >= 5_000_000:
        score += 4
    elif volume >= 1_000_000:
        score += 2
    else:
        score += 1
    
    # 振幅評分（0-10分）- 振幅適中最佳（3-8%為最佳）
    if 3.0 <= amplitude <= 8.0:
        score += 10
    elif 2.0 <= amplitude < 3.0 or 8.0 < amplitude <= 10.0:
        score += 7
    elif 1.0 <= amplitude < 2.0 or 10.0 < amplitude <= 12.0:
        score += 4
    else:
        score += 1
    
    return min(score, 40.0)


def calculate_chip_score(stock):
    """計算籌碼面評分（40分滿分）"""
    score = 0.0
    
    market_cap = stock.get('market_cap', 0)
    volume = stock.get('volume', 0)
    close = stock.get('close', 0)
    
    # 市值評分（0-20分）- 偏好中小型股
    if market_cap > 0:
        market_cap_b = market_cap / 1e9  # 轉換為十億
        if market_cap_b < 50:  # 小型股 < 500億
            score += 20
        elif market_cap_b < 200:  # 中型股 < 2000億
            score += 15
        elif market_cap_b < 500:  # 大型股 < 5000億
            score += 10
        else:  # 超大型股
            score += 5
    else:
        score += 10  # 無市值資料，給予中等分數
    
    # 流動性評分（0-20分）- 成交量*股價 = 成交金額
    turnover = volume * close  # 成交金額（元）
    turnover_m = turnover / 1e6  # 轉換為百萬
    
    if turnover_m >= 5000:  # 50億以上
        score += 20
    elif turnover_m >= 2000:  # 20億以上
        score += 16
    elif turnover_m >= 1000:  # 10億以上
        score += 12
    elif turnover_m >= 500:  # 5億以上
        score += 8
    elif turnover_m >= 100:  # 1億以上
        score += 4
    else:
        score += 1
    
    return min(score, 40.0)


def calculate_momentum_bonus(stock):
    """計算漲幅加成評分（20分滿分）"""
    change_pct = stock.get('change_pct', 0)
    
    # 漲幅加成：3-9.4%範圍內，越高越好
    if change_pct >= 8.0:
        return 20.0
    elif change_pct >= 7.0:
        return 17.0
    elif change_pct >= 6.0:
        return 14.0
    elif change_pct >= 5.0:
        return 11.0
    elif change_pct >= 4.0:
        return 8.0
    elif change_pct >= 3.0:
        return 5.0
    else:
        return 0.0


def generate_trading_prices(stock):
    """生成進場價、目標價、停損價"""
    close = stock.get('close', 0)
    change_pct = stock.get('change_pct', 0)
    amplitude = stock.get('amplitude', 0)
    high = stock.get('high', close)
    low = stock.get('low', close)
    
    # 進場價：收盤價附近（隔日開盤參考）
    entry_price = round(close * 1.005, 1)  # 略高於收盤價
    
    # 目標價：根據漲幅潛力設定（3-7%空間）
    if change_pct >= 7.0:
        target_pct = 0.05  # 已大漲，目標5%
    elif change_pct >= 5.0:
        target_pct = 0.07  # 目標7%
    else:
        target_pct = 0.10  # 目標10%
    
    target_price = round(close * (1 + target_pct), 1)
    
    # 停損價：收盤價下方3-5%
    stop_loss_pct = 0.04  # 停損4%
    stop_loss_price = round(close * (1 - stop_loss_pct), 1)
    
    # 風險報酬比
    risk = close - stop_loss_price
    reward = target_price - close
    rr_ratio = round(reward / risk, 2) if risk > 0 else 0
    
    return {
        "entry_price": entry_price,
        "target_price": target_price,
        "stop_loss_price": stop_loss_price,
        "risk_reward_ratio": rr_ratio
    }


def assess_risk_level(stock, total_score):
    """評估風險等級"""
    change_pct = stock.get('change_pct', 0)
    amplitude = stock.get('amplitude', 0)
    market_cap = stock.get('market_cap', 0)
    market_cap_b = market_cap / 1e9 if market_cap > 0 else 100
    
    if change_pct >= 7.0 or amplitude >= 10.0 or market_cap_b < 20:
        return "高風險"
    elif change_pct >= 5.0 or amplitude >= 6.0 or market_cap_b < 100:
        return "中高風險"
    elif change_pct >= 3.0 or amplitude >= 3.0:
        return "中風險"
    else:
        return "低風險"


def analyze_market_sentiment(stocks):
    """分析市場情緒"""
    if not stocks:
        return "無數據"
    
    total = len(stocks)
    rising = sum(1 for s in stocks if s['change_pct'] > 0)
    falling = sum(1 for s in stocks if s['change_pct'] < 0)
    strong = sum(1 for s in stocks if s['change_pct'] >= 3.0)
    near_limit = sum(1 for s in stocks if s['change_pct'] >= 7.0)
    
    rising_ratio = rising / total * 100
    
    if rising_ratio >= 80 and strong >= 10:
        sentiment = "極度樂觀"
        sentiment_score = 90
    elif rising_ratio >= 70 and strong >= 5:
        sentiment = "樂觀"
        sentiment_score = 75
    elif rising_ratio >= 60:
        sentiment = "偏多"
        sentiment_score = 60
    elif rising_ratio >= 40:
        sentiment = "中性"
        sentiment_score = 50
    elif rising_ratio >= 30:
        sentiment = "偏空"
        sentiment_score = 35
    else:
        sentiment = "悲觀"
        sentiment_score = 20
    
    avg_change = sum(s['change_pct'] for s in stocks) / total
    
    return {
        "sentiment": sentiment,
        "sentiment_score": sentiment_score,
        "total_stocks": total,
        "rising_count": rising,
        "falling_count": falling,
        "strong_count": strong,
        "near_limit_count": near_limit,
        "rising_ratio": round(rising_ratio, 1),
        "avg_change_pct": round(avg_change, 2)
    }


def main():
    logger.info("=" * 60)
    logger.info("台股數據分析開始")
    logger.info("=" * 60)
    
    # 讀取爬取數據
    input_path = "/home/ubuntu/stock_analysis/real_stocks_data.json"
    if not os.path.exists(input_path):
        logger.error(f"找不到數據文件：{input_path}")
        return 1
    
    with open(input_path, "r", encoding="utf-8") as f:
        raw_data = json.load(f)
    
    stocks = raw_data.get('stocks', [])
    fetch_date = raw_data.get('fetch_date', datetime.now().strftime("%Y-%m-%d"))
    logger.info(f"讀取到 {len(stocks)} 檔股票數據（日期：{fetch_date}）")
    
    # 步驟1：篩選強勢股
    logger.info("\n--- 篩選強勢股 ---")
    filtered_stocks = []
    
    for stock in stocks:
        change_pct = stock.get('change_pct', 0)
        
        # 排除漲停股（>= 9.5%）
        if change_pct >= 9.5:
            logger.info(f"排除漲停股：{stock['name']} ({stock['code']}) {change_pct:+.2f}%")
            continue
        
        # 最低漲幅 >= 3%
        if change_pct < 3.0:
            continue
        
        filtered_stocks.append(stock)
    
    logger.info(f"篩選後強勢股數量：{len(filtered_stocks)} 檔")
    
    # 步驟2：計算評分
    logger.info("\n--- 計算評分 ---")
    scored_stocks = []
    
    for stock in filtered_stocks:
        tech_score = calculate_technical_score(stock)
        chip_score = calculate_chip_score(stock)
        momentum_bonus = calculate_momentum_bonus(stock)
        total_score = tech_score + chip_score + momentum_bonus
        
        trading_prices = generate_trading_prices(stock)
        risk_level = assess_risk_level(stock, total_score)
        
        # 計算成交金額（億元）
        turnover_b = (stock.get('volume', 0) * stock.get('close', 0)) / 1e8
        
        scored_stock = {
            **stock,
            "tech_score": round(tech_score, 1),
            "chip_score": round(chip_score, 1),
            "momentum_bonus": round(momentum_bonus, 1),
            "total_score": round(total_score, 1),
            "entry_price": trading_prices["entry_price"],
            "target_price": trading_prices["target_price"],
            "stop_loss_price": trading_prices["stop_loss_price"],
            "risk_reward_ratio": trading_prices["risk_reward_ratio"],
            "risk_level": risk_level,
            "turnover_billion": round(turnover_b, 2)
        }
        scored_stocks.append(scored_stock)
        
        logger.info(f"{stock['name']} ({stock['code']}): "
                   f"漲幅={stock['change_pct']:+.2f}% "
                   f"技術={tech_score:.0f} 籌碼={chip_score:.0f} "
                   f"加成={momentum_bonus:.0f} 總分={total_score:.0f} "
                   f"風險={risk_level}")
    
    # 步驟3：排序，取Top 20
    scored_stocks.sort(key=lambda x: x['total_score'], reverse=True)
    top_stocks = scored_stocks[:20]
    
    logger.info(f"\n推薦Top {len(top_stocks)} 檔股票")
    
    # 步驟4：分析市場情緒
    market_sentiment = analyze_market_sentiment(stocks)
    logger.info(f"\n市場情緒：{market_sentiment['sentiment']} "
               f"（上漲比例：{market_sentiment['rising_ratio']}%，"
               f"平均漲幅：{market_sentiment['avg_change_pct']:+.2f}%）")
    
    # 步驟5：生成進場時機建議
    now = datetime.now()
    entry_suggestion = ""
    if now.hour < 9:
        entry_suggestion = "建議明日 09:15 開盤前觀察，09:30 確認強勢後進場"
    elif now.hour == 9 and now.minute < 30:
        entry_suggestion = "建議 09:30 確認開盤方向後進場"
    elif now.hour < 13:
        entry_suggestion = "建議 13:00 觀察午盤走勢，13:20 確認強勢後進場"
    else:
        entry_suggestion = "建議明日 09:15 開盤前觀察，09:30 確認強勢後進場（今日盤後分析）"
    
    # 步驟6：統計數據
    stats = {
        "analysis_date": fetch_date,
        "analysis_time": datetime.now().strftime("%Y-%m-%d %H:%M:%S"),
        "total_scanned": len(stocks),
        "strong_stocks": len(filtered_stocks),
        "recommended": len(top_stocks),
        "avg_score": round(sum(s['total_score'] for s in top_stocks) / len(top_stocks), 1) if top_stocks else 0,
        "max_change_pct": max((s['change_pct'] for s in top_stocks), default=0),
        "min_change_pct": min((s['change_pct'] for s in top_stocks), default=0),
    }
    
    # 輸出結果
    output = {
        "analysis_date": fetch_date,
        "analysis_time": datetime.now().strftime("%Y-%m-%d %H:%M:%S"),
        "market_sentiment": market_sentiment,
        "entry_suggestion": entry_suggestion,
        "statistics": stats,
        "top_stocks": top_stocks,
        "all_strong_stocks": scored_stocks
    }
    
    output_path = "/home/ubuntu/stock_analysis/latest_analysis.json"
    with open(output_path, "w", encoding="utf-8") as f:
        json.dump(output, f, ensure_ascii=False, indent=2)
    
    logger.info(f"\n分析結果已儲存至：{output_path}")
    
    # 顯示Top 10
    logger.info("\n=== Top 10 推薦股票 ===")
    for i, stock in enumerate(top_stocks[:10], 1):
        logger.info(f"{i:2d}. {stock['name']:<35} ({stock['code']}) "
                   f"漲幅={stock['change_pct']:+.2f}% "
                   f"收盤={stock['close']} "
                   f"總分={stock['total_score']} "
                   f"風險={stock['risk_level']}")
    
    logger.info("\n數據分析步驟完成 ✓")
    return 0


if __name__ == "__main__":
    sys.exit(main())
