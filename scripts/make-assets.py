"""Rebuild the original vector food illustrations. Python is not required to run FOODIO."""
from pathlib import Path
import math, random
out=Path(__file__).resolve().parent.parent/'public'/'images';out.mkdir(exist_ok=True)
random.seed(42)
def wrap(body,bg):
 return f'''<svg xmlns="http://www.w3.org/2000/svg" width="640" height="480" viewBox="0 0 640 480"><defs><filter id="shadow" x="-40%" y="-40%" width="180%" height="180%"><feDropShadow dx="0" dy="16" stdDeviation="18" flood-color="#17392c" flood-opacity=".16"/></filter><radialGradient id="plate"><stop stop-color="#fffef8"/><stop offset=".9" stop-color="#fffef8"/><stop offset="1" stop-color="#dfe3d6"/></radialGradient><linearGradient id="bun" x2="0" y2="1"><stop stop-color="#f4b969"/><stop offset="1" stop-color="#c97731"/></linearGradient><linearGradient id="glass" x2="1" y2="1"><stop stop-color="#f6b753"/><stop offset="1" stop-color="#ec8b3f"/></linearGradient></defs><rect width="640" height="480" fill="{bg}"/><ellipse cx="320" cy="426" rx="185" ry="16" fill="#183d2f" opacity=".06"/>{body}</svg>'''
def plate():return '<ellipse cx="320" cy="247" rx="201" ry="178" fill="url(#plate)" filter="url(#shadow)"/><ellipse cx="320" cy="245" rx="170" ry="148" fill="#efe8d9"/>'
def leaves(cx,cy,n=12,r=75):
 s=''
 for k in range(n):
  a=k*math.tau/n;x=cx+math.cos(a)*r*.65;y=cy+math.sin(a)*r*.6
  s+=f'<ellipse cx="{x:.1f}" cy="{y:.1f}" rx="{random.randrange(17,30)}" ry="{random.randrange(28,40)}" fill="{random.choice(["#276f41","#35834b","#76a648","#519758"])}" transform="rotate({k*31} {x} {y})"/>'
 return s
s=plate()+leaves(258,200,18,90)
for i in range(110):
 x=random.uniform(285,430);y=random.uniform(210,350)
 if ((x-320)/150)**2+((y-245)/130)**2<1:s+=f'<ellipse cx="{x}" cy="{y}" rx="5" ry="3" fill="{random.choice(["#d6b67c","#e5ca94","#a78f57"])}" transform="rotate({random.randrange(180)} {x} {y})"/>'
for x,y in [(215,262),(252,294),(273,252),(403,194),(421,238)]:s+=f'<circle cx="{x}" cy="{y}" r="23" fill="#c94631"/><path d="M{x-12} {y}h24M{x} {y-12}v24" stroke="#ed8256" stroke-width="3"/><circle cx="{x}" cy="{y}" r="7" fill="#ec9d53"/>'
for x,y in [(325,173),(346,191),(365,208)]:s+=f'<path d="M{x-40} {y}q35 -60 72 -2q-32 -29 -72 2" fill="#326d3f"/><path d="M{x-35} {y-2}q31 -49 61 -1q-30 -19 -61 1" fill="#b6ce65"/>'
s+='<path d="M173 340Q315 369 439 313" stroke="#f8f0cf" stroke-width="6" fill="none" opacity=".8"/>'
(out/'bowl.svg').write_text(wrap(s,'#e8eddc'))
s='<ellipse cx="320" cy="374" rx="214" ry="45" fill="url(#plate)" filter="url(#shadow)"/><g filter="url(#shadow)"><path d="M177 319Q320 345 463 319L452 359Q320 397 188 359Z" fill="url(#bun)"/><path d="M177 303Q218 290 260 306T344 304T463 302L458 324Q319 349 182 323Z" fill="#5d3020"/><path d="M173 280L220 269L259 288L308 268L363 283L410 266L468 283L444 308L392 297L348 316L297 297L244 310L201 295Z" fill="#f2bb36"/><path d="M177 255Q245 232 314 251T463 253L459 273Q320 297 182 273Z" fill="#bb3c2f"/><path d="M170 234L197 217L226 233L252 217L284 234L319 216L351 234L386 215L416 232L446 216L473 237L457 259L427 244L396 264L364 246L330 263L299 246L265 265L235 246L204 261L178 249Z" fill="#639642"/><path d="M174 227C178 65 460 65 468 227Q320 254 174 227Z" fill="url(#bun)"/></g>'
for i in range(32):
 x=random.uniform(200,440);y=random.uniform(130,213)
 if ((x-320)/133)**2+((y-225)/120)**2<1:s+=f'<ellipse cx="{x}" cy="{y}" rx="5" ry="2" fill="#ffe4b3" transform="rotate({random.randrange(180)} {x} {y})"/>'
(out/'burger.svg').write_text(wrap(s,'#f3e6d2'))
s=plate()+'<circle cx="320" cy="240" r="156" fill="#c78237"/><circle cx="320" cy="240" r="142" fill="#e7a44e"/><circle cx="320" cy="240" r="130" fill="#b74628"/><circle cx="320" cy="240" r="122" fill="#f0c968"/>'
for a in range(0,360,60):
 x=320+math.cos(math.radians(a))*81;y=240+math.sin(math.radians(a))*81
 s+=f'<circle cx="{x}" cy="{y}" r="27" fill="#bd432a"/><circle cx="{x}" cy="{y}" r="21" fill="#dd6640"/><path d="M{x-11} {y}h22M{x} {y-11}v22" stroke="#f2aa67" stroke-width="3"/>'
 s+=f'<ellipse cx="{x+23}" cy="{y+17}" rx="12" ry="25" fill="#3b7b3e" transform="rotate({a} {x+23} {y+17})"/>'
