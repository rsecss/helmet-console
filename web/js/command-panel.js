export function createCommandPanel({ form, input, sendButton, onSend }) {
  form.addEventListener('submit', (event) => {
    event.preventDefault();

    const command = input.value;
    if (!command.trim()) {
      input.focus();
      return;
    }

    onSend(command);
    input.value = '';
    input.focus();
  });

  input.focus();

  return {
    setConnected(connected) {
      sendButton.disabled = !connected;
      input.disabled = !connected;
    },
  };
}
