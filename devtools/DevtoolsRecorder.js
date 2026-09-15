const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');

const activeRecorders = new WeakMap();

function attach(page) {
  if (!page || page._devtoolsRecorderAttached) return;
  page._devtoolsRecorderAttached = true;
  page.devtools = page.devtools || {};
  page.devtools.recorder = {
    async start(o = {}) {
      return start(page, o);
    },
    async stop() {
      return stop(page);
    },
    isRecording() {
      return activeRecorders.has(page);
    },
  };
}

function checkFfmpeg() {
  return new Promise((r) => {
    const p = spawn('ffmpeg', ['-version']);
    p.on('error', () => r(false));
    p.on('exit', (c) => r(c === 0));
  });
}

async function start(page, options = {}) {
  if (activeRecorders.has(page)) return activeRecorders.get(page).outputPath;
  let session = null;
  try {
    session = await page.target().createCDPSession();
  } catch (_) {
    return null;
  }

  const out = path.resolve(
    options.outputPath || `./recordings/recording-${Date.now()}.webm`
  );
  fs.mkdirSync(path.dirname(out), { recursive: true });

  const has = await checkFfmpeg();
  if (!has)
    throw new Error(
      'ffmpeg not found. Install: apt install -y ffmpeg (Linux) / brew install ffmpeg (Mac)'
    );

  const ffmpeg = spawn('ffmpeg', [
    '-y',
    '-f',
    'image2pipe',
    '-vcodec',
    'mjpeg',
    '-r',
    '25',
    '-i',
    '-',
    '-c:v',
    'libvpx-vp9',
    '-b:v',
    '1M',
    '-pix_fmt',
    'yuv420p',
    '-r',
    '25',
    out,
  ]);
  ffmpeg.stderr.on('data', () => {});
  ffmpeg.on('error', () => {});

  const params = {
    format: 'jpeg',
    quality: options.quality !== undefined ? options.quality : 80,
    maxWidth: options.maxWidth || 1920,
    maxHeight: options.maxHeight || 1080,
    everyNthFrame: options.everyNthFrame || 1,
  };

  session.on('Page.screencastFrame', async (event) => {
    try {
      const b = Buffer.from(event.data, 'base64');
      if (ffmpeg.stdin.writable) ffmpeg.stdin.write(b);
      await session.send('Page.screencastFrameAck', {
        sessionId: event.sessionId,
      });
    } catch (_) {}
  });

  await session.send('Page.startScreencast', params);
  activeRecorders.set(page, { session, ffmpeg, outputPath: out });
  return out;
}

async function stop(page) {
  const r = activeRecorders.get(page);
  if (!r) return null;
  try {
    await r.session.send('Page.stopScreencast');
  } catch (_) {}
  try {
    r.ffmpeg.stdin.end();
  } catch (_) {}
  await new Promise((res) => {
    const t = setTimeout(() => {
      try {
        r.ffmpeg.kill('SIGKILL');
      } catch (_) {}
      res();
    }, 10000);
    r.ffmpeg.on('close', () => {
      clearTimeout(t);
      res();
    });
  });
  activeRecorders.delete(page);
  return r.outputPath;
}

module.exports = { attach, start, stop };