import { FfmpegCommand } from 'fluent-ffmpeg'

export function MP4 (
  preset: 'ultrafast' | 'superfast' | 'veryfast' | 'faster' | 'fast' | 'medium' | 'slow' | 'slower' | 'veryslow' = 'ultrafast',
  videoCodec: string = 'libx264'
): (ffmpeg: FfmpegCommand) => Promise<void> {
  return async (ffmpeg: FfmpegCommand) => {
    ffmpeg
      .outputFormat('mp4').withVideoCodec(videoCodec)
      .outputOption(`-preset ${preset}`)
      .outputOption('-movflags +frag_keyframe+separate_moof+omit_tfhd_offset+empty_moov')
  }
}
