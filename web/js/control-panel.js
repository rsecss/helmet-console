/**
 * Control panel — LED segmented toggle + Motor switch/gear segmented controls.
 *
 * LED state model: 4-token string aligned with the on-device
 * `helmet_led_state_t` (off/white/red/green). Manual click "开启"
 * resolves to 'white' to match the device's `led_on -> WHITE` mapping
 * in APP/m100pg_protocol.c. AI-issued `led_color_<color>` updates the
 * UI to that exact color; the panel buttons stay binary on/off.
 *
 * Motor model (per PRD 05-04-panel-view): switch is the power gate, gear is
 * the target speed (1..3). Switch OFF sends `motor_speed_0`; switch ON sends
 * `motor_speed_<gear>`. While switch is OFF, clicking a gear button only
 * updates the in-memory target — no WS frame is emitted (passive memory).
 */

const LED_STATES = ['off', 'white', 'red', 'green'];
const LED_LABEL = {
  off: '已关闭',
  white: '白光',
  red: '红光',
  green: '绿光',
};

export function createControlPanel({
  ledOnButton,
  ledOffButton,
  ledStatus,
  ledStatusValue,
  motorOnButton,
  motorOffButton,
  motorGearButtons,
  motorDisplay,
  motorStateValue,
  motorGearValue,
  onLedOn,
  onLedOff,
  onMotorSpeed,
}) {
  function setLedState(state) {
    const next = LED_STATES.includes(state) ? state : 'off';
    const isOn = next !== 'off';
    ledOnButton.setAttribute('aria-pressed', isOn ? 'true' : 'false');
    ledOffButton.setAttribute('aria-pressed', isOn ? 'false' : 'true');
    ledStatus.dataset.state = next;
    ledStatusValue.textContent = LED_LABEL[next];
    ledState = next;
  }

  let ledState = 'off';

  ledOnButton.addEventListener('click', () => {
    // led_on on the device resolves to WHITE (m100pg_protocol.c#dispatch_line)
    setLedState('white');
    onLedOn();
  });

  ledOffButton.addEventListener('click', () => {
    setLedState('off');
    onLedOff();
  });

  // Motor state — closure-local two-axis. Defaults per PRD: off + gear 1, no
  // command emitted at construction.
  let motorOn = false;
  let motorGear = 1;

  function renderMotor() {
    motorOnButton.setAttribute('aria-pressed', motorOn ? 'true' : 'false');
    motorOffButton.setAttribute('aria-pressed', motorOn ? 'false' : 'true');
    motorDisplay.dataset.state = motorOn ? 'on' : 'off';
    motorStateValue.textContent = motorOn ? '运行中' : '已停止';
    motorGearValue.textContent = String(motorGear);
    motorGearButtons.forEach((btn) => {
      const gear = Number(btn.dataset.gear);
      btn.setAttribute('aria-pressed', gear === motorGear ? 'true' : 'false');
    });
  }

  function setMotorState({ on, gear }) {
    motorOn = Boolean(on);
    if (Number.isInteger(gear) && gear >= 1 && gear <= 3) {
      motorGear = gear;
    }
    renderMotor();
  }

  /**
   * Boundary used by main.js#mirrorControlState. Accepts the parsed value
   * from a `motor_speed_<n>` frame and updates UI without emitting any
   * outbound command.
   *   0     → switch OFF, gear preserved (per PRD Q5.3)
   *   1..3  → switch ON, gear ← value
   *   else  → warn and drop (out-of-range frame from a pre-rework device or
   *           a misbehaving AI tool call)
   */
  function setMotorSpeed(value) {
    if (!Number.isInteger(value)) return;
    if (value === 0) {
      setMotorState({ on: false, gear: motorGear });
      return;
    }
    if (value >= 1 && value <= 3) {
      setMotorState({ on: true, gear: value });
      return;
    }
    console.warn('[control-panel] motor_speed value out of range:', value);
  }

  motorOnButton.addEventListener('click', () => {
    setMotorState({ on: true, gear: motorGear });
    onMotorSpeed(motorGear);
  });

  motorOffButton.addEventListener('click', () => {
    setMotorState({ on: false, gear: motorGear });
    onMotorSpeed(0);
  });

  motorGearButtons.forEach((btn) => {
    btn.addEventListener('click', () => {
      const gear = Number(btn.dataset.gear);
      if (!Number.isInteger(gear) || gear < 1 || gear > 3) return;
      if (motorOn) {
        setMotorState({ on: true, gear });
        onMotorSpeed(gear);
      } else {
        // Passive memory: change selection only, do not send command.
        setMotorState({ on: false, gear });
      }
    });
  });

  // Initial render — uses defaults (off + gear 1). No command emitted.
  renderMotor();
  setLedState('off');

  function snapshot() {
    return { led: ledState, motorOn, motorGear };
  }

  return {
    setLedState,
    setMotorSpeed,
    snapshot,
  };
}
