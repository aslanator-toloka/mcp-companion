"""One locked, restart-safe stage. Runs separately from the Temporal worker."""
import datetime as dt
import fcntl
import json
import os
from pathlib import Path
import sys
from zoneinfo import ZoneInfo

from refresh import (DEFAULT_PROJECT, Runner, STAGES, atomic, check_lease,
                     create_job, read, remaining)


def dispatch(payload):
    operation = payload['operation']
    project = Path(payload.get('project', DEFAULT_PROJECT)).resolve()
    runtime = project.parent.parent/'mcp-character-lab'
    directory = Path(payload.get('run_dir') or runtime/'refresh-runs'/('temporal-'+payload['run_id'])).resolve()
    # The lock is held by this process, including subprocesses it waits for. A
    # retried Activity waits for an orphaned driver instead of duplicating work.
    with (project.parent/'.mcp-data-refresh.lock').open('a') as lock:
        fcntl.flock(lock, fcntl.LOCK_EX)
        check_lease(project, directory)
        if operation == 'init':
            if not (directory/'job.json').exists():
                end = payload.get('end') or (dt.datetime.now(ZoneInfo('Europe/Amsterdam')).date()-dt.timedelta(days=1)).isoformat()
                create_job(directory, end, project, payload.get('scraper'))
            config = read(directory/'job.json')
            assert Path(config['project']).resolve() == project, 'Job belongs to another repository'
            if payload.get('end'):
                assert payload['end'] == config['end'], 'Resume cutoff differs from saved job'
            atomic(project.parent/'.mcp-data-refresh-active.json', {'runDir': str(directory)})
            return {'run_dir': str(directory), 'end': config['end']}
        runner = Runner(directory)
        if operation == 'stage':
            name = payload['stage']
            assert name in STAGES
            runner.execute(name, runner.operations()[name])
        elif operation == 'reset':
            todo = remaining(runner.status['completed'], payload['stage'])
            runner.write(completed=[s for s in runner.status['completed'] if s not in todo])
        elif operation == 'ready':
            assert not remaining(runner.status['completed'])
            runner.write(state='ready_to_publish', stage='review', error=None)
        elif operation == 'finalize':
            runner.finalize(payload['commit'], payload.get('origin', 'https://aslanator-toloka.github.io/mcp-companion/'))
        else:
            raise ValueError('Unknown operation: '+operation)
        return {'run_dir': str(directory), 'state': runner.status['state']}


if __name__ == '__main__':
    try:
        result = dispatch(json.loads(sys.argv[1]))
        print(json.dumps({'result': result}), flush=True)
    except Exception as error:
        print(str(error), file=sys.stderr, flush=True)
        sys.exit(1)
