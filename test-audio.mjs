import fs from 'fs';
import { transcribeAudio, translateText, determineDirection } from './server/translationService.js';

async function testAudio() {
  try {
    console.log('========================================');
    console.log('開始測試音檔翻譯');
    console.log('========================================\n');

    // 讀取音檔
    const audioPath = '/home/ubuntu/upload/新錄音5.webm';
    const audioBuffer = fs.readFileSync(audioPath);
    console.log(`音檔大小: ${audioBuffer.length} bytes\n`);

    // Step 1: Whisper 語音識別
    console.log('Step 1: Whisper 語音識別...');
    const { text: sourceText, language: whisperLanguage } = await transcribeAudio(
      audioBuffer,
      '新錄音5.webm'
    );
    console.log(`識別結果: "${sourceText}"`);
    console.log(`Whisper 偵測語言: ${whisperLanguage}\n`);

    if (!sourceText || sourceText.trim() === '') {
      console.log('❌ 沒有偵測到語音');
      return;
    }

    // Step 2: 判斷翻譯方向
    const detectedLanguage = whisperLanguage || 'zh';
    const targetLang = 'vi'; // 預設越南語
    console.log('Step 2: 判斷翻譯方向...');
    console.log(`偵測語言: ${detectedLanguage}`);
    
    const { direction, sourceLang, targetLang: finalTargetLang } = determineDirection(
      detectedLanguage,
      targetLang
    );
    
    console.log(`翻譯方向: ${direction}`);
    console.log(`語言對: ${sourceLang} → ${finalTargetLang}\n`);

    // Step 3: 翻譯
    console.log('Step 3: 翻譯...');
    const { translatedText } = await translateText(sourceText, sourceLang, finalTargetLang);
    console.log(`翻譯結果: "${translatedText}"\n`);

    // 顯示結果分析
    console.log('========================================');
    console.log('結果分析');
    console.log('========================================');
    console.log(`原文（sourceText）: ${sourceText}`);
    console.log(`譯文（translatedText）: ${translatedText}`);
    console.log(`翻譯方向（direction）: ${direction}`);
    console.log(`來源語言（sourceLang）: ${sourceLang}`);
    console.log(`目標語言（targetLang）: ${finalTargetLang}\n`);

    // 顯示邏輯分析
    console.log('========================================');
    console.log('顯示邏輯分析');
    console.log('========================================');
    
    if (direction === 'nurse_to_patient') {
      console.log('✅ 台灣人說話（中文）');
      console.log(`   台灣人對話框應顯示: "${sourceText}" （原文）`);
      console.log(`   外國人對話框應顯示: "${translatedText}" （譯文）`);
    } else {
      console.log('✅ 外國人說話（外語）');
      console.log(`   外國人對話框應顯示: "${sourceText}" （原文）`);
      console.log(`   台灣人對話框應顯示: "${translatedText}" （譯文）`);
    }
    
    console.log('\n========================================');
    console.log('前端顯示邏輯檢查');
    console.log('========================================');
    console.log('前端程式碼：');
    console.log('  const speaker = result.direction === "nurse_to_patient" ? "nurse" : "patient";');
    console.log('  const newMessage = {');
    console.log('    speaker,');
    console.log('    originalText: result.sourceText,');
    console.log('    translatedText: result.translatedText,');
    console.log('  };');
    console.log('');
    console.log(`實際值：`);
    console.log(`  speaker = "${direction === 'nurse_to_patient' ? 'nurse' : 'patient'}"`);
    console.log(`  originalText = "${sourceText}"`);
    console.log(`  translatedText = "${translatedText}"`);
    console.log('');
    console.log('顯示邏輯：');
    console.log('  台灣人對話框（speaker === "nurse"）顯示: originalText');
    console.log('  外國人對話框（speaker === "patient"）顯示: translatedText');
    
    console.log('\n========================================');
    console.log('問題診斷');
    console.log('========================================');
    
    if (direction === 'nurse_to_patient') {
      console.log('✅ 方向正確：台灣人說話');
      console.log(`✅ 台灣人對話框會顯示: "${sourceText}" （正確）`);
      console.log(`✅ 外國人對話框會顯示: "${translatedText}" （正確）`);
    } else {
      console.log('⚠️  方向：外國人說話');
      console.log(`   外國人對話框會顯示: "${sourceText}"`);
      console.log(`   台灣人對話框會顯示: "${translatedText}"`);
      
      // 檢查是否應該是中文
      if (sourceText.match(/[\u4e00-\u9fa5]/)) {
        console.log('');
        console.log('❌ 問題發現！');
        console.log('   原文包含中文字，但 direction 是 patient_to_nurse');
        console.log(`   Whisper 偵測語言: ${whisperLanguage}`);
        console.log('   可能原因：Whisper 將中文誤判為其他語言');
      }
    }
    
    console.log('\n========================================');
    console.log('測試完成');
    console.log('========================================');

  } catch (error) {
    console.error('❌ 測試失敗:', error);
    console.error(error.stack);
  }
}

testAudio();
