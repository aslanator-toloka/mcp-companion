import asyncio
from datetime import timedelta
import json
from pathlib import Path
import subprocess
import sys
import tempfile
import unittest
import uuid

from temporalio import activity
from temporalio.client import Client
from temporalio.exceptions import ApplicationError
from temporalio.worker import Worker

import driver
import refresh
from control import daily_schedule
from workflows import RefreshPublicData, STAGES


class DriverTests(unittest.TestCase):
    def test_runner_and_workflow_share_stage_order(self):
        self.assertEqual(STAGES, refresh.STAGES)

    def test_concurrent_delivery_runs_stage_once(self):
        with tempfile.TemporaryDirectory() as temporary:
            root = Path(temporary)
            project = root/'project'
            (project/'scripts').mkdir(parents=True)
            (project/'scripts/apply-jarvis-refresh.mjs').write_text(
                "import fs from 'node:fs';fs.appendFileSync('calls.txt','apply\\n');await new Promise(r=>setTimeout(r,500));")
            run = root/'run'
            refresh.atomic(run/'job.json', {'project': str(project), 'scraper': str(root/'scraper'),
                'capture': str(root/'capture'), 'source': str(root/'source'), 'end': '2026-10-26'})
            payload = {'operation': 'stage', 'stage': 'apply', 'run_dir': str(run), 'project': str(project)}
            command = [sys.executable, str(Path(driver.__file__)), json.dumps(payload)]
            first = subprocess.Popen(command, stdout=subprocess.PIPE, stderr=subprocess.PIPE)
            second = subprocess.Popen(command, stdout=subprocess.PIPE, stderr=subprocess.PIPE)
            for process in [first, second]:
                stdout, stderr = process.communicate(timeout=15)
                self.assertEqual(process.returncode, 0, stderr.decode())
            self.assertEqual((project/'calls.txt').read_text(), 'apply\n')
            self.assertEqual(refresh.read(run/'status.json')['completed'], ['apply'])

    def test_unpublished_run_blocks_another_run(self):
        with tempfile.TemporaryDirectory() as temporary:
            root = Path(temporary)
            project = root/'project'
            project.mkdir()
            refresh.atomic(root/'.mcp-data-refresh-active.json', {'runDir': str(root/'first')})
            with self.assertRaisesRegex(RuntimeError, 'awaits completion/review'):
                driver.dispatch({'operation': 'init', 'project': str(project), 'run_dir': str(root/'second')})

    def test_schedule_is_daily_local_time_without_overlap(self):
        schedule = daily_schedule()
        self.assertEqual(schedule.spec.time_zone_name, 'Europe/Amsterdam')
        self.assertEqual(schedule.spec.calendars[0].hour[0].start, 10)
        self.assertEqual(schedule.policy.overlap.name, 'SKIP')
        self.assertEqual(schedule.policy.catchup_window, timedelta(hours=12))
        self.assertTrue(schedule.policy.pause_on_failure)


class WorkflowIntegrationTests(unittest.IsolatedAsyncioTestCase):
    async def wait_state(self, handle, expected):
        for _ in range(200):
            state = await handle.query(RefreshPublicData.status)
            if state['state'] == expected:
                return state
            await asyncio.sleep(.05)
        self.fail(f'Never reached {expected}: {state}')

    async def test_resume_restart_and_publication_without_new_scrape(self):
        client = await Client.connect('127.0.0.1:7333', namespace='mcp-refresh')
        queue = 'mcp-test-'+uuid.uuid4().hex
        calls = []
        failures = {'apply': True}

        @activity.defn(name='refresh_step')
        async def fixture_step(payload: dict) -> dict:
            action = payload['operation']
            if action == 'init':
                return {'run_dir': '/tmp/fixture-only-no-files', 'end': '2026-10-26'}
            if action == 'stage':
                name = payload['stage']
                calls.append(name)
                if failures.get(name):
                    failures[name] = False
                    raise ApplicationError('review fixture', non_retryable=True)
            if action == 'finalize' and payload['commit'] == '0'*40:
                raise ApplicationError('stale commit fixture', non_retryable=True)
            return {'state': action}

        def worker():
            return Worker(client, task_queue=queue, workflows=[RefreshPublicData], activities=[fixture_step])

        workflow_id = 'mcp-test-'+uuid.uuid4().hex
        async with worker():
            handle = await client.start_workflow(RefreshPublicData.run, {}, id=workflow_id, task_queue=queue)
            try:
                state = await self.wait_state(handle, 'needs_attention')
                self.assertEqual(state['stage'], 'apply')
                await handle.signal(RefreshPublicData.resume, '')
                await self.wait_state(handle, 'ready_to_publish')
                self.assertEqual(calls, ['capture', 'apply', 'apply']+STAGES[2:])
            except BaseException:
                await handle.terminate('test failed')
                raise
        # Restart worker: reconstruct workflow from server history, not memory.
        async with worker():
            try:
                await handle.signal(RefreshPublicData.published, '0'*40)
                for _ in range(200):
                    state = await handle.query(RefreshPublicData.status)
                    if state.get('error'):
                        break
                    await asyncio.sleep(.05)
                self.assertEqual(state['state'], 'ready_to_publish')
                self.assertTrue(state['error'])
                await handle.signal(RefreshPublicData.published, 'a'*40)
                result = await asyncio.wait_for(handle.result(), timeout=15)
                self.assertEqual(result['state'], 'complete')
                self.assertEqual(calls.count('scrape'), 1)
                self.assertEqual(calls.count('capture'), 1)
            except BaseException:
                await handle.terminate('test failed')
                raise


if __name__ == '__main__':
    unittest.main()
