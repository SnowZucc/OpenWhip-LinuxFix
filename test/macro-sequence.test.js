// Tests for the Linux macro sequencing helpers: verifies that xdotool steps stay separated, avoid interrupting by default, and run in order; each test returns once the expected sequence or failure mode is observed.
const test = require('node:test');
const assert = require('node:assert/strict');

const {
  buildLinuxMacroSequence,
  runCommandSequence,
  LINUX_INTERRUPT_SETTLE_MS,
  LINUX_POST_TYPE_SETTLE_MS,
} = require('../macro-sequence');

test('buildLinuxMacroSequence avoids interrupting by default and keeps Return separate', () => {
  const steps = buildLinuxMacroSequence('Speed it up clanker');

  assert.deepEqual(steps, [
    { kind: 'command', args: ['type', '--delay', '1', '--clearmodifiers', '--', 'Speed it up clanker'] },
    { kind: 'delay', ms: LINUX_POST_TYPE_SETTLE_MS },
    { kind: 'command', args: ['key', 'Return'] },
  ]);
  assert.equal(steps.some(step => Array.isArray(step.args) && step.args.includes('ctrl+c')), false);
  assert.equal(steps[0].args.includes('key'), false);
  assert.equal(steps[0].args.includes('Return'), false);
});

test('buildLinuxMacroSequence can opt back into interrupting before typing', () => {
  const steps = buildLinuxMacroSequence('FASTER', { sendInterrupt: true });

  assert.deepEqual(steps, [
    { kind: 'command', args: ['key', '--clearmodifiers', 'ctrl+c'] },
    { kind: 'delay', ms: LINUX_INTERRUPT_SETTLE_MS },
    { kind: 'command', args: ['type', '--delay', '1', '--clearmodifiers', '--', 'FASTER'] },
    { kind: 'delay', ms: LINUX_POST_TYPE_SETTLE_MS },
    { kind: 'command', args: ['key', 'Return'] },
  ]);
});

test('runCommandSequence executes default Linux commands and delays in order', async () => {
  const calls = [];
  const execFileImpl = (command, args, callback) => {
    calls.push({ type: 'command', command, args });
    callback(null);
  };
  const delayImpl = async ms => {
    calls.push({ type: 'delay', ms });
  };

  await runCommandSequence('xdotool', buildLinuxMacroSequence('FASTER'), execFileImpl, delayImpl);

  assert.deepEqual(calls, [
    { type: 'command', command: 'xdotool', args: ['type', '--delay', '1', '--clearmodifiers', '--', 'FASTER'] },
    { type: 'delay', ms: LINUX_POST_TYPE_SETTLE_MS },
    { type: 'command', command: 'xdotool', args: ['key', 'Return'] },
  ]);
});

test('buildLinuxMacroSequence can disable submit for type-only behavior', () => {
  const steps = buildLinuxMacroSequence('Work FASTER', { submit: false });

  assert.deepEqual(steps, [
    { kind: 'command', args: ['type', '--delay', '1', '--clearmodifiers', '--', 'Work FASTER'] },
  ]);
});

test('runCommandSequence rejects unknown step kinds', async () => {
  await assert.rejects(
    runCommandSequence(
      'xdotool',
      [{ kind: 'mystery' }],
      (_command, _args, callback) => callback(null),
      async () => {}
    ),
    /Unknown sequence step kind/
  );
});

test('buildLinuxMacroSequence rejects invalid options', () => {
  assert.throws(() => buildLinuxMacroSequence('FASTER', []), /options must be an object/i);
  assert.throws(() => buildLinuxMacroSequence('FASTER', { sendInterrupt: 'yes' }), /sendInterrupt/);
  assert.throws(() => buildLinuxMacroSequence('FASTER', { submit: 'no' }), /submit/);
});
