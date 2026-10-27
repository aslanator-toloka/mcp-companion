"""Durable MCP refresh stages. Source data and logs stay outside Pages."""
import argparse
import datetime as dt
import fcntl
import hashlib
import json
import os
from pathlib import Path
import re
import subprocess as sp
import sys
import time
import urllib.request

STAGES = ['capture', 'apply', 'roles', 'references', 'scrape', 'countries',
          'prepare', 'validate', 'rating', 'build', 'tests', 'browser']
DEFAULT_PROJECT = str(Path(__file__).resolve().parents[2])


def read(path):
    return json.loads(Path(path).read_text())


def atomic(path, value):
    path = Path(path)
    path.parent.mkdir(parents=True, exist_ok=True)
    temp = path.with_suffix('.tmp')
    temp.write_text(json.dumps(value, indent=2) + '\n')
    temp.replace(path)


def summary(status):
    return {k: status[k] for k in ['state', 'stage', 'progress', 'error', 'log', 'commit'] if status.get(k) is not None}


def remaining(done, start=None):
    done = set(done)
    if start:
        done -= set(STAGES[STAGES.index(start):])
    return [name for name in STAGES if name not in done]


class Runner:
    def __init__(self, directory):
        self.directory = Path(directory).resolve()
        self.config = read(self.directory/'job.json')
        self.status_file = self.directory/'status.json'
        self.status = read(self.status_file) if self.status_file.exists() else {'completed': []}
        self.project = Path(self.config['project'])
        self.scraper = Path(self.config['scraper'])
        self.source = Path(self.config['source'])
        self.capture = Path(self.config['capture'])

    def write(self, **values):
        self.status.update(values, updatedAt=dt.datetime.now(dt.timezone.utc).isoformat())
        atomic(self.status_file, self.status)

    def command(self, command):
        log = self.directory/'logs'/(self.status['stage']+'.log')
        log.parent.mkdir(exist_ok=True)
        self.write(log=str(log))
        with log.open('ab') as output:
            child = sp.Popen(list(map(str, command)), cwd=self.project, stdout=output, stderr=sp.STDOUT)
            self.write(childPid=child.pid)
            while child.poll() is None:
                try:
                    child.wait(timeout=50)
                except sp.TimeoutExpired:
                    progress = {'savedRosterFiles': len(list((self.source/'roster_details').glob('*.json')))} if self.status['stage'] == 'scrape' else {}
                    self.write(progress=progress)
                    print(json.dumps(summary(self.status)), flush=True)
        self.write(childPid=None)
        return child.returncode

    def checked(self, command):
        if self.command(command):
            raise RuntimeError('Command failed; inspect the stage log, not the entire archive')

    def execute(self, name, operation):
        if name in self.status['completed']:
            return
        self.write(state='running', stage=name, error=None, log=None, progress={}, ownerPid=os.getpid())
        print(json.dumps(summary(self.status)), flush=True)
        try:
            operation()
        except Exception as error:
            self.write(state='needs_attention', error=str(error), childPid=None)
            raise
        self.write(completed=self.status['completed']+[name])

    def check_source(self):
        manifest = read(self.source/'manifest.json')
        assert manifest['complete'] and manifest['errors'] == 0, 'Incomplete source archive'
        assert manifest['scope'] == 'all_played_records'
        assert manifest['end'] == self.config['end']
        assert manifest['filters']['min_win'] is None and manifest['filters']['max_loss'] is None
        return manifest

    def scrape(self):
        command = [self.scraper/'.venv/bin/python', self.scraper/'full_results.py',
                   '--start', self.config['start'], '--end', self.config['end'],
                   '--output', self.source, '--delay', '20', '--workers', '4']
        if self.config.get('previous'):
            command += ['--incremental-from', self.config['previous'], '--reuse-rosters', self.config['previous']]
        for attempt in range(3):
            result = self.command(command)
            if result == 0:
                self.check_source()
                return
            errors = read(self.source/'errors.json') if (self.source/'errors.json').exists() else []
            # Parser/identity/CAPTCHA failures require inspection, never blind retries.
            transient = errors and all(re.search(r'timed out|timeout|connection|retries exhausted', e['error'], re.I) for e in errors)
            if not transient or attempt == 2:
                raise RuntimeError('Source failed; inspect errors.json and the stage log. Cached successes are preserved.')
            self.write(progress={'cachedRetry': attempt+1})
        raise RuntimeError('Source retry limit reached')

    def prepare(self):
        self.check_source()
        self.checked(['python3', 'scripts/prepare-tournament-data.py', '--source', self.source])
        keys = ['source', 'start', 'end', 'generated_at', 'scope', 'filters', 'events', 'results',
                'roster_variants', 'zero_win_results', 'four_plus_loss_results', 'scored_results',
                'provisional_results', 'complete', 'errors']
        manifest = self.check_source()
        atomic(self.project/'data/tournament-refresh-audit.json', {k: manifest[k] for k in keys})

    def operations(self):
        return {
            'capture': lambda: self.checked(['python3', Path(__file__).with_name('capture.py'), self.capture, self.project]),
            'apply': lambda: self.checked(['node', 'scripts/apply-jarvis-refresh.mjs', self.capture]),
            'roles': lambda: self.checked(['node', '--test', 'tests/character-roles.test.cjs']),
            'references': lambda: self.checked(['python3', 'scripts/sync-rule-references.py']),
            'scrape': self.scrape,
            'countries': lambda: self.checked([self.scraper/'.venv/bin/python', self.scraper/'build_player_countries.py', '--data', self.source]),
            'prepare': self.prepare,
            'validate': lambda: self.checked(['node', 'scripts/validate-tournament-data.cjs', 'tournaments/data.js', self.source]),
            'rating': lambda: self.checked(['npm', 'run', 'audit:rating']),
            'build': lambda: self.checked(['npm', 'run', 'build']),
            'tests': lambda: self.checked(['npm', 'test']),
            'browser': lambda: self.checked(['npm', 'run', 'test:e2e']),
        }

    def run(self, start=None):
        # One runner per repository; hold the lock through all stages.
        lock = (self.project.parent/'.mcp-data-refresh.lock').open('w')
        fcntl.flock(lock, fcntl.LOCK_EX | fcntl.LOCK_NB)
        check_lease(self.project, self.directory)
        child = self.status.get('childPid')
        if child:
            try:
                os.kill(child, 0)
            except ProcessLookupError:
                pass
            else:
                raise RuntimeError('A previously started child still runs; do not launch a duplicate')
        todo = remaining(self.status['completed'], start)
        self.write(completed=[s for s in self.status['completed'] if s not in todo])
        for name in todo:
            self.execute(name, self.operations()[name])
        self.write(state='ready_to_publish', stage='review', error=None)
        print(json.dumps(summary(self.status)), flush=True)

    def finalize(self, commit, origin):
        assert not remaining(self.status['completed']), 'Validation stages are unfinished'
        manifest = self.check_source()
        assert re.fullmatch(r'[a-f0-9]{40}', commit), 'Use the exact pushed commit SHA'
        tournament = sp.check_output(['git', 'show', f'{commit}:tournaments/data.js'], cwd=self.project)
        payload = json.loads(tournament.decode().split('=', 1)[1].strip().removesuffix(';'))
        assert payload['meta']['end'] == self.config['end'], 'Commit contains a different cutoff'
        assert payload['meta']['snapshot'] == manifest['generated_at'], 'Commit contains another snapshot'
        for name in ['index.html', 'tournaments/data.js', 'data/catalog.json']:
            expected = tournament if name == 'tournaments/data.js' else sp.check_output(['git', 'show', f'{commit}:{name}'], cwd=self.project)
            actual = urllib.request.urlopen(origin.rstrip('/')+'/'+name+'?verify='+str(time.time_ns()), timeout=40).read()
            assert hashlib.sha256(expected).digest() == hashlib.sha256(actual).digest(), 'Live file is stale: '+name
        state_file = self.scraper/'update_state.json'
        state = read(state_file) if state_file.exists() else {}
        state['last_success'] = {'end': self.config['end'], 'snapshot': str(self.source),
                                 'completed_at': dt.datetime.now(dt.timezone.utc).isoformat(),
                                 'events': manifest['events'], 'pages_commit': commit}
        atomic(state_file, state)
        self.write(state='complete', stage='published', commit=commit, error=None)
        release_lease(self.project, self.directory)
        print(json.dumps(summary(self.status)))



