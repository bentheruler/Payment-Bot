import "dotenv/config";

async function main() {
  console.log("Starting End-to-End Test...");
  const baseUrl = "http://localhost:3000";

  // Step 1: Browser -> POST /api/auth/session
  console.log("Step 1: Browser requests session...");
  const sessionRes = await fetch(`${baseUrl}/api/auth/session`, { method: "POST" });
  if (!sessionRes.ok) throw new Error("Failed to create session");
  const sessionData = await sessionRes.json();
  const rawToken = sessionData.token;
  console.log(` -> Session created. Token: ${rawToken}`);

  // Step 2: Simulate Browser polling status
  console.log("Step 2: Browser polls status (should be PENDING)...");
  const poll1 = await fetch(`${baseUrl}/api/auth/session/status?token=${rawToken}`);
  const poll1Data = await poll1.json();
  console.log(` -> Status: ${poll1Data.status}`);
  if (poll1Data.status !== "PENDING") throw new Error("Expected PENDING");

  // Step 3: Telegram Webhook received
  console.log("Step 3: Telegram webhook hits backend with /start <TOKEN>...");
  const telegramPayload = {
    update_id: 12345,
    message: {
      message_id: 1,
      from: { id: 987654321, is_bot: false, first_name: "TestUser", username: "testuser" },
      chat: { id: 987654321, type: "private" },
      date: Math.floor(Date.now() / 1000),
      text: `/start ${rawToken}`,
    }
  };

  const webhookRes = await fetch(`${baseUrl}/api/webhook/telegram`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Telegram-Bot-Api-Secret-Token": process.env.TELEGRAM_WEBHOOK_SECRET
    },
    body: JSON.stringify(telegramPayload)
  });
  if (!webhookRes.ok) throw new Error(`Webhook failed: ${webhookRes.status} ${await webhookRes.text()}`);
  console.log(" -> Webhook processed successfully.");

  // Step 4: Browser polls status again
  console.log("Step 4: Browser polls status (should be AUTHENTICATED)...");
  const poll2 = await fetch(`${baseUrl}/api/auth/session/status?token=${rawToken}`);
  const poll2Data = await poll2.json();
  console.log(` -> Status: ${poll2Data.status}`);
  if (poll2Data.status !== "AUTHENTICATED") throw new Error("Expected AUTHENTICATED");

  console.log("End-to-End Test Completed Successfully!");
  process.exit(0);
}

main().catch(e => {
  console.error(e);
  process.exit(1);
});
