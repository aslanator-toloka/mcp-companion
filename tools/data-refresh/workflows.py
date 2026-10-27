"""Deterministic orchestration; network, git and disk access live in Activities."""
from datetime import timedelta
from temporalio import workflow
from temporalio.common import RetryPolicy
from temporalio.exceptions import ActivityError

STAGES = 'capture apply roles references scrape countries prepare validate rating build tests browser'.split()
TASK_QUEUE = 'mcp-public-data-refresh'


@workflow.defn
class RefreshPublicData:
    def __init__(self):
        self.view = {'state': 'starting', 'stage': 'init'}
        self.retry_requested = False
        self.reset_stage = None
        self.commit = None

    @workflow.query
    def status(self) -> dict:
        return dict(self.view)

    @workflow.signal
    def resume(self, from_stage: str = ''):
        if from_stage and from_stage not in STAGES:
            return
        if self.view['state'] != 'needs_attention':
            return
        current = self.view.get('stage')
        if from_stage and (current not in STAGES or STAGES.index(from_stage) > STAGES.index(current)):
            return
        self.reset_stage = from_stage or None
        self.retry_requested = True

    @workflow.signal
    def published(self, commit: str):
        if self.view['state'] == 'ready_to_publish':
            self.commit = commit

    async def step(self, payload):
        return await workflow.execute_activity(
            'refresh_step', payload, start_to_close_timeout=timedelta(hours=10),
            heartbeat_timeout=timedelta(minutes=1),
            retry_policy=RetryPolicy(initial_interval=timedelta(seconds=15),
                                     maximum_interval=timedelta(minutes=2), maximum_attempts=3),
        )

    @workflow.run
    async def run(self, options: dict) -> dict:
        payload = dict(options, run_id=workflow.info().run_id)
        while True:
            try:
                job = await self.step(dict(payload, operation='init'))
                break
            except ActivityError as error:
                self.view.update(state='needs_attention', error=str(error))
                await workflow.wait_condition(lambda: self.retry_requested)
                self.retry_requested = False
        payload.update(run_dir=job['run_dir'])
        self.view.update(job)
        index = 0
        while True:
            while index < len(STAGES):
                name = STAGES[index]
                self.view.update(state='running', stage=name, error=None)
                try:
                    await self.step(dict(payload, operation='stage', stage=name))
                    index += 1
                except ActivityError as error:
                    self.view.update(state='needs_attention', error=str(error))
                    await workflow.wait_condition(lambda: self.retry_requested)
                    self.retry_requested = False
                    if self.reset_stage:
                        await self.step(dict(payload, operation='reset', stage=self.reset_stage))
                        index = STAGES.index(self.reset_stage)
                        self.reset_stage = None
            await self.step(dict(payload, operation='ready'))
            self.view.update(state='ready_to_publish', stage='review', error=None)
            while True:
                await workflow.wait_condition(lambda: self.commit is not None)
                commit = self.commit
                self.view.update(state='publishing')
                try:
                    await self.step(dict(payload, operation='finalize', commit=commit))
                    self.view.update(state='complete', stage='published', commit=commit)
                    return dict(self.view)
                except ActivityError as error:
                    # A stale/undeployed commit cannot advance last_success.
                    # Retry only publication, preserving its diagnostic.
                    self.commit = None
                    self.view.update(state='ready_to_publish', error=str(error))
