"""Create a readable two-column, four-view geometric comparison artifact."""
import sys
from PIL import Image, ImageDraw,ImageFont
root='/tmp/3dcell-qa';before=sys.argv[1] if len(sys.argv)>1 else 'baseline';after=sys.argv[2] if len(sys.argv)>2 else 'rebuilt'
fontpath='/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf'
font=ImageFont.truetype(fontpath,26);small=ImageFont.truetype(fontpath,19);bold=ImageFont.truetype(fontpath,36)
W=1480;tile=720;header=124;gap=20;row=714
sheet=Image.new('RGB',(W,header+4*row+38),'#edf0f2');d=ImageDraw.Draw(sheet)
d.rectangle((0,0,W,header),fill='#182733');d.text((22,16),'Breast geometry: before and rebuilt',fill='white',font=bold)
d.text((22,66),'Actual runtime skin mesh | Fixed cameras | Software render, not WebGL / browser',fill='#cbd6df',font=small)
for i,(view,title) in enumerate([('front','Front'),('side','Side'),('oblique','Oblique'),('inferior','Inferior')]):
 for col,(label,heading) in enumerate([(before,'Before (baseline)'),(after,'Rebuilt')]):
  x=10+col*(tile+20);y=header+i*row
  d.text((x+8,y+5),f'{heading} · {title}',font=font,fill='#182733')
  # Crop only renderer's small label bar; geometry/camera pixels remain unchanged.
  im=Image.open(f'{root}/{label}-{view}.png').crop((0,54,960,960));im=im.resize((tile,680),Image.Resampling.LANCZOS);sheet.paste(im,(x,y+34))
d.text((20,header+4*row+8),'Skin geometry only. Clinical accuracy and interactive/shader behavior are not certified by this review.',fill='#394a56',font=small)
sheet.save(f'{root}/breast-geometry-comparison.png');print(f'{root}/breast-geometry-comparison.png')
