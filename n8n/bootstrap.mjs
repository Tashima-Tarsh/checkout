import { spawnSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const token = process.env.AGENTIC_N8N_TOKEN;
if (!/^[A-Za-z0-9_-]{43,128}$/.test(token ?? '')) {
  throw new Error('Configure AGENTIC_N8N_TOKEN before importing the workflow');
}

const directory = mkdtempSync(join(tmpdir(), 'agentic-n8n-'));
const credential = {
  id: 'AgenticPayDispatchHeader',
  name: 'Agentic Pay dispatch bearer',
  type: 'httpHeaderAuth',
  data: { name: 'Authorization', value: 'Bearer ' + token },
};
const workflow = JSON.parse(readFileSync(new URL('./agentic-pay-dispatch.json', import.meta.url)));
workflow.nodes[0].credentials = {
  httpHeaderAuth: { id: credential.id, name: credential.name },
};

function run(...args) {
  const result = spawnSync('n8n', args, { stdio: 'inherit' });
  if (result.status !== 0) throw new Error('n8n command failed: ' + args[0]);
}

try {
  const credentialPath = join(directory, 'credential.json');
  const workflowPath = join(directory, 'workflow.json');
  writeFileSync(credentialPath, JSON.stringify([credential]), { mode: 0o600 });
  writeFileSync(workflowPath, JSON.stringify(workflow), { mode: 0o600 });
  run('import:credentials', '--input=' + credentialPath);
  run('import:workflow', '--input=' + workflowPath);
  run('publish:workflow', '--id=' + workflow.id);
} finally {
  rmSync(directory, { recursive: true, force: true });
}
