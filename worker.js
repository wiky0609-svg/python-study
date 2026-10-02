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
    const packageErrors = [];
    await py.loadPackagesFromImports(data.code, {
      messageCallback: () => {},
      errorCallback: message => packageErrors.push(message)
    });
    if (packageErrors.length) throw new Error(packageErrors.join('\n'));
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
    if (Object.hasOwn(py.loadedPackages, 'matplotlib')) {
      let plotCount = 0;
      globals.set('_emit_plot', (png, title) => {
        if (plotCount++ < 8) send('plot', { png, title });
        else if (plotCount === 9) send('stdout', { text: '한 번에 그래프 8개까지 표시해요. 코드를 나누어 실행해 주세요.' });
      });
      py.runPython(`
import matplotlib as _mpl
_mpl.use("Agg")
import matplotlib.pyplot as _plt
import io as _io
import base64 as _base64
_plt.close("all")
_plt.rcdefaults()
def _show_plots(*args, **kwargs):
    for _number in _plt.get_fignums():
        _fig = _plt.figure(_number)
        _buffer = _io.BytesIO()
        _fig.savefig(_buffer, format="png", dpi=120, bbox_inches="tight")
        _title = "; ".join(ax.get_title() for ax in _fig.axes if ax.get_title())
        _emit_plot(_base64.b64encode(_buffer.getvalue()).decode("ascii"), _title)
        _plt.close(_fig)
_plt.show = _show_plots
`, { globals });
    }
    const value = await py.runPythonAsync(data.code, { globals });
    if (value?.destroy) value.destroy();
    send('done');
  } catch (error) {
    send('error', { error: String(error.message || error) });
  } finally {
    if (Object.hasOwn(py.loadedPackages, 'matplotlib')) {
      py.runPython('import matplotlib.pyplot as _cleanup_plt; _cleanup_plt.close("all")');
    }
    globals?.destroy();
  }
};
