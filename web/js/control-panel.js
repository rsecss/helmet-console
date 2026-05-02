/**
 * Control panel — LED segmented toggle + Motor slider with live --fill.
 * LED status text is driven by local click intent for now; once
 * ws-client dispatches device-confirmed status frames the same
 * `setLedState` hook can be called from `main.js` instead.
 */

export function createControlPanel({
  ledOnButton,
  ledOffButton,
  ledStatus,
  ledStatusValue,
  motorSlider,
  motorValue,
  onLedOn,
  onLedOff,
  onMotorSpeed,
}) {
  function setLedState(isOn) {
    ledOnButton.setAttribute('aria-pressed', isOn ? 'true' : 'false');
    ledOffButton.setAttribute('aria-pressed', isOn ? 'false' : 'true');
    ledStatus.dataset.state = isOn ? 'on' : 'off';
    ledStatusValue.textContent = isOn ? '已开启' : '已关闭';
  }

  ledOnButton.addEventListener('click', () => {
    setLedState(true);
    onLedOn();
  });

  ledOffButton.addEventListener('click', () => {
    setLedState(false);
    onLedOff();
  });

  function setMotorSpeed(value) {
    const max = Number(motorSlider.max) || 5;
    const clamped = Math.max(0, Math.min(max, Number(value)));
    motorSlider.value = String(clamped);
    motorValue.textContent = String(clamped);
    motorSlider.style.setProperty('--fill', `${(clamped / max) * 100}%`);
  }

  motorSlider.addEventListener('input', (event) => {
    const value = Number(event.target.value);
    setMotorSpeed(value);
    onMotorSpeed(value);
  });

  // Sync initial fill (in case markup defaults differ from value=0)
  setMotorSpeed(Number(motorSlider.value) || 0);

  return {
    setLedState,
    setMotorSpeed,
  };
}
