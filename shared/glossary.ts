/**
 * 醫療術語字典（Medical Glossary）
 * 
 * 用途：
 * - 確保醫療術語翻譯一致性
 * - 保護關鍵醫療資訊不被誤譯
 * - 支援多語言醫療術語對照
 * 
 * 優先級：
 * 1. zh→vi（越南語，主要目標語言）
 * 2. 其他語言 fallback（使用通用翻譯）
 */

/**
 * 術語類型定義
 */
export interface GlossaryEntry {
  /** 中文原文 */
  zh: string;
  /** 越南語翻譯 */
  vi: string;
  /** 印尼語翻譯（可選） */
  id?: string;
  /** 菲律賓語翻譯（可選） */
  fil?: string;
  /** 英文翻譯（可選） */
  en?: string;
  /** 術語類別 */
  category: "vital_signs" | "symptoms" | "medications" | "conditions" | "procedures" | "body_parts" | "time_units" | "negations";
  /** 備註說明 */
  note?: string;
}

/**
 * 醫療術語字典
 * 
 * 分類：
 * 1. vital_signs: 生命徵象（BP, HR, SpO2, 體溫等）
 * 2. symptoms: 症狀（疼痛、噁心、頭暈等）
 * 3. medications: 藥物（止痛藥、抗生素等）
 * 4. conditions: 疾病狀況（糖尿病、高血壓等）
 * 5. procedures: 醫療程序（打針、抽血等）
 * 6. body_parts: 身體部位（頭、胸、腹等）
 * 7. time_units: 時間單位（天、週、次等）
 * 8. negations: 否定詞（不、沒有、未等）
 */
