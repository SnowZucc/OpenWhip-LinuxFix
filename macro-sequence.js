// Linux macro sequencing helpers for OpenWhip: build ordered xdotool command/delay steps and execute them sequentially; buildLinuxMacroSequence returns step descriptors with optional interrupt/submit behavior and runCommandSequence returns a Promise that resolves when the sequence completes.
const LINUX_INTERRUPT_SETTLE_MS = 300;
const LINUX_POST_TYPE_SETTLE_MS = 50;

function buildLinuxMacroSequence(text, options = {}) {
  if (typeof text !== 'string' || text.length === 0) {
    throw new TypeError('Linux macro text must be a non-empty string.');
  }
  if (!options || typeof options !== 'object' || Array.isArray(options)) {
    throw new TypeError('Linux macro options must be an object when provided.');
  }

  const {
    sendInterrupt = false,
    submit = true,
  } = options;
  if (typeof sendInterrupt !== 'boolean') {
    throw new TypeError('Linux macro option "sendInterrupt" must be a boolean.');
  }
  if (typeof submit !== 'boolean') {
    throw new TypeError('Linux macro option "submit" must be a boolean.');
  }

  const steps = [];
  if (sendInterrupt) {
    steps.push(
      { kind: 'command', args: ['key', '--clearmodifiers', 'ctrl+c'] },
      { kind: 'delay', ms: LINUX_INTERRUPT_SETTLE_MS },
    );
  }

  steps.push({ kind: 'command', args: ['type', '--delay', '1', '--clearmodifiers', '--', text] });

  if (submit) {
    steps.push(
      { kind: 'delay', ms: LINUX_POST_TYPE_SETTLE_MS },
      { kind: 'command', args: ['key', 'Return'] },
    );
  }

  return steps;
}

function execFileAsync(execFileImpl, command, args) {
  return new Promise((resolve, reject) => {
    execFileImpl(command, args, err => {
      if (err) {
        reject(err);
        return;
      }

      resolve();
    });
  });
}

function delay(ms) {
  return new Promise(resolve => {
    setTimeout(resolve, ms);
  });
}

async function runCommandSequence(command, steps, execFileImpl, delayImpl = delay) {
  if (typeof command !== 'string' || command.length === 0) {
    throw new TypeError('Sequence command must be a non-empty string.');
  }
  if (!Array.isArray(steps)) {
    throw new TypeError('Sequence steps must be an array.');
  }
  if (typeof execFileImpl !== 'function') {
    throw new TypeError('Sequence execFile implementation must be a function.');
  }
  if (typeof delayImpl !== 'function') {
    throw new TypeError('Sequence delay implementation must be a function.');
  }

  for (const step of steps) {
    if (!step || typeof step !== 'object') {
      throw new TypeError('Sequence steps must be objects.');
    }

    if (step.kind === 'delay') {
      if (!Number.isFinite(step.ms) || step.ms < 0) {
        throw new TypeError('Delay steps must use a non-negative finite duration.');
      }

      await delayImpl(step.ms);
      continue;
    }

    if (step.kind === 'command') {
      if (!Array.isArray(step.args)) {
        throw new TypeError('Command steps must provide an argument array.');
      }

      await execFileAsync(execFileImpl, command, step.args);
      continue;
    }

    throw new Error(`Unknown sequence step kind: ${step.kind}`);
  }
}

module.exports = {
  buildLinuxMacroSequence,
  runCommandSequence,
  LINUX_INTERRUPT_SETTLE_MS,
  LINUX_POST_TYPE_SETTLE_MS,
};
