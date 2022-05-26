import * as puppeteer from "puppeteer";
import { mkdir } from "fs/promises";
import { dirname } from "path";
import { Protocol } from "devtools-protocol";
import { MissingHeadlessExperimentalRequiredArgs } from "./MissingHeadlessExperimentalRequiredArgs";
import { PuppeteerCaptureOptions } from "./PuppeteerCaptureOptions";
import { PuppeteerCapture } from "./PuppeteerCapture";

export class PuppeteerCaptureViaHeadlessExperimental implements PuppeteerCapture {

    public static REQUIRED_ARGS = [
        "--deterministic-mode",
        "--enable-begin-frame-control",
        "--disable-new-content-rendering-timeout",
        "--run-all-compositor-stages-before-draw",
        "--disable-threaded-animation",
        "--disable-threaded-scrolling",
        "--disable-checker-imaging",
        "--disable-image-animation-resync",
        "--enable-surface-synchronization",
    ]

    public static DEFAULT_OPTIONS: PuppeteerCaptureOptions = {
        fps: 60,
    }

    private _page: puppeteer.Page
    private _options: PuppeteerCaptureOptions
    private _frameInterval: number
    private _isCapturing: boolean
    private _session: puppeteer.CDPSession | null
    private _captureFrame: Function
    private _frameBeingCaptured: Promise<void> | null

    public constructor(page: puppeteer.Page, options?: PuppeteerCaptureOptions) {
        if (process.platform === "darwin") {
            throw new Error("MacOS is not supported by HeadlessExperimental.BeginFrame");
        }

        PuppeteerCaptureViaHeadlessExperimental.validateBrowserArgs(page.browser())

        this._page = page
        this._options = Object.assign({}, PuppeteerCaptureViaHeadlessExperimental.DEFAULT_OPTIONS, options || {})
        this._frameInterval = 1000.0 / this._options.fps!!;
        this._isCapturing = false
        this._session = null
        this._captureFrame = this.captureFrame.bind(this)
        this._frameBeingCaptured = null
    }

    public get page(): puppeteer.Page {
        return this._page
    }

    public get isCapturing(): boolean {
        return this._isCapturing
    }

    public async start(filepath: string): Promise<void> {
        if (this._page.isClosed()) {
            throw new Error("Can not start capturing a closed page")
        }

        await mkdir(dirname(filepath), { recursive: true })

        this._session = await this._page.target().createCDPSession()
        await this._session.send("HeadlessExperimental.enable")

        this._isCapturing = true
        this.captureFrame()

        this._page.once("close", async () => await this.onPageClose())

        await this._frameBeingCaptured
    }

    public async stop() {
        console.log("stop()")

        if (!this._isCapturing) {
            return
        }

        this._isCapturing = false

        while (this._frameBeingCaptured) {
            await this._frameBeingCaptured
        }

        if (!this._page.isClosed() && this._session) {
            await this._session.send("HeadlessExperimental.disable")
        }

        if (this._session) {
            this._session = null
        }

        // if (this.isScreenCaptureEnded !== null) {
        //     return this.isScreenCaptureEnded;
        // }

    //     if (this.isStreamingEnded) {
    //         return this.isStreamingEnded;
    //     }

    //     if (this.shouldFollowPopupWindow) {
    //         this.removeListenerOnTabClose(this.page);
    //     }

    //     await Promise.race([
    //         this.isFrameAckReceived,
    //         new Promise((resolve) => setTimeout(resolve, 1000)),
    //     ]);

    //     this.isStreamingEnded = true;

    //     try {
    //         for (const currentSession of this.sessionsStack) {
    //             await currentSession.detach();
    //         }
    //     } catch (e) {
    //         console.warn('Error detaching session', e.message);
    //     }

    //     return true;
    // }
        // this.isScreenCaptureEnded = await this.streamWriter.stop();
        // return this.isScreenCaptureEnded;
    }

    private captureFrame() {
        if (!this._isCapturing) {
            return;
        }

        this._frameBeingCaptured = this._session!!.send("HeadlessExperimental.beginFrame", {
            // frameTimeTicks: actual time,
            interval: this._frameInterval,
            noDisplayUpdates: false,
            screenshot: {},
        }).then(
            async ({ screenshotData }) => {
                this._frameBeingCaptured = null

                console.log("frame captured")
                await this.onFrameCaptured()

                if (this._isCapturing) {
                    setTimeout(this._captureFrame, this._frameInterval)
                }
            },
            async (reason) => {
                this._frameBeingCaptured = null

                await this.onFrameCaptureError(reason)
            },
        )
    }

    private async onFrameCaptured() {

    }

    private async onFrameCaptureError(reason: any) {
        console.log("!!!onCaptureError: " + reason)

        // TODO: save error to resolve to promise
        await this.stop()
    }

    private async onPageClose() {
        console.log("!!!onPageClose")

        // TODO: save error to resolve to promise
        await this.stop()
    }

    private static validateBrowserArgs(browser: puppeteer.Browser) {
        const spawnargs = browser.process()?.spawnargs || []
        if (!PuppeteerCaptureViaHeadlessExperimental.REQUIRED_ARGS.every(arg => spawnargs.includes(arg))) {
            throw new MissingHeadlessExperimentalRequiredArgs()
        }
    }
}