export const MEDICAL_GLOSSARY: GlossaryEntry[] = [
  // ==================== 生命徵象 (Vital Signs) ====================
  {
    zh: "血壓",
    vi: "huyết áp",
    id: "tekanan darah",
    en: "blood pressure",
    category: "vital_signs",
    note: "常見縮寫：BP"
  },
  {
    zh: "BP",
    vi: "huyết áp",
    id: "tekanan darah",
    en: "blood pressure",
    category: "vital_signs",
  },
  {
    zh: "心跳",
    vi: "nhịp tim",
    id: "detak jantung",
    en: "heart rate",
    category: "vital_signs",
    note: "常見縮寫：HR"
  },
  {
    zh: "HR",
    vi: "nhịp tim",
    id: "detak jantung",
    en: "heart rate",
    category: "vital_signs",
  },
  {
    zh: "血氧",
    vi: "oxy máu",
    id: "oksigen darah",
    en: "blood oxygen",
    category: "vital_signs",
    note: "常見縮寫：SpO2"
  },
  {
    zh: "SpO2",
    vi: "oxy máu",
    id: "oksigen darah",
    en: "blood oxygen saturation",
    category: "vital_signs",
  },
  {
    zh: "體溫",
    vi: "nhiệt độ cơ thể",
    id: "suhu tubuh",
    en: "body temperature",
    category: "vital_signs",
  },
  {
    zh: "脈搏",
    vi: "mạch",
    id: "nadi",
    en: "pulse",
    category: "vital_signs",
  },
  {
    zh: "呼吸",
    vi: "hô hấp",
    id: "pernapasan",
    en: "respiration",
    category: "vital_signs",
  },

  // ==================== 症狀 (Symptoms) ====================
  {
    zh: "疼痛",
    vi: "đau",
    id: "sakit",
    en: "pain",
    category: "symptoms",
  },
  {
    zh: "痛",
    vi: "đau",
    id: "sakit",
    en: "pain",
    category: "symptoms",
  },
  {
    zh: "頭痛",
    vi: "đau đầu",
    id: "sakit kepala",
    en: "headache",
    category: "symptoms",
  },
  {
    zh: "噁心",
    vi: "buồn nôn",
    id: "mual",
    en: "nausea",
    category: "symptoms",
  },
  {
    zh: "嘔吐",
    vi: "nôn",
    id: "muntah",
    en: "vomiting",
    category: "symptoms",
  },
  {
    zh: "頭暈",
    vi: "chóng mặt",
    id: "pusing",
    en: "dizziness",
    category: "symptoms",
  },
  {
    zh: "發燒",
    vi: "sốt",
    id: "demam",
    en: "fever",
    category: "symptoms",
  },
  {
    zh: "咳嗽",
    vi: "ho",
    id: "batuk",
    en: "cough",
    category: "symptoms",
  },
  {
    zh: "腹瀉",
    vi: "tiêu chảy",
    id: "diare",
    en: "diarrhea",
    category: "symptoms",
  },
  {
    zh: "便秘",
    vi: "táo bón",
    id: "sembelit",
    en: "constipation",
    category: "symptoms",
  },

  // ==================== 藥物 (Medications) ====================
  {
    zh: "止痛藥",
    vi: "thuốc giảm đau",
    id: "obat pereda nyeri",
    en: "painkiller",
    category: "medications",
  },
  {
    zh: "抗生素",
    vi: "kháng sinh",
    id: "antibiotik",
    en: "antibiotic",
    category: "medications",
  },
  {
    zh: "退燒藥",
    vi: "thuốc hạ sốt",
    id: "obat penurun panas",
    en: "fever reducer",
    category: "medications",
  },
  {
    zh: "消炎藥",
    vi: "thuốc chống viêm",
    id: "obat anti-inflamasi",
    en: "anti-inflammatory",
    category: "medications",
  },
  {
    zh: "胃藥",
    vi: "thuốc dạ dày",
    id: "obat maag",
    en: "stomach medicine",
    category: "medications",
  },

  // ==================== 疾病狀況 (Conditions) ====================
  {
    zh: "糖尿病",
    vi: "bệnh tiểu đường",
    id: "diabetes",
    en: "diabetes",
    category: "conditions",
  },
  {
    zh: "高血壓",
    vi: "huyết áp cao",
    id: "tekanan darah tinggi",
    en: "hypertension",
    category: "conditions",
  },
  {
    zh: "過敏",
    vi: "dị ứng",
    id: "alergi",
    en: "allergy",
    category: "conditions",
  },
  {
    zh: "氣喘",
    vi: "hen suyễn",
    id: "asma",
    en: "asthma",
    category: "conditions",
  },
  {
    zh: "懷孕",
    vi: "mang thai",
    id: "hamil",
    en: "pregnant",
    category: "conditions",
  },
  {
    zh: "哺乳",
    vi: "cho con bú",
    id: "menyusui",
    en: "breastfeeding",
    category: "conditions",
  },

  // ==================== 醫療程序 (Procedures) ====================
  {
    zh: "打針",
    vi: "tiêm",
    id: "suntik",
    en: "injection",
    category: "procedures",
  },
  {
    zh: "抽血",
    vi: "lấy máu",
    id: "ambil darah",
    en: "blood draw",
    category: "procedures",
  },
  {
    zh: "量血壓",
    vi: "đo huyết áp",
    id: "ukur tekanan darah",
    en: "measure blood pressure",
    category: "procedures",
  },
  {
    zh: "吃藥",
    vi: "uống thuốc",
    id: "minum obat",
    en: "take medicine",
    category: "procedures",
  },

  // ==================== 身體部位 (Body Parts) ====================
  {
    zh: "頭",
    vi: "đầu",
    id: "kepala",
    en: "head",
    category: "body_parts",
  },
  {
    zh: "胸",
    vi: "ngực",
    id: "dada",
    en: "chest",
    category: "body_parts",
  },
  {
    zh: "腹",
    vi: "bụng",
    id: "perut",
    en: "abdomen",
    category: "body_parts",
  },
  {
    zh: "肚子",
    vi: "bụng",
    id: "perut",
    en: "stomach",
    category: "body_parts",
  },
  {
    zh: "背",
    vi: "lưng",
    id: "punggung",
    en: "back",
    category: "body_parts",
  },

  // ==================== 時間單位 (Time Units) ====================
  {
    zh: "天",
    vi: "ngày",
    id: "hari",
    en: "day",
    category: "time_units",
  },
  {
    zh: "週",
    vi: "tuần",
    id: "minggu",
    en: "week",
    category: "time_units",
  },
  {
    zh: "月",
    vi: "tháng",
    id: "bulan",
    en: "month",
    category: "time_units",
  },
  {
    zh: "次",
    vi: "lần",
    id: "kali",
    en: "time(s)",
    category: "time_units",
  },
  {
    zh: "小時",
    vi: "giờ",
    id: "jam",
    en: "hour",
    category: "time_units",
  },

  // ==================== 否定詞 (Negations) ====================
  {
    zh: "不",
    vi: "không",
    id: "tidak",
    en: "not",
    category: "negations",
    note: "最常見的否定詞"
  },
  {
    zh: "沒有",
    vi: "không có",
    id: "tidak ada",
    en: "don't have / no",
    category: "negations",
  },
  {
    zh: "未",
    vi: "chưa",
    id: "belum",
    en: "not yet",
    category: "negations",
  },
  {
    zh: "別",
    vi: "đừng",
    id: "jangan",
    en: "don't",
    category: "negations",
  },
];

