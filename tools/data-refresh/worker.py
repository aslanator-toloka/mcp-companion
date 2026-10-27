import asyncio
from datetime import timedelta
import json
import logging
import os
from pathlib import Path
import signal
import sys

from temporalio import activity
from temporalio.client import Client
from temporalio.exceptions import ApplicationError
from temporalio.worker import Worker
from workflows import RefreshPublicData, TASK_QUEUE

ADDRESS = os.environ.get('MCP_TEMPORAL_ADDRESS', '127.0.0.1:7333')
NAMESPACE = 'mcp-refresh'


@activity.defn(name='refresh_step')
async def refresh_step(payload: dict) -> dict:
    # Keep heavy work out of the event loop. Each driver keeps the repository
    # lock until its child exits, even if this worker itself is killed.
    project = Path(payload.get('project', Path(__file__).resolve().parents[2]))
    logs = project.parent.parent/'mcp-character-lab/temporal-runtime/logs'
    logs.mkdir(parents=True, exist_ok=True)
    step = payload.get('stage', payload['operation'])
    log = logs/(activity.info().workflow_run_id+'-'+step+'.log')
    with log.open('ab') as output:
        process = await asyncio.create_subprocess_exec(
            sys.executable, str(Path(__file__).with_name('driver.py')), json.dumps(payload),
            stdout=output, stderr=asyncio.subprocess.STDOUT, start_new_session=True,
        )
        try:
            while process.returncode is None:
                details = {'operation': payload['operation'], 'stage': step, 'log': str(log)}
                if payload.get('run_dir'):
                    status_file = Path(payload['run_dir'])/'status.json'
                    if status_file.exists():
                        try:
                            status = json.loads(status_file.read_text())
                            details.update({k: status.get(k) for k in ['state', 'progress']})
                        except (OSError, ValueError):
                            pass
                activity.heartbeat(details)
                try:
                    await asyncio.wait_for(process.wait(), timeout=10)
                except asyncio.TimeoutError:
                    pass
        except asyncio.CancelledError:
            try:
                os.killpg(process.pid, signal.SIGTERM)
                await asyncio.wait_for(process.wait(), timeout=10)
            except ProcessLookupError:
                pass
            except asyncio.TimeoutError:
                os.killpg(process.pid, signal.SIGKILL)
                await process.wait()
            raise
    # Driver failures mean validation/source review, not automatic blind retry.
    # Worker death / heartbeat loss remain retryable by Temporal.
    if process.returncode:
        raise ApplicationError('Stage needs inspection: '+str(log), type='RefreshNeedsAttention', non_retryable=True)
    last = log.read_text().splitlines()[-1]
    return json.loads(last)['result']


async def main():
    while True:
        try:
            client = await Client.connect(ADDRESS, namespace=NAMESPACE)
            break
        except RuntimeError:
            await asyncio.sleep(5)
    worker = Worker(client, task_queue=TASK_QUEUE, workflows=[RefreshPublicData],
                    activities=[refresh_step], max_concurrent_activities=1,
                    graceful_shutdown_timeout=timedelta(seconds=20))
    await worker.run()


if __name__ == '__main__':
    logging.basicConfig(level=logging.INFO)
    asyncio.run(main())
