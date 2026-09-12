import { createHash } from "node:crypto";
import { PollyClient, SynthesizeSpeechCommand } from "@aws-sdk/client-polly";
import type { Engine, LanguageCode, VoiceId } from "@aws-sdk/client-polly";
import { PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import type { AppSyncEvent } from "./shared";
import { asRecord, stringValue } from "./shared";

const polly = new PollyClient({});
const s3 = new S3Client({});

export async function handler(event: AppSyncEvent) {
  const input = asRecord(event.arguments?.input);
  const phrase = stringValue(input.phrase).trim().slice(0, 180);
  if (!phrase) throw new Error("phrase is required");

  const voiceId = stringValue(input.voiceId, process.env.POLLY_VOICE_ID ?? "Joanna");
  const engine = stringValue(input.engine, process.env.POLLY_ENGINE ?? "neural");
  const bucket = process.env.AUDIO_BUCKET_NAME;
  const key = `phrases/${createHash("sha256")
    .update(`${voiceId}|${engine}|${phrase}`)
    .digest("hex")}.mp3`;

  if (process.env.POLLY_ENABLED !== "true" || !bucket)
    return { phrase, caption: phrase, objectKey: null, fallback: true };

  try {
    const result = await polly.send(
      new SynthesizeSpeechCommand({
        Text: phrase,
        OutputFormat: "mp3",
        VoiceId: voiceId as VoiceId,
        Engine: engine as Engine,
        LanguageCode: stringValue(input.languageCode, "en-US") as LanguageCode,
      }),
    );
    const bytes = await result.AudioStream?.transformToByteArray();
    if (!bytes) throw new Error("Polly returned no audio");
    await s3.send(
      new PutObjectCommand({
        Bucket: bucket,
        Key: key,
        Body: bytes,
        ContentType: "audio/mpeg",
        CacheControl: "public,max-age=31536000,immutable",
      }),
    );
    return { phrase, caption: phrase, objectKey: key, fallback: false };
  } catch {
    return { phrase, caption: phrase, objectKey: null, fallback: true };
  }
}
