import importlib.util
import json
from pathlib import Path
import sys
import tempfile
import unittest
from unittest.mock import patch

spec = importlib.util.spec_from_file_location('refresh', Path(__file__).with_name('refresh.py'))
refresh = importlib.util.module_from_spec(spec)
spec.loader.exec_module(refresh)


class RefreshRunnerTests(unittest.TestCase):
    def job(self, root):
        refresh.atomic(root/'job.json', {'project': str(root), 'scraper': str(root/'scraper'),
            'source': str(root/'source'), 'capture': str(root/'capture'), 'end': '2026-10-26'})
        return refresh.Runner(root)

    def test_failure_resume_skips_completed_work_and_preserves_failure_log(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            runner = self.job(root)
            runner.execute('capture', lambda: runner.checked([sys.executable, '-c', "print('capture once')"]))
            with self.assertRaises(RuntimeError):
                runner.execute('apply', lambda: runner.checked([sys.executable, '-c', "print('failure detail');raise SystemExit(3)"]))
            restored = refresh.Runner(root)
            self.assertEqual(restored.status['state'], 'needs_attention')
            restored.execute('capture', lambda: self.fail('Completed capture must not run again'))
            restored.execute('apply', lambda: restored.checked([sys.executable, '-c', "print('recovered')"]))
            self.assertEqual(restored.status['completed'], ['capture', 'apply'])
            log = (root/'logs/apply.log').read_text()
            self.assertIn('failure detail', log)
            self.assertIn('recovered', log)
            self.assertIsNone(restored.status['childPid'])

    def test_reset_from_stage_keeps_prior_stages_only(self):
        self.assertEqual(refresh.remaining(refresh.STAGES, 'tests'), ['tests', 'browser'])
        self.assertEqual(refresh.remaining(refresh.STAGES), [])
        self.assertEqual(refresh.remaining(['capture', 'apply'])[0], 'roles')

    def test_stale_commit_cannot_advance_success_pointer(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            runner = self.job(root)
            runner.status['completed'] = refresh.STAGES[:]
            refresh.atomic(root/'source/manifest.json', {'complete': True, 'errors': 0,
                'scope': 'all_played_records', 'end': '2026-10-26',
                'filters': {'min_win': None, 'max_loss': None}, 'generated_at': 'fresh'})
            stale = b'window.ROSTER_ATLAS = {"meta":{"end":"2026-10-23","snapshot":"old"}};'
            with patch.object(refresh.sp, 'check_output', return_value=stale), patch.object(refresh.urllib.request, 'urlopen') as fetch:
                with self.assertRaisesRegex(AssertionError, 'different cutoff'):
                    runner.finalize('a'*40, 'https://example.invalid/')
                fetch.assert_not_called()
            self.assertFalse((root/'scraper/update_state.json').exists())


if __name__ == '__main__':
    unittest.main()
