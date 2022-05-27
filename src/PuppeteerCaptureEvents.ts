export interface PuppeteerCaptureEvents {
  captureStarted: () => void
  frameCaptured: (index: number, data: Buffer) => void
  frameCaptureFailed: (reason?: any) => void
  //TODO: frameRecorded: (index: number, data: Buffer) => void
  captureStopped: () => void
}
