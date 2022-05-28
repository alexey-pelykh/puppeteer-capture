export interface PuppeteerCaptureEvents {
  captureStarted: () => void
  frameCaptured: (index: number, timestamp: number, data: Buffer) => void
  frameCaptureFailed: (reason?: any) => void
  frameRecorded: (index: number, timestamp: number, data: Buffer) => void
  captureStopped: () => void
}
