# ---- Sound System: the look shared with Riddim Swap -----------------------------------------------------------
# MirrorView hard-codes about 470 colours. They are translated, not hand-edited: greys and green-tinted darks become
# the shared blue-grey neutrals, MirrorView's mint/green accents become the dancer blue, oranges become the music
# amber. Lightness is kept, so contrast stays as MirrorView designed it. A few named colours are set exactly.
import colorsys
EXACT = {'#ffa674': '#6E8BFF', '#ff9d68': '#6E8BFF', '#00ff88': '#4FD1A1', '#b5f47b': '#6E8BFF', '#9cf1d0': '#6E8BFF',
         '#0b0e0d': '#0E1014', '#0c1011': '#0E1014', '#111614': '#171A21', '#12191b': '#171A21', '#e9eee9': '#F3F1EC',
         '#eef4f2': '#F3F1EC', '#8a978f': '#A3A9B6', '#a4b5b1': '#A3A9B6', '#252d29': '#2C313C', '#293436': '#2C313C'}


def _remap_rgb(r, g, b):
    h, l, sat = colorsys.rgb_to_hls(r / 255, g / 255, b / 255)
    hd = h * 360
    if sat < 0.18 or l < 0.06 or l > 0.97:
        h2, s2 = 222 / 360, min(sat, 0.12)        # neutral: blue-grey
    elif 65 <= hd <= 190:
        h2, s2 = 228 / 360, min(1, sat * 0.95)    # green / mint / teal -> dancer blue
    elif 8 <= hd < 65:
        h2, s2 = 38 / 360, sat                    # orange / yellow -> music amber
    else:
        return None
    rr, gg, bb = colorsys.hls_to_rgb(h2, l, s2)
    return round(rr * 255), round(gg * 255), round(bb * 255)


def remap_hex(t):
    body = t[1:]
    if len(body) in (3, 4):
        body = ''.join(c * 2 for c in body)
    key, alpha = '#' + body[:6].lower(), body[6:]
    if key in EXACT:
        return EXACT[key] + alpha
    out = _remap_rgb(int(body[0:2], 16), int(body[2:4], 16), int(body[4:6], 16))
    return t if out is None else '#%02x%02x%02x' % out + alpha


def _rgba(m):
    parts = [x.strip() for x in m.group(2).split(',')]
    try:
        r, g, b = [float(x) for x in parts[:3]]
    except ValueError:
        return m.group(0)
    out = _remap_rgb(r, g, b)
    if out is None:
        return m.group(0)
    rest = (',' + ','.join(parts[3:])) if len(parts) > 3 else ''
    return '%s(%d,%d,%d%s)' % (m.group(1), out[0], out[1], out[2], rest)


HEX = re.compile(r'#(?:[0-9a-fA-F]{8}|[0-9a-fA-F]{6}|[0-9a-fA-F]{3,4})\b')
RGBA = re.compile(r'(rgba?)\(\s*([0-9.]+\s*,\s*[0-9.]+\s*,\s*[0-9.]+(?:\s*,\s*[0-9.%]+)?)\s*\)')


def recolour_css(t):
    return RGBA.sub(_rgba, HEX.sub(lambda m: remap_hex(m.group(0)), t))


def recolour_js(t):
    t = re.sub(r"(['\"`])(#[0-9a-fA-F]{3,8})(['\"`])", lambda m: m.group(1) + remap_hex(m.group(2)) + m.group(3), t)
    return RGBA.sub(_rgba, t)


s = re.sub(r'(<style[^>]*>)([\s\S]*?)(</style>)', lambda m: m.group(1) + recolour_css(m.group(2)) + m.group(3), s)
_m = list(re.finditer(r'<script>([\s\S]*?)</script>', s))[0]
s = s[:_m.start(1)] + recolour_js(_m.group(1)) + s[_m.end(1):]
s = re.sub(r'style="([^"]*)"', lambda m: 'style="' + recolour_css(m.group(1)) + '"', s)

# fonts: Figtree for reading and tapping, Bricolage Grotesque for headings, JetBrains Mono for numbers
rep('<title>MirrorView · Worldline</title>', '<title>MirrorView · Worldline</title>\n'
    '<link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>\n'
    '<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Bricolage+Grotesque:opsz,wght@12..96,700;12..96,800'
    '&family=Figtree:wght@400;500;600;700&family=JetBrains+Mono:wght@500;700&display=swap">')
s = s.replace("font-family:Inter,-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif",
              "font-family:Figtree,-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif")
