const RETENTION_MS = 90_000;
const CLEAN_AIR_VALUE = 100;
const RECOVERY_VALUE = 130;
const ALARM_VALUE = 180;
const EMPTY_VIEWBOX = '0 0 640 320';

function splitKeyValue(field) {
  const index = field.indexOf('=');
  if (index <= 0) return null;
  return [field.slice(0, index).trim(), field.slice(index + 1).trim()];
}

export function parseTelemetryLine(line) {
  const trimmed = line.trim();
  if (!trimmed) return null;

  const fields = new Map();
  for (const rawField of trimmed.split(',')) {
    const pair = splitKeyValue(rawField);
    if (!pair) continue;
    const [key, value] = pair;
    if (key) fields.set(key, value);
  }

  if (!fields.has('mq2')) return null;
  const mq2 = Number(fields.get('mq2'));
  if (!Number.isFinite(mq2)) return null;

  return {
    mq2,
    mq2Alarm: fields.get('mq2_alarm') === '1',
  };
}

function escapeSvgText(value) {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;');
}

function formatTime(timestamp) {
  return new Intl.DateTimeFormat('zh-CN', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  }).format(new Date(timestamp));
}

function pointToPath(points) {
  if (points.length === 0) return '';
  if (points.length === 1) {
    const point = points[0];
    return `M ${point.x.toFixed(1)} ${point.y.toFixed(1)} L ${(point.x + 0.1).toFixed(1)} ${point.y.toFixed(1)}`;
  }

  let path = `M ${points[0].x.toFixed(1)} ${points[0].y.toFixed(1)}`;
  for (let i = 0; i < points.length - 1; i += 1) {
    const previous = points[i - 1] ?? points[i];
    const current = points[i];
    const next = points[i + 1];
    const afterNext = points[i + 2] ?? next;
    const cp1x = current.x + (next.x - previous.x) / 6;
    const cp1y = current.y + (next.y - previous.y) / 6;
    const cp2x = next.x - (afterNext.x - current.x) / 6;
    const cp2y = next.y - (afterNext.y - current.y) / 6;
    path += ` C ${cp1x.toFixed(1)} ${cp1y.toFixed(1)}, ${cp2x.toFixed(1)} ${cp2y.toFixed(1)}, ${next.x.toFixed(1)} ${next.y.toFixed(1)}`;
  }
  return path;
}

function buildAlarmBands(points, plot) {
  const bands = [];
  let start = null;
  let end = null;

  for (const point of points) {
    if (point.alarm) {
      start ??= point.x;
      end = point.x;
    } else if (start !== null && end !== null) {
      bands.push({ start, end });
      start = null;
      end = null;
    }
  }

  if (start !== null && end !== null) bands.push({ start, end });

  return bands
    .map(({ start: bandStart, end: bandEnd }) => {
      const x = Math.max(plot.x, bandStart - 3);
      const width = Math.max(8, Math.min(plot.x + plot.width, bandEnd + 3) - x);
      return `<rect class="mq2-alarm-band" x="${x.toFixed(1)}" y="${plot.y}" width="${width.toFixed(1)}" height="${plot.height}" />`;
    })
    .join('');
}

function referenceLine({ value, label, className, plot, yForValue }) {
  const y = yForValue(value);
  return `
    <line class="${className}" x1="${plot.x}" y1="${y.toFixed(1)}" x2="${plot.x + plot.width}" y2="${y.toFixed(1)}" />
    <text class="mq2-reference-label ${className}-label" x="${plot.x + plot.width - 4}" y="${(y - 6).toFixed(1)}">${escapeSvgText(label)}</text>
  `;
}

