#!/usr/bin/env python3
"""
CI 模型一致性檢查腳本
檢查文件中的模型引用是否與 shared/config.ts 定義一致
若發現未定義的模型，CI 會 fail
"""

import os
import re
import sys
from pathlib import Path
from typing import Dict, List, Set, Tuple

# 從 shared/config.ts 讀取允許的模型清單
def load_allowed_models_from_config() -> Set[str]:
    """
    從 shared/config.ts 讀取允許的模型清單
    """
    config_path = Path(__file__).parent.parent / "shared" / "config.ts"
    
    if not config_path.exists():
        print(f"❌ 錯誤：找不到 config 檔案：{config_path}")
        sys.exit(1)
    
    with open(config_path, 'r', encoding='utf-8') as f:
        content = f.read()
    
    # 提取 ALLOWED_ASR_MODELS
    asr_match = re.search(r'export const ALLOWED_ASR_MODELS = \[([\s\S]*?)\] as const;', content)
    if not asr_match:
        print("❌ 錯誤：無法從 config.ts 提取 ALLOWED_ASR_MODELS")
        sys.exit(1)
    
    asr_models = set(re.findall(r'"([^"]+)"', asr_match.group(1)))
    
    # 提取 ALLOWED_TRANSLATION_MODELS
    trans_match = re.search(r'export const ALLOWED_TRANSLATION_MODELS = \[([\s\S]*?)\] as const;', content)
    if not trans_match:
        print("❌ 錯誤：無法從 config.ts 提取 ALLOWED_TRANSLATION_MODELS")
        sys.exit(1)
    
    trans_models = set(re.findall(r'"([^"]+)"', trans_match.group(1)))
    
    # 提取 LEGACY_ASR_MODELS
    legacy_asr_match = re.search(r'export const LEGACY_ASR_MODELS = \[([\s\S]*?)\] as const;', content)
    legacy_asr_models = set()
    if legacy_asr_match:
        legacy_asr_models = set(re.findall(r'"([^"]+)"', legacy_asr_match.group(1)))
    
    # 提取 LEGACY_TRANSLATION_MODELS
    legacy_trans_match = re.search(r'export const LEGACY_TRANSLATION_MODELS = \[([\s\S]*?)\] as const;', content)
    legacy_trans_models = set()
    if legacy_trans_match:
        legacy_trans_models = set(re.findall(r'"([^"]+)"', legacy_trans_match.group(1)))
    
    # 合併所有允許的模型
    allowed_models = asr_models | trans_models | legacy_asr_models | legacy_trans_models
    
    return allowed_models

def find_model_references(content: str) -> List[Tuple[str, int, str]]:
    """
    找出文件中所有可能的模型引用
    返回: [(model_name, line_number, line_content), ...]
    """
    references = []
    lines = content.split('\n')
    
    # 模型名稱的正則表達式模式
    patterns = [
        r'"(gpt-[^"]+)"',           # "gpt-4o-mini"
        r'`(gpt-[^`]+)`',           # `gpt-4o-mini`
        r'"(whisper-[^"]+)"',       # "whisper-1"
        r'`(whisper-[^`]+)`',       # `whisper-1`
        r'\b(gpt-[\w\.-]+)\b',      # gpt-4o-mini (無引號)
        r'\b(whisper-[\w\.-]+)\b',  # whisper-1 (無引號)
    ]
    
    for line_num, line in enumerate(lines, 1):
        for pattern in patterns:
            matches = re.finditer(pattern, line)
            for match in matches:
                model_name = match.group(1)
                # 過濾掉明顯不是模型名稱的字串
                if model_name and not any(x in model_name.lower() for x in ['example', 'your-', 'xxx']):
                    references.append((model_name, line_num, line.strip()))
    
    return references

def check_file(file_path: Path, allowed_models: Set[str]) -> Dict:
    """
    檢查單一文件
    返回檢查結果
    """
    try:
        with open(file_path, 'r', encoding='utf-8') as f:
            content = f.read()
    except Exception as e:
        return {
            'file': str(file_path),
            'error': str(e),
            'unknown_models': [],
        }
    
    references = find_model_references(content)
    
    unknown_models = []
    
    for model_name, line_num, line_content in references:
        if model_name not in allowed_models:
            unknown_models.append({
                'model': model_name,
                'line': line_num,
                'content': line_content,
            })
    
    return {
        'file': str(file_path),
        'unknown_models': unknown_models,
    }

def main():
    print("🔍 CI 模型一致性檢查開始...")
    
    # 載入允許的模型清單
    try:
        allowed_models = load_allowed_models_from_config()
        print(f"✅ 從 shared/config.ts 載入 {len(allowed_models)} 個允許的模型")
    except Exception as e:
        print(f"❌ 錯誤：無法載入模型清單：{e}")
        sys.exit(1)
    
    # 掃描所有文件
    docs_dir = Path(__file__).parent.parent / "docs"
    results = []
    
    for md_file in docs_dir.rglob('*.md'):
        result = check_file(md_file, allowed_models)
        if result.get('unknown_models'):
            results.append(result)
    
    # 檢查結果
    if not results:
        print("🎉 所有模型引用都是有效的！")
        sys.exit(0)
    
    # 發現未知模型，輸出錯誤並 fail
    print("\n❌ 發現未知模型引用：\n")
    
    total_unknown = 0
    for result in results:
        file_path = result['file']
        unknown = result['unknown_models']
        total_unknown += len(unknown)
        
        print(f"📄 {file_path}")
        for item in unknown:
            print(f"  第 {item['line']} 行: `{item['model']}`")
            print(f"    {item['content'][:80]}...")
        print()
    
    print(f"❌ 總共發現 {total_unknown} 個未知模型引用")
    print(f"💡 請確保所有模型都在 shared/config.ts 中定義")
    print(f"💡 或者從文件中移除這些未知模型的引用")
    
    sys.exit(1)

if __name__ == '__main__':
    main()
