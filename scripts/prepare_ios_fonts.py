# Optional regeneration: use fontTools in an isolated Python environment.
# Source fonts: Google Fonts ofl/notoserifsc, notosanssc, mashanzheng; SIL OFL.
import pathlib,re,copy,shutil
from fontTools.ttLib import TTFont
from fontTools import subset
from fontTools.varLib.instancer import instantiateVariableFont
root=pathlib.Path(__file__).resolve().parent.parent; dest=root/'ios/JiangshanAtlas/Resources/Fonts'; src=root/'ios/.build/font-sources'
text=''.join(p.read_text() for p in [*root.glob('js/*.js'),*root.glob('ios/JiangshanAtlas/*.swift'),root/'assets/tang_focus.json',root/'index.html'])
chars={ord(c) for c in text}|set(range(32,592))|set(range(0x2000,0x2070))|{0x2460+i for i in range(20)}
for package,filename,weights in [('notoserifsc','NotoSerifSC[wght].ttf',[400,600,700]),('notosanssc','NotoSansSC[wght].ttf',[400,500,700]),('mashanzheng','MaShanZheng-Regular.ttf',[])]:
 font=TTFont(src/(package+'-'+filename));opts=subset.Options();opts.name_IDs=['*'];opts.name_legacy=True;opts.layout_features=['*'];sub=subset.Subsetter(options=opts);sub.populate(unicodes=chars);sub.subset(font)
 for weight in weights or [None]:
  out=instantiateVariableFont(copy.deepcopy(font),{'wght':weight},inplace=True,updateFontNames=True) if weight else font
  name=out['name'].getDebugName(6);out.save(dest/(name+'.ttf'));print(name,flush=True)
 shutil.copyfile(src/(package+'-OFL.txt'),dest/(package+'-OFL.txt'))
