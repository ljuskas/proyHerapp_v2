"""Comprueba que el hook rechace eventos ajenos al despliegue de main."""
import json
import os
from pathlib import Path
import subprocess
import tempfile
import unittest

HOOK = Path(__file__).resolve().parent / 'runner-job-started.sh'


class RunnerHookTests(unittest.TestCase):
    def invoke(self, overrides=None, payload_overrides=None):
        payload = {
            'ref': 'refs/heads/main',
            'repository': {'full_name': 'ljuskas/proyHerapp_v2'},
            'after': 'a' * 40,
            'deleted': False,
        }
        payload.update(payload_overrides or {})
        with tempfile.TemporaryDirectory() as directory:
            event = Path(directory) / 'event.json'
            event.write_text(json.dumps(payload))
            env = {
                'PATH': os.environ['PATH'],
                'GITHUB_EVENT_NAME': 'push',
                'GITHUB_REPOSITORY': 'ljuskas/proyHerapp_v2',
                'GITHUB_REF': 'refs/heads/main',
                'GITHUB_WORKFLOW_REF': 'ljuskas/proyHerapp_v2/.github/workflows/deploy-local.yml@refs/heads/main',
                'GITHUB_SHA': 'a' * 40,
                'GITHUB_EVENT_PATH': str(event),
            }
            env.update(overrides or {})
            return subprocess.run(['bash', str(HOOK)], env=env, capture_output=True, text=True)

    def test_allows_main_push(self):
        self.assertEqual(self.invoke().returncode, 0)

    def test_rejects_other_contexts(self):
        for key, value in [
            ('GITHUB_EVENT_NAME', 'pull_request'),
            ('GITHUB_EVENT_NAME', 'pull_request_target'),
            ('GITHUB_EVENT_NAME', 'workflow_dispatch'),
            ('GITHUB_REF', 'refs/heads/feat/heraap-007'),
            ('GITHUB_REPOSITORY', 'someone/fork'),
            ('GITHUB_WORKFLOW_REF', 'ljuskas/proyHerapp_v2/.github/workflows/other.yml@refs/heads/main'),
            ('GITHUB_EVENT_PATH', '/nonexistent/heraap-event.json'),
        ]:
            with self.subTest(key=key, value=value):
                self.assertNotEqual(self.invoke({key: value}).returncode, 0)

    def test_rejects_inconsistent_payload(self):
        for payload in [
            {'ref': 'refs/pull/1/merge'},
            {'after': 'b' * 40},
            {'deleted': True},
            {'repository': {'full_name': 'someone/fork'}},
        ]:
            with self.subTest(payload=payload):
                self.assertNotEqual(self.invoke(payload_overrides=payload).returncode, 0)


if __name__ == '__main__':
    unittest.main()