for i in range(30):
 x=random.uniform(220,420);y=random.uniform(140,340);s+=f'<circle cx="{x}" cy="{y}" r="{random.randrange(2,6)}" fill="#f7dea0"/>'
(out/'pizza.svg').write_text(wrap(s,'#eee3d7'))
s=plate()+'<ellipse cx="320" cy="245" rx="154" ry="131" fill="#9c3c20"/><ellipse cx="320" cy="240" rx="146" ry="124" fill="#c9672e"/>'
for i in range(16):
 x=random.uniform(220,420);y=random.uniform(165,320);s+=f'<rect x="{x-16}" y="{y-12}" width="33" height="28" rx="7" fill="{random.choice(["#f2b86b","#e2a653","#efc38b"])}" transform="rotate({random.randrange(-30,30)} {x} {y})"/>'
s+='<path d="M239 199C370 147 408 243 330 276S219 321 381 315" fill="none" stroke="#ffe3bb" stroke-width="6"/>'+leaves(325,223,5,25)
(out/'curry.svg').write_text(wrap(s,'#f3e4d2'))
s='<ellipse cx="320" cy="355" rx="191" ry="64" fill="url(#plate)" filter="url(#shadow)"/><g filter="url(#shadow)"><path d="M204 232L351 176L444 248L298 310Z" fill="#4f2c27"/><path d="M204 232L298 310L298 360L204 286Z" fill="#4a2927"/><path d="M298 310L444 248L444 295L298 360Z" fill="#63372e"/><path d="M215 244L298 315L429 259" stroke="#c28a65" stroke-width="8" fill="none"/></g><circle cx="326" cy="200" r="47" fill="#fff3d7"/><path d="M287 193Q327 180 362 197M289 208Q328 192 366 214" fill="none" stroke="#eddec1" stroke-width="4"/><path d="M280 245Q333 277 383 236" stroke="#392625" stroke-width="9" fill="none"/><circle cx="373" cy="200" r="17" fill="#c64642"/>'+leaves(385,171,3,12)
(out/'dessert.svg').write_text(wrap(s,'#eee0dd'))
s=plate()+'<ellipse cx="320" cy="244" rx="157" ry="133" fill="#965831"/>'
for i in range(70):
 x=random.uniform(225,410);y=random.uniform(160,320);s+=f'<path d="M{x-35} {y-12}q46 -24 72 0t-18 29q-60 19 -32 32" fill="none" stroke="{random.choice(["#e4b45a","#d9953d","#f0cc79"])}" stroke-width="5" stroke-linecap="round"/>'
s+=leaves(270,200,9,45)
for x,y in [(280,295),(375,213),(350,320),(225,248)]:s+=f'<path d="M{x} {y}l31 -17" stroke="#d96a39" stroke-width="10" stroke-linecap="round"/>'
(out/'noodles.svg').write_text(wrap(s,'#e5e9df'))
s='<g filter="url(#shadow)"><path d="M220 150L241 380Q320 415 399 380L420 150Z" fill="url(#glass)"/><ellipse cx="320" cy="150" rx="100" ry="29" fill="#facd71"/><path d="M359 324L380 90L430 72" fill="none" stroke="#fdf6de" stroke-width="15"/><path d="M253 179L267 350" stroke="#fff7df" stroke-width="10" opacity=".5" stroke-linecap="round"/></g>'
for x,y in [(284,179),(335,199),(307,237),(361,153)]:s+=f'<rect x="{x-15}" y="{y-15}" width="35" height="35" rx="7" fill="#fffbd8" opacity=".4" transform="rotate(18 {x} {y})"/>'
s+='<circle cx="226" cy="154" r="41" fill="#659447"/><circle cx="226" cy="154" r="34" fill="#cddf84"/><path d="M197 154h58M226 125v58M205 133l42 42M205 175l42 -42" stroke="#f1edb5" stroke-width="3"/>'
(out/'drink.svg').write_text(wrap(s,'#e9eada'))
s='<ellipse cx="320" cy="380" rx="180" ry="40" fill="url(#plate)" filter="url(#shadow)"/>'
for i in range(15):
 x=210+i*14;y=random.randrange(130,185);s+=f'<rect x="{x}" y="{y}" width="18" height="190" rx="4" fill="{random.choice(["#e2a336","#efb442","#f7ca64"])}" transform="rotate({random.randrange(-15,15)} {x} 310)"/>'
s+='<path d="M211 262Q320 302 431 262L406 372Q320 409 236 372Z" fill="#bf583c" filter="url(#shadow)"/><path d="M222 274Q320 314 420 274" fill="none" stroke="#d57655" stroke-width="9"/><circle cx="320" cy="345" r="25" fill="#f9e8c9"/><path d="M309 345l8 8l17 -18" fill="none" stroke="#bf583c" stroke-width="5" stroke-linecap="round"/>'
(out/'fries.svg').write_text(wrap(s,'#eee6d5'))
(out.parent/'favicon.svg').write_text('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><rect width="64" height="64" rx="20" fill="#125a45"/><path d="M19 43C12 15 46 12 49 15C49 45 31 50 19 43Z" fill="#d8eda6"/><path d="M19 46L39 26" stroke="#125a45" stroke-width="5"/></svg>')
print('Created 8 original food illustrations and favicon.')
