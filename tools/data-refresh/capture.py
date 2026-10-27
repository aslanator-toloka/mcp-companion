import concurrent.futures, datetime, http.cookiejar, json, pathlib, time, urllib.request

import sys,re
ROOT=pathlib.Path(sys.argv[1]).resolve()
APP=pathlib.Path(sys.argv[2]).resolve()
BASE='https://www.jarvis-protocol.com'
for sub in ('cards','boxes','layouts'): (ROOT/sub).mkdir(parents=True,exist_ok=True)
opener=urllib.request.build_opener(urllib.request.HTTPCookieProcessor(http.cookiejar.CookieJar()))
opener.addheaders=[('User-Agent','Mozilla/5.0')]
opener.open(BASE+'/characters',timeout=45).read()
def fetch(endpoint):
    for attempt in range(4):
        try:
            req=urllib.request.Request(BASE+'/api/'+endpoint,headers={'X-Locale':'en','Referer':BASE+'/characters','Content-Type':'application/json'})
            return json.load(opener.open(req,timeout=45))
        except Exception:
            if attempt==3: raise
            time.sleep(2*(attempt+1))
def write(file,value):
    temporary=file.with_suffix(file.suffix+'.tmp');temporary.write_text(json.dumps(value,ensure_ascii=False,indent=2)+'\n');temporary.replace(file)
for endpoint,name in [('characters','characters'),('team_tactics_cards','tactics'),('crisis_cards','crises'),('box_sets','boxes'),('artworks','artworks')]:
    target=ROOT/(name+'.json');value=json.loads(target.read_text()) if target.exists() else fetch(endpoint);write(target,value);print(name,len(value),flush=True)
characters=[r for r in json.loads((ROOT/'characters.json').read_text()) if not r.get('isAlternateSculpt')]
def detail(row):
    assert re.fullmatch(r'[a-z0-9-]+',row['slug'])
    target=ROOT/'cards'/(row['slug']+'.json');result=json.loads(target.read_text()) if target.exists() else fetch('characters/'+row['slug']);write(target,result)
    card={'statCard':result['statCard'],'secondStatCard':result.get('secondStatCard')}
    old=APP/'data/cards'/(row['slug']+'.json')
    return row['slug'] if not old.exists() or json.loads(old.read_text())!=card else None
with concurrent.futures.ThreadPoolExecutor(max_workers=4) as pool:
    changed=[slug for slug in pool.map(detail,characters) if slug]
print('changed cards',changed,flush=True)
boxes=json.loads((ROOT/'boxes.json').read_text())
def box(row):
    assert re.fullmatch(r'[A-Za-z0-9_-]+',row['code'])
    target=ROOT/'boxes'/(row['code']+'.json')
    if not target.exists(): write(target,fetch('box_sets/'+row['code']))
with concurrent.futures.ThreadPoolExecutor(max_workers=4) as pool: list(pool.map(box,boxes))
write(ROOT/'capture-manifest.json',{'fetchedAt':datetime.datetime.now(datetime.timezone.utc).isoformat(),'characters':len(characters),'changedCards':changed,'complete':True})
print('complete',flush=True)
