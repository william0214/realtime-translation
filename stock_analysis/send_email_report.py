#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
台股分析報告郵件發送腳本
讀取 latest_analysis.json，生成 HTML 格式郵件並發送
"""

import json
import os
import sys
import smtplib
import logging
from datetime import datetime
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText
from email.mime.base import MIMEBase
from email import encoders

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

# Gmail 設定
GMAIL_USER = "william0214@gmail.com"
GMAIL_APP_PASSWORD = "mbvg fhbx axrp hwua"
RECIPIENT = "william0214@gmail.com"


def get_sentiment_color(sentiment):
    """根據市場情緒返回顏色"""
    colors = {
        "極度樂觀": "#00c853",
        "樂觀": "#4caf50",
        "偏多": "#8bc34a",
        "中性": "#ff9800",
        "偏空": "#ff5722",
        "悲觀": "#f44336"
    }
    return colors.get(sentiment, "#607d8b")


def get_risk_color(risk_level):
    """根據風險等級返回顏色"""
    colors = {
        "高風險": "#f44336",
        "中高風險": "#ff9800",
        "中風險": "#ffc107",
        "低風險": "#4caf50"
    }
    return colors.get(risk_level, "#607d8b")


def get_change_color(change_pct):
    """根據漲跌幅返回顏色"""
    if change_pct >= 5.0:
        return "#c62828"
    elif change_pct >= 3.0:
        return "#e53935"
    elif change_pct > 0:
        return "#ef9a9a"
    elif change_pct == 0:
        return "#757575"
    else:
        return "#1565c0"


def generate_html_report(analysis_data):
    """生成 HTML 格式報告"""
    
    analysis_date = analysis_data.get('analysis_date', datetime.now().strftime("%Y-%m-%d"))
    analysis_time = analysis_data.get('analysis_time', datetime.now().strftime("%Y-%m-%d %H:%M:%S"))
    sentiment_data = analysis_data.get('market_sentiment', {})
    entry_suggestion = analysis_data.get('entry_suggestion', '')
    stats = analysis_data.get('statistics', {})
    top_stocks = analysis_data.get('top_stocks', [])
    
    sentiment = sentiment_data.get('sentiment', '中性')
    sentiment_color = get_sentiment_color(sentiment)
    sentiment_score = sentiment_data.get('sentiment_score', 50)
    
    # 生成 Top 10 股票表格行
    stock_rows = ""
    for i, stock in enumerate(top_stocks[:10], 1):
        change_pct = stock.get('change_pct', 0)
        change_color = get_change_color(change_pct)
        risk_level = stock.get('risk_level', '中風險')
        risk_color = get_risk_color(risk_level)
        
        # 排名標記
        rank_badge = ""
        if i == 1:
            rank_badge = "🥇"
        elif i == 2:
            rank_badge = "🥈"
        elif i == 3:
            rank_badge = "🥉"
        else:
            rank_badge = f"{i}"
        
        stock_rows += f"""
        <tr style="border-bottom: 1px solid #f0f0f0;">
            <td style="padding: 10px 8px; text-align: center; font-weight: bold; font-size: 16px;">{rank_badge}</td>
            <td style="padding: 10px 8px;">
                <div style="font-weight: bold; color: #1a1a2e; font-size: 14px;">{stock.get('name', 'N/A')}</div>
                <div style="color: #666; font-size: 12px;">{stock.get('code', 'N/A')}</div>
            </td>
            <td style="padding: 10px 8px; text-align: right; font-weight: bold; font-size: 14px;">NT${stock.get('close', 0):,.1f}</td>
            <td style="padding: 10px 8px; text-align: right; font-weight: bold; color: {change_color}; font-size: 15px;">{change_pct:+.2f}%</td>
            <td style="padding: 10px 8px; text-align: right; color: #555; font-size: 13px;">NT${stock.get('entry_price', 0):,.1f}</td>
            <td style="padding: 10px 8px; text-align: right; color: #c62828; font-size: 13px;">NT${stock.get('target_price', 0):,.1f}</td>
            <td style="padding: 10px 8px; text-align: right; color: #1565c0; font-size: 13px;">NT${stock.get('stop_loss_price', 0):,.1f}</td>
            <td style="padding: 10px 8px; text-align: center;">
                <span style="background: {risk_color}; color: white; padding: 3px 8px; border-radius: 12px; font-size: 11px; font-weight: bold;">{risk_level}</span>
            </td>
            <td style="padding: 10px 8px; text-align: center; font-weight: bold; color: #333; font-size: 14px;">{stock.get('total_score', 0):.0f}</td>
        </tr>"""
    
    # 生成 Top 11-20 股票表格行（精簡版）
    extra_rows = ""
    for i, stock in enumerate(top_stocks[10:20], 11):
        change_pct = stock.get('change_pct', 0)
        change_color = get_change_color(change_pct)
        risk_level = stock.get('risk_level', '中風險')
        risk_color = get_risk_color(risk_level)
        
        extra_rows += f"""
        <tr style="border-bottom: 1px solid #f0f0f0; background: #fafafa;">
            <td style="padding: 8px; text-align: center; color: #666;">{i}</td>
            <td style="padding: 8px;">
                <span style="font-weight: bold; color: #333;">{stock.get('name', 'N/A')}</span>
                <span style="color: #999; font-size: 12px; margin-left: 6px;">({stock.get('code', 'N/A')})</span>
            </td>
            <td style="padding: 8px; text-align: right;">NT${stock.get('close', 0):,.1f}</td>
            <td style="padding: 8px; text-align: right; color: {change_color}; font-weight: bold;">{change_pct:+.2f}%</td>
            <td style="padding: 8px; text-align: center;">
                <span style="background: {risk_color}; color: white; padding: 2px 6px; border-radius: 10px; font-size: 11px;">{risk_level}</span>
            </td>
            <td style="padding: 8px; text-align: center; font-weight: bold;">{stock.get('total_score', 0):.0f}</td>
        </tr>"""
    
    html = f"""<!DOCTYPE html>
