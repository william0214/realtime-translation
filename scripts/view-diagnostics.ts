/**
 * View Diagnostics Script
 * Directly reads from diagnosticsStore to show current diagnostic data
 */

async function viewDiagnostics() {
  console.log("=== CURRENT DIAGNOSTIC REPORT ===\n");

  try {
    const { diagnosticsStore } = await import("../server/profiler/diagnosticsStore");
    const report = diagnosticsStore.getReport();

    if (!report) {
      console.log("✗ No diagnostic data available yet");
      console.log("   Please trigger a translation first by using the web interface.\n");
      return;
    }

    console.log(`📅 Timestamp: ${new Date(report.timestamp).toLocaleString()}\n`);

    if (report.asr) {
      console.log("📊 ASR (Whisper API):");
      console.log(`   Duration: ${report.asr.duration.toFixed(0)}ms`);
      console.log(`   Audio Duration: ${report.asr.metadata.audioDuration}s`);
      console.log(`   File Size: ${(report.asr.metadata.fileSize / 1024).toFixed(1)}KB`);
      console.log(`   Model: ${report.asr.metadata.model}`);
      
      // Calculate performance
      const asrPerformance = report.asr.duration < 700 ? "🟢 GOOD" : report.asr.duration < 1500 ? "🟡 MODERATE" : "🔴 SLOW";
      console.log(`   Performance: ${asrPerformance}`);
      console.log();
    }

    if (report.translation) {
      console.log("📊 Translation:");
      console.log(`   Duration: ${report.translation.duration.toFixed(0)}ms`);
      console.log(`   Text Length: ${report.translation.metadata.textLength} chars`);
      console.log(`   ${report.translation.metadata.sourceLang} → ${report.translation.metadata.targetLang}`);
      console.log(`   Model: ${report.translation.metadata.model}`);
      
      // Calculate performance
      const translationPerformance = report.translation.duration < 300 ? "🟢 GOOD" : report.translation.duration < 600 ? "🟡 MODERATE" : "🔴 SLOW";
      console.log(`   Performance: ${translationPerformance}`);
      console.log();
    }

    if (report.tts) {
      console.log("📊 TTS:");
      console.log(`   Duration: ${report.tts.duration.toFixed(0)}ms`);
      console.log(`   Text Length: ${report.tts.metadata.textLength} chars`);
      console.log(`   Audio Duration: ${report.tts.metadata.audioDuration}s`);
      console.log(`   Model: ${report.tts.metadata.model}`);
      
      // Calculate performance
      const ttsPerformance = report.tts.duration < 350 ? "🟢 GOOD" : report.tts.duration < 700 ? "🟡 MODERATE" : "🔴 SLOW";
      console.log(`   Performance: ${ttsPerformance}`);
      console.log();
    }

    if (report.chunk) {
      console.log("📊 Chunk Processing:");
      console.log(`   Duration: ${report.chunk.duration.toFixed(0)}ms`);
      console.log(`   Chunk Duration: ${report.chunk.metadata.chunkDuration}s`);
      console.log(`   Chunk Size: ${(report.chunk.metadata.chunkSize / 1024).toFixed(1)}KB`);
      console.log(`   Upload Time: ${report.chunk.metadata.uploadTime.toFixed(0)}ms`);
      
      // Calculate performance
      const chunkPerformance = report.chunk.metadata.chunkSize < 150 * 1024 ? "🟢 GOOD" : report.chunk.metadata.chunkSize < 250 * 1024 ? "🟡 MODERATE" : "🔴 LARGE";
      console.log(`   Performance: ${chunkPerformance}`);
      console.log();
    }

    if (report.e2e) {
      console.log("📊 End-to-End:");
      console.log(`   Duration: ${report.e2e.duration.toFixed(0)}ms`);
      console.log(`   Stage: ${report.e2e.metadata.stage}`);
      
      // Calculate performance
      const e2ePerformance = report.e2e.duration < 1000 ? "🟢 EXCELLENT" : report.e2e.duration < 1500 ? "🟡 GOOD" : "🔴 SLOW";
      console.log(`   Performance: ${e2ePerformance}`);
      console.log();
    }

    if (report.bottleneck) {
      console.log("🚦 BOTTLENECK ANALYSIS:");
      
      const severityIcon = report.bottleneck.severity === "green" ? "🟢" : report.bottleneck.severity === "yellow" ? "🟡" : "🔴";
      console.log(`   Severity: ${severityIcon} ${report.bottleneck.severity.toUpperCase()}`);
      console.log(`   Bottleneck: ${report.bottleneck.bottleneck}`);
      
      if (report.bottleneck.details && report.bottleneck.details.length > 0) {
        console.log("   Details:");
        report.bottleneck.details.forEach((detail: string) => {
          console.log(`     • ${detail}`);
        });
      }
      console.log();
    }

    // Summary
    console.log("=== SUMMARY ===");
    const totalTime = report.e2e ? report.e2e.duration : 
                      (report.asr?.duration || 0) + (report.translation?.duration || 0) + (report.tts?.duration || 0);
    console.log(`Total Processing Time: ${totalTime.toFixed(0)}ms`);
    
    if (totalTime < 1000) {
      console.log("✓ System performance is EXCELLENT (< 1 second)");
    } else if (totalTime < 1500) {
      console.log("✓ System performance is GOOD (< 1.5 seconds)");
    } else {
      console.log("✗ System performance needs OPTIMIZATION (> 1.5 seconds)");
    }
    
    console.log("\n=== END OF REPORT ===\n");

  } catch (error: any) {
    console.error("✗ Error:", error.message);
  }
}

// Run the viewer
viewDiagnostics().catch(console.error);
