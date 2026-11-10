import json, zipfile, html, re, os, sys
B=os.path.dirname(os.path.abspath(__file__))+'/'
names=json.load(open(B+'Bible-kjv/Books.json'))
OT=names[:39]
LONG={'Psalms':'Psalm'}
def esc(s): return html.escape(s, quote=False)
def page(title, body):
    return f'''<?xml version="1.0" encoding="utf-8"?>
<!DOCTYPE html>
<html xmlns="http://www.w3.org/1999/xhtml" xmlns:epub="http://www.idpf.org/2007/ops" xml:lang="en"><head><title>{esc(title)}</title><link rel="stylesheet" href="bible.css"/></head><body>
{body}
</body></html>'''
CSS="h2{text-align:center} h3{text-align:center;margin-top:1.4em} sup{font-size:.6em;color:#888} p.v{margin:0;text-indent:0} p.l{margin:0 0 0 1.5em;text-indent:-1em} p.d{font-style:italic;text-align:center} .st{margin:.6em 0}"
def chap_label(book,n): return f"{LONG.get(book,book)} {n}"
def kjv_book(book):
    d=json.load(open(B+'Bible-kjv/'+book.replace(' ','')+'.json'))
    out=[f'<section epub:type="chapter" id="b"><h2>{esc(book)}</h2>']; chs=[]
    for ch in d['chapters']:
        n=int(ch['chapter']); cid=f'c{n}'; chs.append((cid,chap_label(book,n)))
        out.append(f'<h3 id="{cid}">{chap_label(book,n)}</h3>')
        for v in ch['verses']:
            out.append(f'<p class="v"><sup>{v["verse"]}</sup> {esc(v["text"].strip())}</p>')
    out.append('</section>'); return '\n'.join(out), chs
def web_book(book):
    d=json.load(open(B+'world-english-bible/json/'+book.lower().replace(' ','')+'.json'))
    out=[f'<section epub:type="chapter" id="b"><h2>{esc(book)}</h2>']; chs=[]; cur=0; lastv=None; para=None; pend=[]; inst=False
    def flush():
        nonlocal para
        if para: out.append('<p>'+''.join(para).strip()+'</p>'); para=None
    for o in d:
        t=o['type']
        if t=='header': pend.append(o['value']); continue
        cn=o.get('chapterNumber')
        if cn and cn!=cur:
            open_para = para is not None; flush()
            cur=cn; cid=f'c{cn}'; chs.append((cid,chap_label(book,cn)))
            out.append(f'<h3 id="{cid}">{chap_label(book,cn)}</h3>'); lastv=None
            for h in pend: out.append(f'<p class="d">{esc(h)}</p>')
            pend=[]
            if open_para: para=[]
        elif pend and t in ('paragraph text','line text'):
            for h in pend: out.append(f'<p class="d">{esc(h)}</p>')
            pend=[]
        if t=='paragraph start': flush(); para=[]
        elif t=='paragraph end': flush()
        elif t=='stanza start': flush(); out.append('<div class="st">'); inst=True
        elif t=='stanza end': flush(); out.append('</div>'); inst=False
        elif t in ('paragraph text','line text'):
            v=o.get('verseNumber'); txt=esc(o['value'])
            num = f'<sup>{v}</sup> ' if v and (v,cur)!=lastv else ''
            lastv=(v,cur)
            if t=='line text': flush(); out.append(f'<p class="l">{num}{txt.strip()}</p>')
            else:
                if para is None: para=[]
                para.append(num+txt)
        elif t in ('line break','break'): pass
    flush()
    if inst: out.append('</div>')
    out.append('</section>'); return '\n'.join(out), chs
def build(kind, title, out_path, desc, rights):
    files=[]; nav_ot=[]; nav_nt=[]
    for i,bk in enumerate(names):
        body,chs=(kjv_book if kind=='kjv' else web_book)(bk)
        fn=f'b{i+1:02d}.xhtml'; files.append((fn,page(bk,body)))
        li=f'<li><a href="{fn}#b">{esc(bk)}</a><ol>'+''.join(f'<li><a href="{fn}#{c}">{esc(l)}</a></li>' for c,l in chs)+'</ol></li>'
        (nav_ot if bk in OT else nav_nt).append(li)
    tp=page(title, f'<section epub:type="titlepage"><h1>{esc(title)}</h1><p style="text-align:center">{esc(desc)}</p><p style="text-align:center">{esc(rights)}</p></section>')
    nav=page('Contents', f'<nav epub:type="toc" id="toc"><h1>Contents</h1><ol><li><a href="title.xhtml">{esc(title)}</a></li><li><a href="{files[0][0]}#b">Old Testament</a><ol>{"".join(nav_ot)}</ol></li><li><a href="{files[39][0]}#b">New Testament</a><ol>{"".join(nav_nt)}</ol></li></ol></nav>')
    man=''.join(f'<item id="i{k}" href="{fn}" media-type="application/xhtml+xml"/>' for k,(fn,_) in enumerate(files))
    spine=''.join(f'<itemref idref="i{k}"/>' for k in range(len(files)))
    opf=f'''<?xml version="1.0" encoding="utf-8"?>
<package xmlns="http://www.idpf.org/2007/opf" version="3.0" unique-identifier="uid"><metadata xmlns:dc="http://purl.org/dc/elements/1.1/"><dc:identifier id="uid">tooz-{kind}-bible</dc:identifier><dc:title>{esc(title)}</dc:title><dc:language>en</dc:language><dc:creator>{'King James Version' if kind=='kjv' else 'World English Bible'}</dc:creator><meta property="dcterms:modified">2026-11-10T00:00:00Z</meta></metadata>
<manifest><item id="nav" href="nav.xhtml" media-type="application/xhtml+xml" properties="nav"/><item id="css" href="bible.css" media-type="text/css"/><item id="tp" href="title.xhtml" media-type="application/xhtml+xml"/>{man}</manifest>
<spine><itemref idref="tp"/>{spine}</spine></package>'''
    with zipfile.ZipFile(out_path,'w') as z:
        z.writestr(zipfile.ZipInfo('mimetype'),'application/epub+zip',compress_type=zipfile.ZIP_STORED)
        z.writestr('META-INF/container.xml','<?xml version="1.0"?><container version="1.0" xmlns="urn:oasis:names:tc:opendocument:xmlns:container"><rootfiles><rootfile full-path="OEBPS/content.opf" media-type="application/oebps-package+xml"/></rootfiles></container>',compress_type=zipfile.ZIP_DEFLATED)
        z.writestr('OEBPS/content.opf',opf,compress_type=zipfile.ZIP_DEFLATED)
        z.writestr('OEBPS/nav.xhtml',nav,compress_type=zipfile.ZIP_DEFLATED)
        z.writestr('OEBPS/bible.css',CSS,compress_type=zipfile.ZIP_DEFLATED)
        z.writestr('OEBPS/title.xhtml',tp,compress_type=zipfile.ZIP_DEFLATED)
        for fn,x in files: z.writestr('OEBPS/'+fn,x,compress_type=zipfile.ZIP_DEFLATED)
    print(out_path, os.path.getsize(out_path))
O='/home/claude/readfast-app/books/'
build('kjv','The Holy Bible: King James Version',O+'bible-kjv.epub','The Authorized Version of 1611, in the standard 1769 text.','Public domain.')
build('web','The Holy Bible: World English Bible',O+'bible-web.epub','A modern English translation based on the American Standard Version of 1901.','Public domain. “World English Bible” is a trademark of eBible.org.')
