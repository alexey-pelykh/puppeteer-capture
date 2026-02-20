// SPDX-License-Identifier: MIT
// Copyright (c) 2022-2026 Alexey Pelykh

export interface PuppeteerCaptureEvents {
  captureStarted: () => void
  frameCaptured: (index: number, timestamp: number, data: Buffer) => void
  frameCaptureFailed: (reason?: any) => void
  frameRecorded: (index: number, timestamp: number, data: Buffer) => void
  captureStopped: () => void
}
