export class NotChromeHeadlessShell extends Error {
  constructor (executablePath: string) {
    super('Not chrome-headless-shell: ' + executablePath)
    this.name = this.constructor.name
    Error.captureStackTrace(this, this.constructor)
  }
}