s = s.replace('ui-monospace,SFMono-Regular,Consolas,monospace', "'JetBrains Mono',ui-monospace,SFMono-Regular,Consolas,monospace")
s = s.replace('ui-monospace,SFMono-Regular,monospace', "'JetBrains Mono',ui-monospace,SFMono-Regular,monospace")

# styles go at the end of the last style block, so they win over MirrorView's earlier rules
THEME_CSS = """
/* ===== Sound System (shared with Riddim Swap): dark stage; blue = the dancer, amber = the music, magenta = the hips ===== */
:root{--bg:#0E1014;--panel:#171A21;--line:#2C313C;--text:#F3F1EC;--muted:#A3A9B6;--green:#6E8BFF;--you:#4FD1A1;--ref:#6E8BFF;--hips:#FF5FA2}
body{font-family:Figtree,-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif}
h1,h2,#modal-title,.brand{font-family:'Bricolage Grotesque',Figtree,sans-serif}
.topbar{padding-top:env(safe-area-inset-top,0px);box-sizing:content-box}
.rs-nav{flex-shrink:0;display:grid;grid-template-columns:repeat(6,minmax(0,1fr));border-top:1px solid var(--line);background:var(--bg);padding:6px 4px calc(10px + env(safe-area-inset-bottom,0px))}
.rs-nav button{display:flex;flex-direction:column;align-items:center;gap:5px;background:transparent;border:0;color:var(--muted);font:600 12px Figtree,sans-serif;min-height:52px;padding:4px 2px;border-radius:0;box-shadow:none;cursor:pointer}
.rs-nav button::before{content:"";width:24px;height:4px;border-radius:2px;background:transparent}
.rs-nav button.on{color:var(--text);font-weight:700}
.rs-nav button.on::before{background:var(--hips)}
body.practice-active .rs-nav,body.distance-mode .rs-nav{display:none!important}
.toast{bottom:calc(92px + env(safe-area-inset-bottom,0px))}
"""
i = s.rfind('</style>')
s = s[:i] + THEME_CSS + s[i:]

# reference and camera skeleton colours: the dancer blue and a mint for "you"
rep("const REF='#6E8BFF',CAM='#4FD1A1';", "const REF='#6E8BFF',CAM='#4FD1A1',HIPS='#FF5FA2';")

# prepared reference poses: 30 per second in every profile (was 24 in fast/balanced) so fast accents aren't thinned out
rep("fast:{fps:30,edge:320,dpr:1,cacheFPS:24}", "fast:{fps:30,edge:320,dpr:1,cacheFPS:30}")
rep("balanced:{fps:24,edge:384,dpr:1.5,cacheFPS:24}", "balanced:{fps:24,edge:384,dpr:1.5,cacheFPS:30}")

# the dance body: MirrorView's one skeleton drawing function now draws torso, pelvis shape, thick limbs and head for
# the main figure (and the hips' path for the reference). Faint after-images and dashed guides keep the thin original.
rep("function skeleton2D(ctx,points,rect,mirror,colour,alpha=1,dashed=false,stroke=2.6){\n  if(!points)return;ctx.save();",
    "function skeleton2D(ctx,points,rect,mirror,colour,alpha=1,dashed=false,stroke=2.6){\n"
    "  if(!points)return;\n"
    "  if(!dashed&&alpha>=.9&&danceBody2D(ctx,points,rect,mirror,colour,stroke))return;\n"
    "  ctx.save();")