<html lang="zh-TW">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>台股每日分析報告 - {analysis_date}</title>
</head>
<body style="margin: 0; padding: 0; background-color: #f5f5f5; font-family: 'Microsoft JhengHei', 'PingFang TC', Arial, sans-serif;">
    
    <!-- 主容器 -->
    <div style="max-width: 800px; margin: 20px auto; background: white; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 20px rgba(0,0,0,0.1);">
        
        <!-- 頂部標題 -->
        <div style="background: linear-gradient(135deg, #1a1a2e 0%, #16213e 50%, #0f3460 100%); padding: 30px 40px; color: white;">
            <div style="display: flex; justify-content: space-between; align-items: center;">
                <div>
                    <h1 style="margin: 0; font-size: 24px; font-weight: 700; letter-spacing: 2px;">📈 台股每日分析報告</h1>
                    <p style="margin: 8px 0 0 0; color: #a0aec0; font-size: 14px;">Taiwan Stock Market Daily Analysis</p>
                </div>
                <div style="text-align: right;">
                    <div style="font-size: 20px; font-weight: bold; color: #ffd700;">{analysis_date}</div>
                    <div style="font-size: 12px; color: #a0aec0; margin-top: 4px;">生成時間：{analysis_time}</div>
                </div>
            </div>
        </div>
        
        <!-- 市場情緒橫幅 -->
        <div style="background: {sentiment_color}; padding: 16px 40px; color: white; display: flex; justify-content: space-between; align-items: center;">
            <div>
                <span style="font-size: 13px; opacity: 0.9;">今日市場情緒</span>
                <span style="font-size: 22px; font-weight: bold; margin-left: 12px;">{sentiment}</span>
            </div>
            <div style="text-align: right; font-size: 13px; opacity: 0.9;">
                上漲 {sentiment_data.get('rising_count', 0)} 檔 ／ 下跌 {sentiment_data.get('falling_count', 0)} 檔 ／ 
                上漲比例 {sentiment_data.get('rising_ratio', 0)}% ／ 
                平均漲幅 {sentiment_data.get('avg_change_pct', 0):+.2f}%
            </div>
        </div>
        
        <!-- 統計數據卡片 -->
        <div style="padding: 24px 40px; background: #f8f9fa; border-bottom: 1px solid #e0e0e0;">
            <div style="display: flex; gap: 16px; flex-wrap: wrap;">
                <div style="flex: 1; min-width: 120px; background: white; border-radius: 8px; padding: 16px; text-align: center; box-shadow: 0 2px 8px rgba(0,0,0,0.06);">
                    <div style="font-size: 28px; font-weight: bold; color: #1a1a2e;">{stats.get('total_scanned', 0)}</div>
                    <div style="font-size: 12px; color: #666; margin-top: 4px;">掃描股票數</div>
                </div>
                <div style="flex: 1; min-width: 120px; background: white; border-radius: 8px; padding: 16px; text-align: center; box-shadow: 0 2px 8px rgba(0,0,0,0.06);">
                    <div style="font-size: 28px; font-weight: bold; color: #e53935;">{stats.get('strong_stocks', 0)}</div>
                    <div style="font-size: 12px; color: #666; margin-top: 4px;">強勢股（≥3%）</div>
                </div>
                <div style="flex: 1; min-width: 120px; background: white; border-radius: 8px; padding: 16px; text-align: center; box-shadow: 0 2px 8px rgba(0,0,0,0.06);">
                    <div style="font-size: 28px; font-weight: bold; color: #00897b;">{stats.get('recommended', 0)}</div>
                    <div style="font-size: 12px; color: #666; margin-top: 4px;">推薦標的</div>
                </div>
                <div style="flex: 1; min-width: 120px; background: white; border-radius: 8px; padding: 16px; text-align: center; box-shadow: 0 2px 8px rgba(0,0,0,0.06);">
                    <div style="font-size: 28px; font-weight: bold; color: #7b1fa2;">{sentiment_data.get('near_limit_count', 0)}</div>
                    <div style="font-size: 12px; color: #666; margin-top: 4px;">近漲停（≥7%）</div>
                </div>
                <div style="flex: 1; min-width: 120px; background: white; border-radius: 8px; padding: 16px; text-align: center; box-shadow: 0 2px 8px rgba(0,0,0,0.06);">
                    <div style="font-size: 28px; font-weight: bold; color: #f57c00;">{stats.get('avg_score', 0):.0f}</div>
                    <div style="font-size: 12px; color: #666; margin-top: 4px;">推薦均分</div>
                </div>
            </div>
        </div>
        
        <!-- 進場時機建議 -->
        <div style="padding: 16px 40px; background: #e8f5e9; border-left: 4px solid #4caf50; margin: 0;">
            <div style="font-weight: bold; color: #2e7d32; font-size: 14px;">⏰ 進場時機建議</div>
            <div style="color: #388e3c; margin-top: 6px; font-size: 14px;">{entry_suggestion}</div>
        </div>
        
        <!-- Top 10 推薦股票 -->
        <div style="padding: 24px 40px;">
            <h2 style="margin: 0 0 16px 0; font-size: 18px; color: #1a1a2e; border-bottom: 2px solid #e53935; padding-bottom: 8px;">
                🏆 Top 10 強勢推薦股票
            </h2>
            <p style="color: #666; font-size: 13px; margin: 0 0 16px 0;">
                篩選條件：漲幅 ≥ 3%，排除漲停股（≥9.5%），綜合技術面（40%）+ 籌碼面（40%）+ 漲幅加成（20%）評分
            </p>
            
            <div style="overflow-x: auto;">
                <table style="width: 100%; border-collapse: collapse; font-size: 13px;">
                    <thead>
                        <tr style="background: #1a1a2e; color: white;">
                            <th style="padding: 12px 8px; text-align: center; white-space: nowrap;">排名</th>
                            <th style="padding: 12px 8px; text-align: left; white-space: nowrap;">股票</th>
                            <th style="padding: 12px 8px; text-align: right; white-space: nowrap;">收盤價</th>
                            <th style="padding: 12px 8px; text-align: right; white-space: nowrap;">漲跌幅</th>
                            <th style="padding: 12px 8px; text-align: right; white-space: nowrap;">進場價</th>
                            <th style="padding: 12px 8px; text-align: right; white-space: nowrap;">目標價</th>
                            <th style="padding: 12px 8px; text-align: right; white-space: nowrap;">停損價</th>
                            <th style="padding: 12px 8px; text-align: center; white-space: nowrap;">風險</th>
                            <th style="padding: 12px 8px; text-align: center; white-space: nowrap;">評分</th>
                        </tr>
                    </thead>
                    <tbody>
                        {stock_rows}
                    </tbody>
                </table>
            </div>
        </div>
        
        <!-- Top 11-20 -->
        {'<div style="padding: 0 40px 24px 40px;"><h3 style="margin: 0 0 12px 0; font-size: 16px; color: #555; border-bottom: 1px solid #e0e0e0; padding-bottom: 6px;">📋 第 11-20 名候選股票</h3><table style="width: 100%; border-collapse: collapse; font-size: 13px;"><thead><tr style="background: #455a64; color: white;"><th style="padding: 8px; text-align: center;">排名</th><th style="padding: 8px; text-align: left;">股票</th><th style="padding: 8px; text-align: right;">收盤價</th><th style="padding: 8px; text-align: right;">漲跌幅</th><th style="padding: 8px; text-align: center;">風險</th><th style="padding: 8px; text-align: center;">評分</th></tr></thead><tbody>' + extra_rows + '</tbody></table></div>' if extra_rows else ''}
        
        <!-- 操作策略說明 -->
        <div style="padding: 24px 40px; background: #f8f9fa; border-top: 1px solid #e0e0e0;">
            <h3 style="margin: 0 0 12px 0; font-size: 16px; color: #1a1a2e;">📋 操作策略說明</h3>
            <table style="width: 100%; border-collapse: collapse; font-size: 13px;">
                <tr>
                    <td style="padding: 8px 12px; background: #e3f2fd; border-radius: 4px; width: 50%; vertical-align: top;">
                        <strong style="color: #1565c0;">進場策略</strong><br>
                        <span style="color: #555;">隔日開盤確認強勢後，以進場價附近分批買入。建議首倉不超過總資金 20%。</span>
                    </td>
                    <td style="padding: 8px 12px; width: 4%;"></td>
                    <td style="padding: 8px 12px; background: #fce4ec; border-radius: 4px; width: 46%; vertical-align: top;">
                        <strong style="color: #c62828;">停損策略</strong><br>
                        <span style="color: #555;">跌破停損價立即出場，不猶豫。單筆最大虧損控制在 4% 以內。</span>
                    </td>
                </tr>
                <tr><td colspan="3" style="height: 8px;"></td></tr>
                <tr>
                    <td style="padding: 8px 12px; background: #e8f5e9; border-radius: 4px; vertical-align: top;">
                        <strong style="color: #2e7d32;">目標策略</strong><br>
                        <span style="color: #555;">達到目標價時，可先出售 50% 持倉鎖定獲利，剩餘持倉移動停損。</span>
                    </td>
                    <td style="padding: 8px 12px; width: 4%;"></td>
                    <td style="padding: 8px 12px; background: #fff8e1; border-radius: 4px; vertical-align: top;">
                        <strong style="color: #f57c00;">風險提示</strong><br>
                        <span style="color: #555;">高風險股票建議減少倉位，中高風險股票注意盤中走勢，適時調整。</span>
                    </td>
                </tr>
            </table>
        </div>
        
        <!-- 評分說明 -->
        <div style="padding: 16px 40px; border-top: 1px solid #e0e0e0;">
            <h4 style="margin: 0 0 8px 0; font-size: 14px; color: #555;">📊 評分機制說明</h4>
            <div style="display: flex; gap: 16px; flex-wrap: wrap; font-size: 12px; color: #666;">
                <div><strong>技術面（40分）：</strong>漲幅評分 + 成交量評分 + 振幅評分</div>
                <div><strong>籌碼面（40分）：</strong>市值評分（偏好中小型股）+ 流動性評分</div>
                <div><strong>漲幅加成（20分）：</strong>當日漲幅表現加成</div>
            </div>
        </div>
        
        <!-- 免責聲明 -->
        <div style="padding: 16px 40px; background: #fafafa; border-top: 1px solid #e0e0e0;">
            <p style="margin: 0; font-size: 11px; color: #999; line-height: 1.6;">
                ⚠️ <strong>免責聲明：</strong>本報告僅供參考，不構成投資建議。股票投資有風險，請依自身風險承受能力謹慎操作。
                過去績效不代表未來表現。本系統數據來源為 Yahoo Finance，可能存在延遲，請以實際市場數據為準。
            </p>
        </div>
        
        <!-- 底部 -->
        <div style="padding: 16px 40px; background: #1a1a2e; color: #a0aec0; text-align: center; font-size: 12px;">
            台股每日自動分析系統 | 數據來源：Yahoo Finance | 發送時間：{analysis_time}
        </div>
    </div>
    
