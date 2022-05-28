import { FfmpegCommand } from 'fluent-ffmpeg'

export interface PuppeteerCaptureOptions {
  fps?: number
  size?: string
  format?: (ffmpeg: FfmpegCommand) => Promise<void>
  ffmpeg?: string
  customFfmpegConfig?: (ffmpeg: FfmpegCommand) => Promise<void>
}