def check_lease(project, directory):
    lease = Path(project).parent/'.mcp-data-refresh-active.json'
    if lease.exists() and read(lease)['runDir'] != str(Path(directory).resolve()):
        raise RuntimeError('Another refresh awaits completion/review: '+read(lease)['runDir'])


def release_lease(project, directory):
    lease = Path(project).parent/'.mcp-data-refresh-active.json'
    if lease.exists() and read(lease)['runDir'] == str(Path(directory).resolve()):
        lease.unlink()


def create_job(directory, end, project=DEFAULT_PROJECT, scraper=None):
    directory, project = Path(directory).resolve(), Path(project).resolve()
    dt.date.fromisoformat(end)
    check_lease(project, directory)
    assert not sp.check_output(['git', 'status', '--porcelain'], cwd=project).strip(), 'Working tree is dirty; preserve existing work before starting a new refresh'
    assert not (directory/'job.json').exists(), 'Existing job: use resume, not start'
    scraper = Path(scraper).resolve() if scraper else project.parent.parent/'longshanks_scraper'
    previous = read(scraper/'update_state.json').get('last_success', {}).get('snapshot') if (scraper/'update_state.json').exists() else None
    atomic(directory/'job.json', {'project': str(project), 'scraper': str(scraper), 'end': end,
           'start': '2026-08-10', 'previous': previous, 'capture': str(directory/'jarvis'), 'source': str(directory/'longshanks')})


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('action', choices=['start', 'resume', 'status', 'plan', 'verify', 'finalize'])
    parser.add_argument('--run-dir', required=True)
    parser.add_argument('--end')
    parser.add_argument('--project', default=DEFAULT_PROJECT)
    parser.add_argument('--scraper')
    parser.add_argument('--from-stage', choices=STAGES)
    parser.add_argument('--commit')
    parser.add_argument('--origin', default='https://aslanator-toloka.github.io/mcp-companion/')
    args = parser.parse_args()
    directory = Path(args.run_dir).resolve()
    if args.action == 'start':
        assert args.end, '--end must be the intended client date/cutoff'
        create_job(directory, args.end, args.project, args.scraper)
    runner = Runner(directory)
    if args.action == 'status':
        print(json.dumps(summary(runner.status)))
    elif args.action == 'plan':
        print(json.dumps({'remaining': remaining(runner.status['completed'], args.from_stage), 'runDir': str(directory)}))
    elif args.action == 'verify':
        manifest = runner.check_source()
        print(json.dumps({k: manifest[k] for k in ['end', 'events', 'results', 'roster_variants', 'complete', 'errors']}))
    elif args.action == 'finalize':
        runner.finalize(args.commit or '', args.origin)
    else:
        runner.run(args.from_stage)


if __name__ == '__main__':
    try:
        main()
    except Exception as error:
        print(str(error), file=sys.stderr)
        sys.exit(1)