function renderChart(samples) {
  const plot = { x: 46, y: 18, width: 552, height: 254 };
  const now = Date.now();
  const minTime = samples[0]?.receivedAt ?? now - RETENTION_MS;
  const maxTime = Math.max(now, minTime + 1);
  const values = samples.map((sample) => sample.mq2);
  const minValue = Math.min(80, CLEAN_AIR_VALUE, RECOVERY_VALUE, ...values);
  const maxValue = Math.max(220, ALARM_VALUE, ...values);
  const valueRange = Math.max(1, maxValue - minValue);
  const timeRange = Math.max(1, maxTime - minTime);

  const xForTime = (timestamp) => plot.x + ((timestamp - minTime) / timeRange) * plot.width;
  const yForValue = (value) =>
    plot.y + plot.height - ((value - minValue) / valueRange) * plot.height;

  const points = samples.map((sample) => ({
    x: xForTime(sample.receivedAt),
    y: yForValue(sample.mq2),
    alarm: sample.mq2Alarm,
  }));

  const path = pointToPath(points);
  const latest = samples.at(-1);
  const latestMarker = latest
    ? `<circle class="mq2-latest-point" cx="${xForTime(latest.receivedAt).toFixed(1)}" cy="${yForValue(latest.mq2).toFixed(1)}" r="4" />`
    : '';

  return `
    <svg class="mq2-chart-svg" viewBox="${EMPTY_VIEWBOX}" role="img" aria-label="MQ2 烟雾趋势指数实时曲线">
      <rect class="mq2-plot-bg" x="${plot.x}" y="${plot.y}" width="${plot.width}" height="${plot.height}" rx="8" />
      ${buildAlarmBands(points, plot)}
      ${referenceLine({
        value: CLEAN_AIR_VALUE,
        label: '清洁空气 100',
        className: 'mq2-reference-clean',
        plot,
        yForValue,
      })}
      ${referenceLine({
        value: RECOVERY_VALUE,
        label: '恢复 130',
        className: 'mq2-reference-recovery',
        plot,
        yForValue,
      })}
      ${referenceLine({
        value: ALARM_VALUE,
        label: '报警 180',
        className: 'mq2-reference-alarm',
        plot,
        yForValue,
      })}
      <line class="mq2-axis" x1="${plot.x}" y1="${plot.y + plot.height}" x2="${plot.x + plot.width}" y2="${plot.y + plot.height}" />
      <line class="mq2-axis" x1="${plot.x}" y1="${plot.y}" x2="${plot.x}" y2="${plot.y + plot.height}" />
      <text class="mq2-axis-label" x="${plot.x}" y="302">${escapeSvgText(formatTime(minTime))}</text>
      <text class="mq2-axis-label mq2-axis-label-end" x="${plot.x + plot.width}" y="302">${escapeSvgText(formatTime(maxTime))}</text>
      <text class="mq2-axis-label" x="6" y="${plot.y + 8}">${Math.round(maxValue)}</text>
      <text class="mq2-axis-label" x="6" y="${plot.y + plot.height}">${Math.round(minValue)}</text>
      <path class="mq2-curve" d="${path}" />
      ${latestMarker}
    </svg>
  `;
}

export function createTelemetryPanel({ card, status, value, chart }) {
  const samples = [];
  let buffer = '';

  function prune(now) {
    const cutoff = now - RETENTION_MS;
    while (samples.length > 0 && samples[0].receivedAt < cutoff) {
      samples.shift();
    }
  }

  function render() {
    const latest = samples.at(-1);
    const isAlarm = latest?.mq2Alarm === true;

    card.dataset.mq2Alarm = isAlarm ? 'true' : 'false';
    status.textContent = isAlarm ? '烟雾异常' : '趋势正常';
    value.textContent = latest ? latest.mq2.toFixed(latest.mq2 % 1 === 0 ? 0 : 1) : '--';
    chart.innerHTML = renderChart(samples);
  }

  function acceptLine(line, receivedAt) {
    const telemetry = parseTelemetryLine(line);
    if (!telemetry) return;

    samples.push({ ...telemetry, receivedAt });
    prune(receivedAt);
    render();
  }

  function acceptFrame(text) {
    if (typeof text !== 'string' || text.length === 0) return;

    buffer += text;
    const lines = buffer.split(/\r?\n/);
    buffer = lines.pop() ?? '';
    const receivedAt = Date.now();

    for (const line of lines) {
      acceptLine(line, receivedAt);
    }
  }

  render();

  return {
    acceptFrame,
    snapshot: () => samples.slice(),
  };
}
