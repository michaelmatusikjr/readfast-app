export class KokoroTTS {
  static async from_pretrained(id, opts){ if(opts.device==="webgpu") throw new Error("no available backend found: webgpu");
    const files=[['config.json',1000],['onnx/model_quantized.onnx',92000000],['tokenizer.json',5000]];
    for(let s=0;s<=10;s++){ for(const [f,t] of files) opts.progress_callback&&opts.progress_callback({status:'progress',file:f,loaded:Math.round(t*s/10),total:t}); await new Promise(r=>setTimeout(r,60)); }
    try{ const c=await caches.open('transformers-cache'); await c.put('https://huggingface.co/'+id+'/resolve/main/onnx/model_quantized.onnx', new Response('x')); }catch(e){}
    self.__gens=0; return new KokoroTTS();
  }
  async generate(text,{voice,speed}={}){
    if(!text) throw new Error('empty');
    const sr=24000, secs=Math.max(0.3, text.split(/\s+/).length*0.12/(speed||1)); const n=Math.round(sr*secs); const a=new Float32Array(n);
    for(let k=0;k<n;k++) a[k]=0.05*Math.sin(k*2*Math.PI*220/sr);
    await new Promise(r=>setTimeout(r,80));
    return {audio:a, sampling_rate:sr};
  }
}
