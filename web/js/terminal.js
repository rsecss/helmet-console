import { FitAddon } from '../vendor/xterm/addon-fit.mjs';
import { Terminal } from '../vendor/xterm/xterm.mjs';

function writePayload(term, payload) {
  if (typeof payload === 'string') {
    term.write(payload);
    return;
  }

  term.writeln(JSON.stringify(payload));
}

export function createConsoleTerminal({ container }) {
  const term = new Terminal({
    cursorBlink: false,
    convertEol: true,
    disableStdin: true,
    fontFamily: 'Consolas, "Cascadia Mono", "SFMono-Regular", monospace',
    fontSize: 14,
    theme: {
      background: '#101820',
      foreground: '#d6dde5',
      cursor: '#ffffff',
      selectionBackground: '#2c4f68',
    },
  });
  const fitAddon = new FitAddon();

  term.loadAddon(fitAddon);
  term.open(container);
  fitAddon.fit();

  const observer = new ResizeObserver(() => {
    fitAddon.fit();
  });
  observer.observe(container);

  return {
    writeFrame(frame) {
      if (frame.type === 'error') {
        term.writeln(`\r\n[error] ${JSON.stringify(frame.payload)}`);
        return;
      }

      writePayload(term, frame.payload);
    },
    writeLine(message) {
      term.writeln(`\r\n${message}`);
    },
    dispose() {
      observer.disconnect();
      term.dispose();
    },
  };
}
