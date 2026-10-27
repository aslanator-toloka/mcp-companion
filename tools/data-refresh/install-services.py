"""Install two user LaunchAgents; bind the personal dev service to loopback."""
import os
from pathlib import Path
import plistlib
import shutil
import subprocess
import sys

PROJECT = Path(__file__).resolve().parents[2]
RUNTIME = PROJECT.parent.parent/'mcp-character-lab/temporal-runtime'
RUNTIME.mkdir(parents=True, exist_ok=True)
(RUNTIME/'logs').mkdir(exist_ok=True)
PYTHON = RUNTIME/'.venv/bin/python'
assert PYTHON.exists(), 'Create the runtime venv and install requirements.txt first'
TEMPORAL = shutil.which('temporal')
assert TEMPORAL, 'Install the Temporal CLI first'
JOBS = {
    'org.mcp-companion.temporal-server': [TEMPORAL, 'server', 'start-dev', '--ip', '127.0.0.1',
        '--port', '7333', '--ui-port', '8333', '--namespace', 'mcp-refresh',
        '--db-filename', str(RUNTIME/'temporal.db')],
    'org.mcp-companion.temporal-worker': [str(PYTHON), str(Path(__file__).with_name('worker.py'))],
}
AGENTS = Path.home()/'Library/LaunchAgents'
AGENTS.mkdir(parents=True, exist_ok=True)
for label, arguments in JOBS.items():
    path = AGENTS/(label+'.plist')
    value = {'Label': label, 'ProgramArguments': arguments, 'WorkingDirectory': str(PROJECT),
        'RunAtLoad': True, 'KeepAlive': True, 'ThrottleInterval': 10,
        'EnvironmentVariables': {'PATH': os.environ['PATH'], 'PYTHONUNBUFFERED': '1'},
        'StandardOutPath': str(RUNTIME/'logs'/(label+'.out.log')),
        'StandardErrorPath': str(RUNTIME/'logs'/(label+'.err.log'))}
    path.write_bytes(plistlib.dumps(value))
    subprocess.run(['launchctl', 'bootout', f'gui/{os.getuid()}', str(path)], capture_output=True)
    subprocess.run(['launchctl', 'bootstrap', f'gui/{os.getuid()}', str(path)], check=True)
    print('Installed '+label)
