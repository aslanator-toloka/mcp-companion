"""Build the static character index from the saved Longshanks snapshot."""
from collections import defaultdict, Counter
import argparse
import hashlib
import json
from pathlib import Path
import re
import subprocess
import unicodedata

SITE = Path(__file__).parent
ROOT = SITE.parent


def normalize(value):
    return re.sub(r'[^a-z0-9]', '', unicodedata.normalize('NFKD', value).casefold())


def main():
    ap=argparse.ArgumentParser(description=__doc__)
    ap.add_argument('--source',type=Path,required=True)
    ap.add_argument('--output',type=Path,default=ROOT/'tournaments')
    ap.add_argument('--audit-dir',type=Path)
    args=ap.parse_args()
    source=args.source.resolve()
    args.audit_dir = args.audit_dir or source
    jarvis = json.loads((ROOT / 'data/catalog.json').read_text())
    catalog = json.loads((ROOT / 'data/character-aliases.json').read_text())['characters']
    characters = {}
    for c in jarvis['characters']:
        cid = 'prime-sentinel' if c['slug'] in ('prime-sentinel-1', 'prime-sentinel-2') else c['slug']
        characters[cid] = {'id': cid, 'name': c['name'], 'alterEgo': c['alterEgo'],
                                  'affiliations': list(dict.fromkeys(a['name'] for a in c['affiliations'])),
                                  'inventoryIds': ['prime-sentinel-1','prime-sentinel-2'] if cid=='prime-sentinel' else [c['slug']],
                                  'threat': c['threatLevel'], 'grunt': c['isGrunt'], 'count': 0, 'points': 0.0,
                                  'aliases': catalog.get(c['slug'], {}).get('aliases', [])}
    aliases = defaultdict(set)
    for cid, c in characters.items():
        for name in c['aliases'] + [c['name'], f"{c['name']} ({c['alterEgo']})", cid]:
            aliases[normalize(name)].add(cid)
    # Exact short names used in the saved public text lists.
    for name, cid in [('Nick Fury & SHIELD Agents', 'nick-fury'), ('Ulrik', 'ulik'),
                      ('Dr. Strange', 'doctor-strange'), ('Captain America Falcon', 'captain-america-sam-wilson')]:
        if cid in characters:
            aliases[normalize(name)].add(cid)

    def resolve(name, threat=None):
        found = aliases.get(normalize(name), set())
        if len(found) != 1:
            base = re.sub(r'\s*\([^)]*\)\s*$', '', name)
            found = aliases.get(normalize(base), set())
        if len(found) > 1 and threat is not None:
            found = {cid for cid in found if characters[cid]['threat'] == threat}
        return next(iter(found)) if len(found) == 1 else None

    results = json.loads((source / 'results.json').read_text())
    if any(r.get('field_size') is None for r in results):
        raise ValueError('Run enrich_places.py before preparing the scored site')
    result_index = {(r['event_id'], r['player_id']): r for r in results}
    source_rosters = json.loads((source / 'rosters.json').read_text())
    variant_counts = Counter((r['event_id'],r['participant_id']) for r in source_rosters)
    rosters, unresolved = [], []
    for original in source_rosters:
        result = result_index[(original['event_id'], original['participant_id'])]
        entries, tactics, crises, gems = [], [], [], []
        raw_text = '\n\n'.join(original.get('text_lists', []))
        if original['status'] == 'encoded':
            for groups in original['lists']:
                for item in groups.get('Characters', []):
                    cid = resolve(item['name'])
                    if not cid:
                        unresolved.append({'listId': original['list_id'], 'name': item['name']})
                    entries.append({'id': cid, 'name': item['name'], 'gems': item.get('gems', [])})
                tactics += [x['name'] for x in groups.get('Team Tactics', [])]
                crises += [x['name'] for x in groups.get('Crises', [])]
                gems += groups.get('Infinity Gems', [])
        else:
            # Match complete character lines, rather than name substrings that
            # would mix different versions of Spider-Man or Doctor Strange.
            for line in raw_text.splitlines():
                line = line.strip(' \t*`|#')
                line = re.sub(r'\s+\(\d+\)$', '', line)
                threat_match = re.search(r'\s+(\d+)\s*$', line)
                threat = int(threat_match[1]) if threat_match else None
                if threat_match:
                    line = line[:threat_match.start()].strip()
                line = re.sub(r'\s+w\.\s*Mindstone$', '', line, flags=re.I)
                line = re.sub(r'^(?:Mind|Space|Soul|Power|Reality|Time)\s+', '', line, flags=re.I)
                line = re.sub(r'\s+(?:(?:Mind|Space|Soul|Power|Reality|Time)(?:,?\s*|$))+$', '', line, flags=re.I).strip()
                cid = resolve(line, threat)
                if cid and not any(x['id'] == cid for x in entries):
                    entries.append({'id': cid, 'name': characters[cid]['name'], 'gems': []})
        ids = list(dict.fromkeys(x['id'] for x in entries if x['id']))
        variant_count = variant_counts[(original['event_id'],original['participant_id'])]
        performance_points = result.get('performance_points')
        points_share = performance_points / variant_count if performance_points is not None else None
        for cid in ids:
            characters[cid]['count'] += 1
            if points_share is not None:
                characters[cid]['points'] += points_share
        links = original.get('external_links', [])
        rosters.append({'id': f"{original['event_id']}-{original['participant_id']}-{original['list_id']}",
                        'listId': original['list_id'], 'variant': original.get('variant', 1),
                        'kind': original['status'], 'characterIds': ids, 'characters': entries,
                        'inventoryComplete': bool(entries) and all(x['id'] for x in entries) and (original['status']=='encoded' or len(entries)==10),
                        'tactics': tactics, 'crises': crises, 'gems': gems, 'rawText': raw_text or (original.get('text','') if original['status']=='restricted' else ''),
                        'player': result['player'], 'playerId': result['player_id'],
                        'event': result['event'], 'eventId': result['event_id'], 'eventUrl': result['event_url'],
                        'date': result['event_start_date'], 'location': result['location'],
                        'affiliations': result['affiliations'], 'wins': result['wins'],
                        'losses': result['losses'], 'draws': result['draws'],
                        'place':result.get('place'), 'fieldSize':result.get('field_size'),
                        'sharedPlaceCount':result.get('shared_place_count'),
                        'stage':result.get('place_stage'),'resultBasis':result.get('result_basis','individual'),'teamName':result.get('team_name'), 'provisional':result.get('place_provisional',False),
                        'performancePoints':performance_points,'pointsShare':points_share,'variantCount':variant_count,
                        'topCutPlace':result.get('top_cut_place'),'topCutFieldSize':result.get('top_cut_field_size'),
                        'topCutRecord':result.get('top_cut_record'),
                        'jarvisUrl': next((x['url'] for x in links if 'jarvis-protocol.com/' in x['url']), None)})
    if unresolved:
        print(f'Characters absent from local catalog (preserved by name, incomplete for builder): {unresolved}')
    for c in characters.values():
        del c['aliases']
    manifest = json.loads((source / 'manifest.json').read_text())
    if not manifest.get('complete'):
        raise ValueError('Cannot publish an incomplete archive')
    data = {'meta': {'start': manifest['start'], 'end': manifest['end'],
                     'events': manifest['events'], 'results': manifest['results'], 'rosters': len(rosters),
                     'scope':manifest.get('scope','successful_results'),'filters':manifest.get('filters',{}),
                     'zeroWinResults':sum(r['wins']==0 for r in results),
                     'fourPlusLossResults':sum(r['losses']>=4 for r in results),
                     'unrankedResults':sum(r.get('place') is None for r in results),
                     'encoded': sum(x['kind'] == 'encoded' for x in rosters),
                     'text': sum(x['kind'] == 'text' for x in rosters),
                     'fourTwoResults': manifest.get('four_two_results', 0),
                     'fourPlusTwoResults': manifest.get('four_plus_two_results', 0),
                     'fourTwoRosters': sum(x['wins'] == 4 and x['losses'] == 2 for x in rosters),
                     'placesMatched':sum(r.get('place') is not None for r in results),
                     'scoredResults':sum(r.get('performance_points') is not None for r in results),
                     'provisionalResults':sum(r.get('place_provisional',False) for r in results),
                     'unindexed': sum(not x['characterIds'] for x in rosters), 'snapshot': manifest['generated_at']},
            'characters': sorted(characters.values(), key=lambda c: c['name'].casefold()), 'rosters': rosters}
    data['meta']['unresolvedEncodedCharacters']=unresolved
    country_file=source/'player_countries.json'
    if country_file.exists():
        data['players']=json.loads(country_file.read_text())
        data['meta']['playerCountryCoverage']={'known':sum(bool(p.get('countryCode')) for p in data['players']),
                                               'unknown':sum(not p.get('countryCode') for p in data['players'])}
    output = args.output
    output.mkdir(parents=True,exist_ok=True)
    scored = subprocess.run(['node',str(SITE/'score-tournament-snapshot.cjs')],input=json.dumps(data),text=True,capture_output=True,check=True)
    data = json.loads(scored.stdout)
    (output / 'data.js').write_text('window.ROSTER_ATLAS = ' + json.dumps(data, ensure_ascii=False, separators=(',', ':')) + ';\n')
    (args.audit_dir / 'data-audit.json').write_text(json.dumps({'source':str(source),'snapshot':manifest['generated_at'],'data_sha256':hashlib.sha256((output/'data.js').read_bytes()).hexdigest(),'characters': len(characters), 'rosters': len(rosters),
        'unresolved_encoded_characters':unresolved,
        'text_character_counts': dict(Counter(len(x['characterIds']) for x in rosters if x['kind'] == 'text')),
        'unindexed': [{'listId': x['listId'], 'player': x['player'], 'text': x['rawText']} for x in rosters if not x['characterIds']]}, ensure_ascii=False, indent=2))
    print(f'Indexed {len(characters)} characters and {len(rosters)} rosters; {data["meta"]["unindexed"]} lists without identifiable characters')


if __name__ == '__main__':
    main()
