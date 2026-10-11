from pathlib import Path
from reportlab.pdfgen import canvas
from pypdf import PdfReader
from zipfile import ZipFile
import xml.etree.ElementTree as ET
root = Path('C:/projetos-sites-guit/univesp-study-landing-page')
out = root / 'apresentacao-comunidade'
pdf = out / 'Aprova-UNIVESP-comunidade.pdf'
c = canvas.Canvas(str(pdf), pagesize=(960,540))
c.setTitle('Aprova UNIVESP - Apresentação para a comunidade')
c.setAuthor('Fabio VSena')
for i in range(1,10):
    c.drawImage(str(root / '.presentation-build' / f'slide-{i}.png'),0,0,width=960,height=540)
    if i == 9:
        c.linkURL('https://univesp-study-landing-page.vercel.app/',(60,240,900,310),relative=0,thickness=0)
    c.showPage()
c.save()
assert len(PdfReader(str(pdf)).pages) == 9
ns = {'a':'http://schemas.openxmlformats.org/drawingml/2006/main'}
script = '# Aprova UNIVESP\n\nApresentação para a comunidade. Duração sugerida: cerca de 7 minutos.\n\n'
with ZipFile(out / 'Aprova-UNIVESP-comunidade.pptx') as z:
    for i in range(1,10):
        el = ET.fromstring(z.read(f'ppt/notesSlides/notesSlide{i}.xml'))
        content = '\n'.join(x.text or '' for x in el.findall('.//a:t',ns)).split('Fontes:')[0].strip()
        script += f'## Slide {i}\n\n{content}\n\n'
(out/'Roteiro-de-apresentacao.md').write_text(script,encoding='utf-8')
print('PDF verificado: 9 páginas. Roteiro salvo.')
