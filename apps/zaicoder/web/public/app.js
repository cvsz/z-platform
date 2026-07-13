const model = document.querySelector("#model");
const prompt = document.querySelector("#prompt");
const send = document.querySelector("#send");
const output = document.querySelector("#output");

send.addEventListener("click", async () => {
  output.textContent = "";
  send.disabled = true;
  try {
    const response = await fetch("/api/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ model: model.value, prompt: prompt.value }),
    });
    const body = await response.json();
    if (!response.ok) throw new Error(body.error || "Request failed");
    output.textContent = body.content;
  } catch (error) {
    output.textContent = error instanceof Error ? error.message : "Request failed";
  } finally {
    send.disabled = false;
  }
});
