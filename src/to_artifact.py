import re
import os, sys
HERE=os.path.dirname(os.path.abspath(__file__))
s=open(os.path.join(HERE,'..','index.html'),encoding='utf-8').read()
head=s[s.index('<head>')+6:s.index('</head>')]
body=s[s.index('<body>')+6:s.rindex('</body>')]
head=re.sub(r'<meta charset[^>]*>\n?','',head)
head=re.sub(r'<meta name="viewport"[^>]*>\n?','',head)
head=re.sub(r'<style>:root\{color-scheme:light;.*?</style>\n?','',head,count=1,flags=re.S)
head=re.sub(r'<link rel="(apple-touch-icon|manifest)"[^>]*>\n?','',head)
assert '<title>Tooz eReader</title>' in head
head=head.replace('<title>Tooz eReader</title>','<title>Tooz eReader</title>\n<meta name="claude:viewport-fit-sides" content="cover">')
o="    if(navigator.share && navigator.canShare){"
assert body.count(o)==1
body=body.replace(o,"    try{ const c=window.claude; const dl=c&&c.use?await c.use('downloads'):null; if(dl){ await dl.save({filename, data}); backupDone(); toast('Backup saved'); return; } }catch(e){ if(e&&e.code==='declined'){ toast('Backup not saved'); return; } }\n"+o)
o="if('serviceWorker' in navigator && (location.protocol==='https:'||location.hostname==='localhost')) navigator.serviceWorker.register('sw.js').catch(()=>{});"
assert body.count(o)==1
body=body.replace(o,"/* no offline cache in this preview */")
o="'books/'+src+'.epub'"
assert body.count(o)==1
body=body.replace(o,"'https://raw.githubusercontent.com/michaelmatusikjr/readfast-app/ereader/books/'+src+'.epub'")
open(sys.argv[1] if len(sys.argv)>1 else os.path.join(HERE,'..','artifact.html'),'w',encoding='utf-8').write(head.strip()+'\n'+body.strip()+'\n')
