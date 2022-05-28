import { PuppeteerCaptureViaHeadlessExperimental } from './PuppeteerCaptureViaHeadlessExperimental'

export class MissingHeadlessExperimentalRequiredArgs extends Error {
  constructor () {
    super('Missing one or more of required arguments: ' + PuppeteerCaptureViaHeadlessExperimental.REQUIRED_ARGS.join(', '))
    this.name = this.constructor.name
    Error.captureStackTrace(this, this.constructor)
  }
}