</body>
</html>"""
    
    return html


def generate_markdown_report(analysis_data):
    """生成 Markdown 格式報告"""
    analysis_date = analysis_data.get('analysis_date', '')
    analysis_time = analysis_data.get('analysis_time', '')
    sentiment_data = analysis_data.get('market_sentiment', {})
    entry_suggestion = analysis_data.get('entry_suggestion', '')
    stats = analysis_data.get('statistics', {})
    top_stocks = analysis_data.get('top_stocks', [])
    
    md = f"""# 台股每日分析報告 - {analysis_date}

**生成時間：** {analysis_time}

## 市場情緒分析

| 指標 | 數值 |
|------|------|
| 市場情緒 | **{sentiment_data.get('sentiment', 'N/A')}** |
| 情緒評分 | {sentiment_data.get('sentiment_score', 0)} / 100 |
| 上漲股數 | {sentiment_data.get('rising_count', 0)} 檔 |
| 下跌股數 | {sentiment_data.get('falling_count', 0)} 檔 |
| 上漲比例 | {sentiment_data.get('rising_ratio', 0)}% |
| 平均漲幅 | {sentiment_data.get('avg_change_pct', 0):+.2f}% |
| 強勢股（≥3%） | {sentiment_data.get('strong_count', 0)} 檔 |
| 近漲停（≥7%） | {sentiment_data.get('near_limit_count', 0)} 檔 |

