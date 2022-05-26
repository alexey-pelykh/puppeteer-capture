# puppeteer-capture

A Puppeteer plugin for capturing page as a video.

## Getting Started

```js
const puppeteer = require('puppeteer');
const { capture } = require('puppeteer-capture');

(async () => {
  const browser = await puppeteer.launch();
  const page = await browser.newPage();
  const recorder = await capture(page);
  await recorder.start('capture.mp4');
  await page.goto('https://google.com', {
    waitUntil: 'networkidle0',
  });
  await recorder.stop();
  await browser.close();
})();
```
