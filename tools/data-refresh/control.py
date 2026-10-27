"""Operator commands for the dedicated local MCP Temporal service."""
import argparse
import asyncio
from datetime import datetime, timedelta
import json
from pathlib import Path
import uuid

from temporalio.client import (Client, Schedule, ScheduleActionStartWorkflow,
    ScheduleAlreadyRunningError, ScheduleCalendarSpec, ScheduleOverlapPolicy,
    SchedulePolicy, ScheduleRange, ScheduleSpec, ScheduleState, ScheduleUpdate)
from workflows import RefreshPublicData, TASK_QUEUE

ADDRESS = '127.0.0.1:7333'
NAMESPACE = 'mcp-refresh'
SCHEDULE_ID = 'mcp-data-daily'


def daily_schedule():
    return Schedule(
        action=ScheduleActionStartWorkflow(RefreshPublicData.run, {}, id='mcp-data-daily', task_queue=TASK_QUEUE),
        spec=ScheduleSpec(calendars=[ScheduleCalendarSpec(hour=[ScheduleRange(10)], minute=[ScheduleRange(0)])],
                          time_zone_name='Europe/Amsterdam'),
        policy=SchedulePolicy(overlap=ScheduleOverlapPolicy.SKIP, catchup_window=timedelta(hours=12), pause_on_failure=True),
        state=ScheduleState(note='Daily public data preparation; publication requires reviewed commit'),
    )


async def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('action', choices=['schedule', 'schedule-status', 'pause', 'unpause', 'trigger',
                                         'start', 'status', 'resume', 'published'])
    parser.add_argument('--workflow-id')
    parser.add_argument('--end')
    parser.add_argument('--run-dir')
    parser.add_argument('--from-stage', default='')
    parser.add_argument('--commit')
    args = parser.parse_args()
    client = await Client.connect(ADDRESS, namespace=NAMESPACE)
    schedule_handle = client.get_schedule_handle(SCHEDULE_ID)
    if args.action == 'schedule':
        try:
            await client.create_schedule(SCHEDULE_ID, daily_schedule())
        except ScheduleAlreadyRunningError:
            # Preserve an operator's pause when reconciling the configured time.
            def update(existing):
                value = daily_schedule()
                value.state = existing.description.schedule.state
                return ScheduleUpdate(schedule=value)
            await schedule_handle.update(update)
    elif args.action == 'pause':
        await schedule_handle.pause(note='Paused by operator')
    elif args.action == 'unpause':
        await schedule_handle.unpause(note='Enabled by operator')
    elif args.action == 'trigger':
        await schedule_handle.trigger()
    elif args.action == 'start':
        options = {}
        if args.end:
            datetime.strptime(args.end, '%Y-%m-%d')
            options['end'] = args.end
        if args.run_dir:
            options['run_dir'] = str(Path(args.run_dir).resolve())
        workflow_id = args.workflow_id or 'mcp-data-manual-'+uuid.uuid4().hex[:12]
        await client.start_workflow(RefreshPublicData.run, options, id=workflow_id, task_queue=TASK_QUEUE)
        print(json.dumps({'workflowId': workflow_id}))
        return
    elif args.action in ['status', 'resume', 'published']:
        assert args.workflow_id, '--workflow-id is required'
        handle = client.get_workflow_handle(args.workflow_id)
        if args.action == 'resume':
            from workflows import STAGES
            assert not args.from_stage or args.from_stage in STAGES, 'Unknown stage'
            current = await handle.query(RefreshPublicData.status)
            assert current['state'] == 'needs_attention', 'Workflow is not waiting for recovery'
            if args.from_stage:
                assert current['stage'] in STAGES and STAGES.index(args.from_stage) <= STAGES.index(current['stage']), 'Cannot skip an unfinished earlier stage'
            await handle.signal(RefreshPublicData.resume, args.from_stage)
        elif args.action == 'published':
            import re
            assert args.commit and re.fullmatch('[0-9a-f]{40}', args.commit), '--commit must be an exact SHA'
            current = await handle.query(RefreshPublicData.status)
            assert current['state'] == 'ready_to_publish', 'Workflow is not waiting for publication'
            await handle.signal(RefreshPublicData.published, args.commit)
        print(json.dumps(await handle.query(RefreshPublicData.status)))
        return
    description = await schedule_handle.describe()
    print(json.dumps({'id': description.id, 'paused': description.schedule.state.paused,
        'timezone': description.schedule.spec.time_zone_name,
        'overlap': description.schedule.policy.overlap.name,
        'next': [value.isoformat() for value in description.info.next_action_times[:3]],
        'running': [value.workflow_id for value in description.info.running_actions]}))


if __name__ == '__main__':
    asyncio.run(main())