/**
 * 數字與單位保護模式
 * 這些單位必須在翻譯時保留原樣
 */
export const PROTECTED_UNITS = [
  // 藥物劑量單位
  "mg", "g", "kg",
  "ml", "cc", "L",
  "mcg", "μg",
  "IU", "U",
  
  // 生命徵象單位
  "mmHg",
  "℃", "°C", "°F",
  "bpm", "次/分",
  "%",
  
  // 時間單位
  "天", "週", "月", "年",
  "小時", "分鐘", "秒",
  "次", "回",
  
  // 頻率單位
  "次/天", "次/日",
  "次/週",
  "次/月",
] as const;

/**
 * 數字模式（用於檢測數字）
 */
export const NUMBER_PATTERNS = [
  /\d+/g,                           // 整數
  /\d+\.\d+/g,                      // 小數
  /\d+\/\d+/g,                      // 分數或血壓（120/80）
  /\d+[-~]\d+/g,                    // 範圍（3-5天）
] as const;

/**
 * 否定詞模式（用於檢測否定詞）
 */
export const NEGATION_PATTERNS = [
  /不/g,
  /沒有/g,
  /未/g,
  /別/g,
  /無/g,
  /非/g,
] as const;

/**
 * 根據目標語言查找術語翻譯
 * 
 * @param sourceTerm 中文原文
 * @param targetLang 目標語言代碼（vi, id, fil, en 等）
 * @returns 翻譯結果，若找不到則返回 null
 */
export function findGlossaryTranslation(
  sourceTerm: string,
  targetLang: string
): string | null {
  const entry = MEDICAL_GLOSSARY.find(e => e.zh === sourceTerm);
  if (!entry) return null;

  // 根據目標語言返回對應翻譯
  switch (targetLang.toLowerCase()) {
    case "vi":
    case "vietnamese":
      return entry.vi;
    case "id":
    case "indonesian":
      return entry.id || entry.vi; // Fallback to Vietnamese
    case "fil":
    case "filipino":
    case "tl":
    case "tagalog":
      return entry.fil || entry.vi; // Fallback to Vietnamese
    case "en":
    case "english":
      return entry.en || entry.vi; // Fallback to Vietnamese
    default:
      return entry.vi; // Default fallback to Vietnamese
  }
}

/**
 * 建立 Glossary 提示文字（用於 LLM prompt）
 * 
 * @param targetLang 目標語言代碼
 * @param category 術語類別（可選，若指定則只包含該類別）
 * @returns Glossary 提示文字
 */
export function buildGlossaryPrompt(
  targetLang: string,
  category?: GlossaryEntry["category"]
): string {
  const entries = category
    ? MEDICAL_GLOSSARY.filter(e => e.category === category)
    : MEDICAL_GLOSSARY;

  const glossaryLines = entries
    .map(entry => {
      const translation = findGlossaryTranslation(entry.zh, targetLang);
      return translation ? `- ${entry.zh} → ${translation}` : null;
    })
    .filter(Boolean);

  if (glossaryLines.length === 0) {
    return "";
  }

  return `
醫療術語對照表（必須使用以下翻譯）：
${glossaryLines.join("\n")}
`.trim();
}

/**
 * 檢測文字中是否包含數字
 */
export function containsNumbers(text: string): boolean {
  return NUMBER_PATTERNS.some(pattern => pattern.test(text));
}

/**
 * 檢測文字中是否包含否定詞
 */
export function containsNegation(text: string): boolean {
  return NEGATION_PATTERNS.some(pattern => pattern.test(text));
}

/**
 * 提取文字中的所有數字
 */
export function extractNumbers(text: string): string[] {
  const numbers: string[] = [];
  NUMBER_PATTERNS.forEach(pattern => {
    const matches = text.match(pattern);
    if (matches) {
      numbers.push(...matches);
    }
  });
  return Array.from(new Set(numbers)); // Remove duplicates
}

/**
 * 檢測文字中是否包含保護單位
 */
export function containsProtectedUnits(text: string): boolean {
  return PROTECTED_UNITS.some(unit => text.includes(unit));
}
