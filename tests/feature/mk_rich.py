import zipfile, base64, glob, sys
out=sys.argv[1]
fonts=['/usr/share/fonts/truetype/dejavu/DejaVuSerif.ttf']
font=open(fonts[0],'rb').read() if fonts else None
png=base64.b64decode('iVBORw0KGgoAAAANSUhEUgAAAEAAAAAgCAIAAAAt/+nTAAAAKElEQVR4nO3OMQEAAAjDMMC/Z5DBkQpI03aTUxaJSCQikYhEIhKJSE4PeVYCPaq7IaUAAAAASUVORK5CYII=')
lorem=("The river ran quietly past the old mill, where the miller had worked for forty years. "*8).strip()
def chap(n,title,extra=''):
    return f'''<?xml version="1.0" encoding="utf-8"?><html xmlns="http://www.w3.org/1999/xhtml" xmlns:epub="http://www.idpf.org/2007/ops"><head><title>{title}</title><link rel="stylesheet" href="../Styles/book.css"/></head><body>
<h1 id="top">{title}</h1>
<p>It was a <em>remarkably</em> quiet morning, and the <strong>bell</strong> had not yet rung.<a epub:type="noteref" href="#fn{n}">{n}</a> {lorem}</p>
<blockquote><p>“A quoted passage sits apart from the main text,” she said.</p></blockquote>
<ul><li>First item in a list</li><li>Second item with <code>code()</code> inside</li></ul>
<p>Water is H<sub>2</sub>O and the 1<sup>st</sup> rule applies. {lorem}</p>
<hr/>
<p>After the scene break, a new paragraph begins. {lorem}</p>
{extra}
<h2 id="sub{n}">Section {n}.1</h2>
<p>{lorem} {lorem}</p>
<aside epub:type="footnote" id="fn{n}"><p>{n}. This is footnote {n}, explaining the bell.</p></aside>
</body></html>'''
z=zipfile.ZipFile(out,'w')
z.writestr(zipfile.ZipInfo('mimetype'),'application/epub+zip')
z.writestr('META-INF/container.xml','<?xml version="1.0"?><container version="1.0" xmlns="urn:oasis:names:tc:opendocument:xmlns:container"><rootfiles><rootfile full-path="OEBPS/content.opf" media-type="application/oebps-package+xml"/></rootfiles></container>')
man=['<item id="nav" href="nav.xhtml" media-type="application/xhtml+xml" properties="nav"/>','<item id="css" href="Styles/book.css" media-type="text/css"/>','<item id="img" href="Images/pic.png" media-type="image/png"/>']
spine=[]
for n in range(1,4):
    man.append(f'<item id="c{n}" href="Text/c{n}.xhtml" media-type="application/xhtml+xml"/>'); spine.append(f'<itemref idref="c{n}"/>')
    z.writestr(f'OEBPS/Text/c{n}.xhtml', chap(n,f'Chapter {n}', '<p><img src="../Images/pic.png" alt="A picture"/></p>' if n==2 else ''))
if font:
    man.append('<item id="f1" href="Fonts/BookFace.ttf" media-type="font/ttf"/>'); z.writestr('OEBPS/Fonts/BookFace.ttf',font)
z.writestr('OEBPS/Styles/book.css','@font-face{font-family:"BookFace";src:url(../Fonts/BookFace.ttf);font-weight:normal;font-style:normal}\nbody{font-family:"BookFace",serif}\np{text-indent:1em}\ncode{font-family:monospace}')
z.writestr('OEBPS/Images/pic.png',png)
nav='<?xml version="1.0"?><html xmlns="http://www.w3.org/1999/xhtml" xmlns:epub="http://www.idpf.org/2007/ops"><body><nav epub:type="toc"><ol>'+''.join(f'<li><a href="Text/c{n}.xhtml">Chapter {n}</a><ol><li><a href="Text/c{n}.xhtml#sub{n}">Section {n}.1</a></li></ol></li>' for n in range(1,4))+'</ol></nav></body></html>'
z.writestr('OEBPS/nav.xhtml',nav)
z.writestr('OEBPS/content.opf',f'<?xml version="1.0"?><package xmlns="http://www.idpf.org/2007/opf" version="3.0" unique-identifier="id"><metadata xmlns:dc="http://purl.org/dc/elements/1.1/"><dc:title>Rich Test Book</dc:title><dc:language>en</dc:language><dc:identifier id="id">x</dc:identifier></metadata><manifest>{"".join(man)}</manifest><spine>{"".join(spine)}</spine></package>')
z.close(); print('font' if font else 'nofont')
