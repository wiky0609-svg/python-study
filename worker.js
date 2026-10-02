import { loadPyodide } from 'https://cdn.jsdelivr.net/pyodide/v314.0.7/full/pyodide.mjs';
const send = (type, fields = {}) => self.postMessage({ type, ...fields });
const allowedFiles = new Set(['study_week.csv', 'reading_week.csv', 'spending_week.csv', 'spending_raw.csv']);
const fileCache = new Map();
let runtimePromise;
function runtime() {
  if (!runtimePromise) runtimePromise = loadPyodide({
    stdout: text => send('stdout', { text }),
    stderr: text => send('stdout', { text })
  });
  return runtimePromise;
}
async function prepareFiles(py, names) {
  if (!Array.isArray(names)) throw new Error('실습 파일 목록을 확인할 수 없어요.');
  for (const name of names) {
    if (!allowedFiles.has(name)) throw new Error('제공되지 않은 실습 파일이에요.');
    if (!fileCache.has(name)) {
      const response = await fetch(new URL(`data/${name}`, import.meta.url));
      if (!response.ok) throw new Error('실습 파일을 불러오지 못했어요. 인터넷 연결을 확인하고 다시 실행해 주세요.');
      fileCache.set(name, new Uint8Array(await response.arrayBuffer()));
    }
    py.FS.writeFile(name, fileCache.get(name));
  }
}
self.onmessage = async ({ data }) => {
  let py, globals;
  try {
    send('loading', { message: '파이썬 준비 중…' });
    py = await runtime();
    send('loading', { message: '필요한 도구 준비 중…' });
    // This loads packages bundled with Pyodide, including pandas and dependencies.
    await py.loadPackagesFromImports(data.code, {
      messageCallback: () => {},
      errorCallback: () => {}
    });
    send('loading', { message: '실습 파일 준비 중…' });
    await prepareFiles(py, data.datasets || []);
  } catch (error) {
    // A syntax error belongs to the learner's code, not to environment setup.
    const message = String(error.message || error);
    if (/SyntaxError|IndentationError|TabError/.test(message)) send('error', { error: message });
    else send('setup-error', { error: `실행 준비를 마치지 못했어요. 인터넷 연결을 확인하고 다시 실행해 주세요.\n\n${message}` });
    return;
  }
  try {
    send('ready');
    globals = py.runPython('dict()');
    const value = await py.runPythonAsync(data.code, { globals });
    if (value?.destroy) value.destroy();
    send('done');
  } catch (error) {
    send('error', { error: String(error.message || error) });
  } finally {
    globals?.destroy();
  }
};
