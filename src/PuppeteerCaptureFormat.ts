import { FfmpegCommand } from 'fluent-ffmpeg'

export function h264 (
  preset: 'ultrafast' | 'superfast' | 'veryfast' | 'faster' | 'fast' | 'medium' | 'slow' | 'slower' | 'veryslow' = 'ultrafast'
): (ffmpeg: FfmpegCommand) => Promise<void> {
  return async (ffmpeg: FfmpegCommand) => {
    ffmpeg
      .videoCodec('libx264')
      .outputOptions(`-preset ${preset}`)
  }
}