## 進場時機建議

> {entry_suggestion}

## 統計數據

| 項目 | 數值 |
|------|------|
| 掃描股票數 | {stats.get('total_scanned', 0)} 檔 |
| 強勢股數量 | {stats.get('strong_stocks', 0)} 檔 |
| 推薦標的數 | {stats.get('recommended', 0)} 檔 |
| 推薦平均分 | {stats.get('avg_score', 0):.1f} 分 |

## Top 10 推薦股票

| 排名 | 股票代碼 | 股票名稱 | 收盤價 | 漲跌幅 | 進場價 | 目標價 | 停損價 | 風險 | 評分 |
|------|----------|----------|--------|--------|--------|--------|--------|------|------|
"""
    
    for i, stock in enumerate(top_stocks[:10], 1):
        md += f"| {i} | {stock.get('code', '')} | {stock.get('name', '')} | "
        md += f"NT${stock.get('close', 0):,.1f} | "
        md += f"{stock.get('change_pct', 0):+.2f}% | "
        md += f"NT${stock.get('entry_price', 0):,.1f} | "
        md += f"NT${stock.get('target_price', 0):,.1f} | "
        md += f"NT${stock.get('stop_loss_price', 0):,.1f} | "
        md += f"{stock.get('risk_level', '')} | "
        md += f"{stock.get('total_score', 0):.0f} |\n"
    
    md += f"""
