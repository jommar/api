import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { describe, test } from 'node:test';
import { projectDir } from '../src/config.ts';

const unit = fs.readFileSync(path.join(projectDir, 'deploy', 'usage-monitor.service'), 'utf8');
const directives = unit.split('\n').filter((line) => /^[A-Za-z]+=/.test(line));

describe('deploy/usage-monitor.service', () => {
  test('files are owner-only and the process is confined where every user manager supports it', () => {
    for (const line of ['UMask=0077', 'NoNewPrivileges=yes', 'LockPersonality=yes', 'RestrictAddressFamilies=AF_UNIX AF_INET AF_INET6']) {
      assert.ok(directives.includes(line), `missing ${line}`);
    }
  });

  test('it sets no sandboxing the user manager may not support: a unit that fails to start takes the service down', () => {
    for (const name of ['ProtectSystem', 'PrivateTmp', 'MemoryMax']) {
      assert.ok(!directives.some((line) => line.startsWith(`${name}=`)), `${name} must stay out of the unit`);
    }
  });
});
