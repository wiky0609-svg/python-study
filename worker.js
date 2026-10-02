import { loadPyodide } from 'https://cdn.jsdelivr.net/pyodide/v314.0.7/full/pyodide.mjs';
const ready=loadPyodide({stdout:text=>self.postMessage({type:'stdout',text}),stderr:text=>self.postMessage({type:'stdout',text})});
self.onmessage=async({data})=>{let globals;try{const py=await ready;self.postMessage({type:'ready'});globals=py.runPython('dict()');const value=await py.runPythonAsync(data.code,{globals});if(value?.destroy)value.destroy();self.postMessage({type:'done'})}catch(error){self.postMessage({type:'error',error:String(error.message||error)})}finally{globals?.destroy()}};
