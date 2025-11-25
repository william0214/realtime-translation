/**
 * Diagnostic Test Script
 * Simulates a translation workflow and generates diagnostic data
 */

import axios from "axios";
import fs from "fs";

async function testDiagnostics() {
  console.log("=== Starting Diagnostic Test ===\n");

  // Create a minimal WebM audio file (silent audio)
  // This is a valid WebM file with Opus codec
  const minimalWebM = Buffer.from([
    0x1a, 0x45, 0xdf, 0xa3, // EBML Header
    0x01, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x1f,
    0x42, 0x86, 0x81, 0x01, 0x42, 0xf7, 0x81, 0x01,
    0x42, 0xf2, 0x81, 0x04, 0x42, 0xf3, 0x81, 0x08,
    0x42, 0x82, 0x88, 0x77, 0x65, 0x62, 0x6d, 0x42,
    0x87, 0x81, 0x04, 0x42, 0x85, 0x81, 0x02,
  ]);

  // Save to file
  const testAudioPath = "/tmp/test-audio.webm";
  fs.writeFileSync(testAudioPath, minimalWebM);

  try {
    // Call the autoTranslate API
    console.log("1. Calling autoTranslate API...");
    const audioBase64 = minimalWebM.toString("base64");

    const response = await axios.post(
      "http://localhost:3000/api/trpc/translation.autoTranslate",
      {
        json: {
          audioBase64,
          filename: "test-audio.webm",
          preferredTargetLang: "vi",
        },
      },
      {
        headers: {
          "Content-Type": "application/json",
        },
      }
    );

    console.log("✓ Translation completed\n");

    // Wait a moment for diagnostics to be saved
    await new Promise((resolve) => setTimeout(resolve, 1000));

    // Fetch diagnostics report
    console.log("2. Fetching diagnostics report...");
    const diagnosticsResponse = await axios.get("http://localhost:3000/api/trpc/diagnostics.report");

    const report = diagnosticsResponse.data.result.data;

    if (!report) {
      console.log("✗ No diagnostic data available yet\n");
      return;
    }

    console.log("✓ Diagnostic report retrieved\n");

    // Display results
    console.log("=== DIAGNOSTIC REPORT ===\n");

    if (report.asr) {
      console.log("📊 ASR (Whisper API):");
      console.log(`   Duration: ${report.asr.duration.toFixed(0)}ms`);
      console.log(`   Audio Duration: ${report.asr.metadata.audioDuration}s`);
      console.log(`   File Size: ${(report.asr.metadata.fileSize / 1024).toFixed(1)}KB`);
      console.log(`   Model: ${report.asr.metadata.model}`);
      console.log();
    }

    if (report.translation) {
      console.log("📊 Translation:");
      console.log(`   Duration: ${report.translation.duration.toFixed(0)}ms`);
      console.log(`   Text Length: ${report.translation.metadata.textLength} chars`);
      console.log(`   ${report.translation.metadata.sourceLang} → ${report.translation.metadata.targetLang}`);
      console.log(`   Model: ${report.translation.metadata.model}`);
      console.log();
    }

    if (report.tts) {
      console.log("📊 TTS:");
      console.log(`   Duration: ${report.tts.duration.toFixed(0)}ms`);
      console.log(`   Text Length: ${report.tts.metadata.textLength} chars`);
      console.log(`   Audio Duration: ${report.tts.metadata.audioDuration}s`);
      console.log(`   Model: ${report.tts.metadata.model}`);
      console.log();
    }

    if (report.chunk) {
      console.log("📊 Chunk Processing:");
      console.log(`   Duration: ${report.chunk.duration.toFixed(0)}ms`);
      console.log(`   Chunk Duration: ${report.chunk.metadata.chunkDuration}s`);
      console.log(`   Chunk Size: ${(report.chunk.metadata.chunkSize / 1024).toFixed(1)}KB`);
      console.log(`   Upload Time: ${report.chunk.metadata.uploadTime.toFixed(0)}ms`);
      console.log();
    }

    if (report.e2e) {
      console.log("📊 End-to-End:");
      console.log(`   Duration: ${report.e2e.duration.toFixed(0)}ms`);
      console.log(`   Stage: ${report.e2e.metadata.stage}`);
      console.log();
    }

    if (report.bottleneck) {
      console.log("🚦 Bottleneck Analysis:");
      console.log(`   Severity: ${report.bottleneck.severity.toUpperCase()}`);
      console.log(`   Bottleneck: ${report.bottleneck.bottleneck}`);
      if (report.bottleneck.details && report.bottleneck.details.length > 0) {
        console.log("   Details:");
        report.bottleneck.details.forEach((detail: string) => {
          console.log(`     • ${detail}`);
        });
      }
      console.log();
    }

    console.log("=== END OF REPORT ===\n");

    // Cleanup
    fs.unlinkSync(testAudioPath);
  } catch (error: any) {
    console.error("✗ Error:", error.message);
    if (error.response) {
      console.error("Response:", error.response.data);
    }
  }
}

// Run the test
testDiagnostics().catch(console.error);
