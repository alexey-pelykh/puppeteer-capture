import { FfmpegCommand } from 'fluent-ffmpeg'

export interface PuppeteerCaptureOptions {
  fps?: number
  ffmpeg?: string
  customFfmpegConfig?: (ffmpeg: FfmpegCommand) => Promise<void>
  format?: (ffmpeg: FfmpegCommand) => Promise<void>
}
