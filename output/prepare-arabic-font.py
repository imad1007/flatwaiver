import sys, pathlib, urllib.request, urllib.parse
sys.path.insert(0, str(pathlib.Path('output/font-tools').resolve()))
from fontTools.ttLib import TTFont
from fontTools.varLib.instancer import instantiateVariableFont
dest = pathlib.Path('public/fonts/waivers')
dest.mkdir(parents=True, exist_ok=True)
families = [('notonaskharabic','NotoNaskhArabic[wght].ttf','Arabic')]
for directory, filename, label in families:
 base='https://raw.githubusercontent.com/google/fonts/main/ofl/'+directory+'/'
 temp=pathlib.Path('output')/filename
 urllib.request.urlretrieve(base+urllib.parse.quote(filename),temp)
 urllib.request.urlretrieve(base+'OFL.txt',dest/(label+'-OFL.txt'))
 font=TTFont(temp)
 axes={a.axisTag:a.defaultValue for a in font['fvar'].axes}
 axes['wght']=400
 static=instantiateVariableFont(font,axes,inplace=True)
 static.save(dest/(label+'.ttf'))
 print(label, (dest/(label+'.ttf')).stat().st_size, flush=True)