## 操作策略說明

- **進場策略：** 隔日開盤確認強勢後，以進場價附近分批買入，首倉不超過總資金 20%
- **停損策略：** 跌破停損價立即出場，單筆最大虧損控制在 4% 以內
- **目標策略：** 達到目標價時，先出售 50% 持倉鎖定獲利，剩餘持倉移動停損
- **風險提示：** 高風險股票建議減少倉位，注意盤中走勢

## 評分機制

- **技術面（40分）：** 漲幅評分 + 成交量評分 + 振幅評分
- **籌碼面（40分）：** 市值評分（偏好中小型股）+ 流動性評分
- **漲幅加成（20分）：** 當日漲幅表現加成

---
*免責聲明：本報告僅供參考，不構成投資建議。數據來源：Yahoo Finance*
"""
    
    return md


def send_email(html_content, md_content, analysis_data):
    """發送郵件"""
    analysis_date = analysis_data.get('analysis_date', datetime.now().strftime("%Y-%m-%d"))
    sentiment = analysis_data.get('market_sentiment', {}).get('sentiment', '中性')
    top_stocks = analysis_data.get('top_stocks', [])
    
    # 郵件主題
    subject = f"📈 台股每日分析報告 {analysis_date} | 市場情緒：{sentiment} | Top推薦：{top_stocks[0]['name'] if top_stocks else 'N/A'}"
    
    # 建立郵件
    msg = MIMEMultipart('mixed')
    msg['From'] = GMAIL_USER
    msg['To'] = RECIPIENT
    msg['Subject'] = subject
    
    # HTML 正文
    html_part = MIMEText(html_content, 'html', 'utf-8')
    msg.attach(html_part)
    
    # 附加 JSON 文件
    json_path = "/home/ubuntu/stock_analysis/latest_analysis.json"
    if os.path.exists(json_path):
        with open(json_path, "rb") as f:
            json_attachment = MIMEBase('application', 'octet-stream')
            json_attachment.set_payload(f.read())
            encoders.encode_base64(json_attachment)
            json_attachment.add_header(
                'Content-Disposition',
                f'attachment; filename="taiwan_stock_analysis_{analysis_date}.json"'
            )
            msg.attach(json_attachment)
    
    # 附加 Markdown 文件
    md_path = f"/home/ubuntu/stock_analysis/report_{analysis_date}.md"
    with open(md_path, "w", encoding="utf-8") as f:
        f.write(md_content)
    
    with open(md_path, "rb") as f:
        md_attachment = MIMEBase('text', 'markdown')
        md_attachment.set_payload(f.read())
        encoders.encode_base64(md_attachment)
        md_attachment.add_header(
            'Content-Disposition',
            f'attachment; filename="taiwan_stock_report_{analysis_date}.md"'
        )
        msg.attach(md_attachment)
    
    # 發送郵件
    logger.info(f"連接 Gmail SMTP...")
    with smtplib.SMTP_SSL('smtp.gmail.com', 465) as server:
        server.login(GMAIL_USER, GMAIL_APP_PASSWORD)
        server.send_message(msg)
    
    logger.info(f"郵件已成功發送至：{RECIPIENT}")
    return True


def main():
    logger.info("=" * 60)
    logger.info("郵件報告發送開始")
    logger.info("=" * 60)
    
    # 讀取分析結果
    input_path = "/home/ubuntu/stock_analysis/latest_analysis.json"
    if not os.path.exists(input_path):
        logger.error(f"找不到分析文件：{input_path}")
        return 1
    
    with open(input_path, "r", encoding="utf-8") as f:
        analysis_data = json.load(f)
    
    logger.info(f"讀取分析數據：{analysis_data.get('analysis_date', 'N/A')}")
    logger.info(f"推薦股票數量：{len(analysis_data.get('top_stocks', []))}")
    
    # 生成 HTML 報告
    logger.info("生成 HTML 報告...")
    html_content = generate_html_report(analysis_data)
    
    # 生成 Markdown 報告
    logger.info("生成 Markdown 報告...")
    md_content = generate_markdown_report(analysis_data)
    
    # 發送郵件
    logger.info(f"發送郵件至：{RECIPIENT}")
    try:
        success = send_email(html_content, md_content, analysis_data)
        if success:
            logger.info("郵件發送步驟完成 ✓")
            return 0
    except Exception as e:
        logger.error(f"郵件發送失敗：{str(e)}")
        return 1
    
    return 1


if __name__ == "__main__":
    sys.exit(main())
