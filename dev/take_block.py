# ---- takes carry their audio lead-in (MP4 edit list), so MirrorView's Pulse can time them --------------------------------
TAKE_JS = r"""
/* ---------- MP4 edit list for the audio's encoder lead-in ----------
   Audio encoders put a short lead-in before the first real sample (Opus: the pre-skip in its header, 6.5 ms here;
   AAC: about 1024–2112 samples). Players and decoders learn to skip it from the file's edit list. The muxer doesn't
   write one, so tools that check the timing (MirrorView's Pulse) refused takes. This adds one edit to the audio
   track: start at the lead-in, run to the end. The file is otherwise byte-identical (sizes and chunk offsets moved). */
function mp4AddAudioEdit(buf,leadSec){
  if(!(leadSec>0))return buf;
  const u8=new Uint8Array(buf),v=new DataView(buf),n=u8.length,str=p=>String.fromCharCode(u8[p],u8[p+1],u8[p+2],u8[p+3]);
  const boxes=(V,U,from,to)=>{const out=[];for(let p=from;p+8<=to&&out.length<5000;){let size=V.getUint32(p),h=8;if(size===1){size=Number(V.getBigUint64(p+8));h=16}else if(size===0)size=to-p;if(size<h||p+size>to)break;out.push({type:String.fromCharCode(U[p+4],U[p+5],U[p+6],U[p+7]),start:p,data:p+h,end:p+size,head:h});p+=size}return out};
  const top=boxes(v,u8,0,n),moov=top.find(b=>b.type==='moov'),mdat=top.find(b=>b.type==='mdat');if(!moov)return buf;
  const kids=b=>boxes(v,u8,b.data,b.end),kid=(b,t)=>kids(b).find(x=>x.type===t);
  const time=b=>{const one=u8[b.data]===1,pos=b.data+(one?20:12);return {scale:v.getUint32(pos),dur:one?Number(v.getBigUint64(pos+4)):v.getUint32(pos+4)}};
  const mv=kid(moov,'mvhd');if(!mv)return buf;const movie=time(mv);
  let at=-1,trak=null,seg=0,mt=0;
  for(const t of kids(moov).filter(b=>b.type==='trak')){const mdia=kid(t,'mdia'),hdlr=mdia&&kid(mdia,'hdlr');if(!hdlr||str(hdlr.data+8)!=='soun')continue;
    if(kid(t,'edts'))return buf;const md=time(kid(mdia,'mdhd')),tk=kid(t,'tkhd');if(!tk||!md.scale)return buf;
    mt=Math.round(leadSec*md.scale);if(mt<=0||mt>=md.dur)return buf;seg=Math.round((md.dur-mt)/md.scale*movie.scale);at=tk.end;trak=t}
  if(at<0)return buf;
  const E=36,out=new Uint8Array(n+E),ov=new DataView(out.buffer);
  out.set(u8.subarray(0,at),0);out.set(u8.subarray(at),at+E);
  ov.setUint32(at,36);out.set([101,100,116,115],at+4);ov.setUint32(at+8,28);out.set([101,108,115,116],at+12);
  ov.setUint32(at+16,0);ov.setUint32(at+20,1);ov.setUint32(at+24,seg);ov.setInt32(at+28,mt);ov.setInt16(at+32,1);ov.setInt16(at+34,0);
  const grow=b=>{if(b.head===8)ov.setUint32(b.start,ov.getUint32(b.start)+E);else ov.setBigUint64(b.start+8,ov.getBigUint64(b.start+8)+BigInt(E))};
  grow(moov);grow(trak);
  /* the samples live in mdat; when it comes after moov, every chunk offset moves by the inserted bytes */
  if(mdat&&mdat.start>moov.start){
    const U=out,V=ov,top2=boxes(V,U,0,U.length),moov2=top2.find(b=>b.type==='moov'),k2=b=>boxes(V,U,b.data,b.end),c2=(b,t)=>k2(b).find(x=>x.type===t);
    for(const t of k2(moov2).filter(b=>b.type==='trak')){const st=c2(c2(c2(t,'mdia')||t,'minf')||t,'stbl');if(!st)continue;
      const so=c2(st,'stco'),co=c2(st,'co64');
      if(so){const cnt=V.getUint32(so.data+4);for(let i=0;i<cnt;i++){const q=so.data+8+i*4;V.setUint32(q,V.getUint32(q)+E)}}
      if(co){const cnt=V.getUint32(co.data+4);for(let i=0;i<cnt;i++){const q=co.data+8+i*8;V.setBigUint64(q,V.getBigUint64(q)+BigInt(E))}}}
  }
  return out.buffer;
}
/* the encoder's lead-in, in seconds: Opus says it in its header (pre-skip at 48 kHz); AAC encoders don't, so use the
   usual priming (Apple's 2112 samples, others 1024). The recording self-check corrects any remainder per phone. */
function audioLeadSec(meta){
  try{
    if(aCfg.mux==='opus'){const d=meta&&meta.decoderConfig&&meta.decoderConfig.description;if(!d)return 312/48000;
      const b=d instanceof ArrayBuffer?new Uint8Array(d):new Uint8Array(d.buffer,d.byteOffset,d.byteLength);
      if(b.length>=12&&String.fromCharCode(...b.subarray(0,8))==='OpusHead')return (b[10]|(b[11]<<8))/48000;return 312/48000}
    const apple=/Mac|iPhone|iPad/.test(navigator.platform||'')||/AppleWebKit/.test(navigator.userAgent)&&!/Chrome|Android/.test(navigator.userAgent);
    return (apple?2112:1024)/aCfg.sampleRate;
  }catch(e){return 0}
}
"""
rep("""/* fallback recorder */""", TAKE_JS + """/* fallback recorder */""")
rep("""    R.muxer.finalize();
    const outBlob=new Blob([R.target.buffer],{type:'video/mp4'});""",
    """    R.muxer.finalize();
    let mp4=R.target.buffer;try{mp4=mp4AddAudioEdit(mp4,audioLeadSec(chunks.meta))}catch(e){mp4=R.target.buffer}
    const outBlob=new Blob([mp4],{type:'video/mp4'});""")
# the self-check's per-phone correction was measured on files without the edit; start it fresh
rep("""function encKey(){return 'rs-enccomp-'+(aCfg&&aCfg.codec||'x')}""","""function encKey(){return 'rs-enccomp2-'+(aCfg&&aCfg.codec||'x')}""")
if False: pass