DANCE_JS = r"""
/* Riddim Swap integration: dance body. Pelvis as a shape that tilts and turns, torso, thick limbs, head; for the
   reference, the hips' path relative to the chest over the last second (scaled x2) from the prepared poses. */
function danceBody2D(ctx,points,rect,mirror,colour,stroke){
  const ok=i=>points[i]&&(points[i].visibility??0)>.35;
  if(![11,12,23,24].every(ok))return false;
  const P=i=>mapPoint(points[i],rect,mirror),mid=(a,b)=>({x:(a.x+b.x)/2,y:(a.y+b.y)/2}),lerp=(a,b,u)=>({x:a.x+(b.x-a.x)*u,y:a.y+(b.y-a.y)*u});
  const q={};for(const i of [0,7,8,11,12,13,14,15,16,23,24,25,26,27,28,31,32])if(points[i])q[i]=P(i);
  const sh=mid(q[11],q[12]),hp=mid(q[23],q[24]),torso=Math.hypot(sh.x-hp.x,sh.y-hp.y)||40,lw=Math.max(stroke*1.4,torso*.11);
  ctx.save();ctx.lineCap='round';ctx.lineJoin='round';
  if(colour===REF)danceHipPath(ctx,rect,mirror,hp,sh,lw);
  ctx.strokeStyle=colour;ctx.fillStyle=colour;ctx.lineWidth=Math.max(2,lw*.3);
  ctx.globalAlpha=.22;ctx.beginPath();[11,12,24,23].forEach((j,k)=>k?ctx.lineTo(q[j].x,q[j].y):ctx.moveTo(q[j].x,q[j].y));ctx.closePath();ctx.fill();ctx.globalAlpha=1;ctx.stroke();
  const hw=Math.hypot(q[23].x-q[24].x,q[23].y-q[24].y),ax={x:(q[23].x-q[24].x)/(hw||1),y:(q[23].y-q[24].y)/(hw||1)},dn={x:(hp.x-sh.x)/torso,y:(hp.y-sh.y)/torso};
  const wl=lerp(q[23],q[11],.28),wr=lerp(q[24],q[12],.28),push=Math.max(hw*.12,torso*.05);
  const ol={x:q[23].x+ax.x*push,y:q[23].y+ax.y*push},orr={x:q[24].x-ax.x*push,y:q[24].y-ax.y*push},cr={x:hp.x+dn.x*torso*.2,y:hp.y+dn.y*torso*.2};
  ctx.fillStyle=HIPS;ctx.strokeStyle=HIPS;ctx.globalAlpha=.55;ctx.beginPath();[wl,wr,orr,cr,ol].forEach((p,k)=>k?ctx.lineTo(p.x,p.y):ctx.moveTo(p.x,p.y));ctx.closePath();ctx.fill();ctx.globalAlpha=1;ctx.stroke();
  ctx.strokeStyle=colour;
  const limb=(ids,w)=>{ctx.lineWidth=w;ctx.beginPath();let on=false;for(const j of ids){if(!ok(j)){on=false;continue}if(!on){ctx.moveTo(q[j].x,q[j].y);on=true}else ctx.lineTo(q[j].x,q[j].y)}ctx.stroke()};
  limb([11,13,15],lw*.9);limb([12,14,16],lw*.9);limb([23,25,27,31],lw);limb([24,26,28,32],lw);
  if(ok(0)){const hr=ok(7)&&ok(8)?Math.max(6,Math.hypot(q[7].x-q[8].x,q[7].y-q[8].y)*.75):torso*.18;ctx.globalAlpha=.3;ctx.fillStyle=colour;ctx.beginPath();ctx.arc(q[0].x,q[0].y,hr,0,Math.PI*2);ctx.fill();ctx.globalAlpha=1;ctx.lineWidth=Math.max(2,lw*.3);ctx.stroke();}
  ctx.restore();return true;
}
function danceHipPath(ctx,rect,mirror,hp,sh,lw){
  if(typeof state==='undefined'||!state.poseSamples?.length||state.demo)return;
  const t=state.time,pts=[];
  for(let s=-1;s<=.0001;s+=1/30){const f=interpolatedPose(state.poseSamples,t+s,.18);if(!f||!f[11]||!f[12]||!f[23]||!f[24]){pts.push(null);continue}
    const a=mapPoint(f[11],rect,mirror),b=mapPoint(f[12],rect,mirror),c=mapPoint(f[23],rect,mirror),d=mapPoint(f[24],rect,mirror);
    const s2={x:(a.x+b.x)/2,y:(a.y+b.y)/2},h2={x:(c.x+d.x)/2,y:(c.y+d.y)/2};
    pts.push({x:hp.x+((h2.x-s2.x)-(hp.x-sh.x))*2,y:hp.y+((h2.y-s2.y)-(hp.y-sh.y))*2});}
  ctx.strokeStyle=HIPS;ctx.lineWidth=Math.max(2,lw*.35);
  for(let i=1;i<pts.length;i++){if(!pts[i]||!pts[i-1])continue;ctx.globalAlpha=.15+.7*i/pts.length;ctx.beginPath();ctx.moveTo(pts[i-1].x,pts[i-1].y);ctx.lineTo(pts[i].x,pts[i].y);ctx.stroke();}
  ctx.globalAlpha=1;
}
"""
rep("function drawImageFit(ctx,img,area,alpha,mirror,fit='contain'){", DANCE_JS + "function drawImageFit(ctx,img,area,alpha,mirror,fit='contain'){")
