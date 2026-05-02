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
    fontFamily: '"JetBrains Mono", "Cascadia Mono", Consolas, "SFMono-Regular", Menlo, monospace',
    fontSize: 13,
    theme: {
      background: '#ffffff',
      foreground: '#18181b',
      cursor: '#dc2626',
      cursorAccent: '#ffffff',
      selectionBackground: '#fff1f2',
      selectionForeground: '#be123c',
      // ANSI 16 — calibrated for white floor (GitHub Light–style)
      black: '#24292f',
      red: '#cf222e',
      green: '#1a7f37',
      yellow: '#9a6700',
      blue: '#0969da',
      magenta: '#8250df',
      cyan: '#1b7c83',
      white: '#6e7781',
      brightBlack: '#57606a',
      brightRed: '#a40e26',
      brightGreen: '#2da44e',
      brightYellow: '#bf8700',
      brightBlue: '#218bff',
      brightMagenta: '#a475f9',
      brightCyan: '#3192aa',
      brightWhite: '#afb8c1',
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
