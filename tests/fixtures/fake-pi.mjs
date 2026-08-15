#!/usr/bin/env node

let buffer = "";
process.stdin.on("data", (chunk) => {
  buffer += chunk.toString("utf8");
  let newline = buffer.indexOf("\n");
  while (newline >= 0) {
    const line = buffer.slice(0, newline);
    buffer = buffer.slice(newline + 1);
    if (line.trim()) handle(JSON.parse(line));
    newline = buffer.indexOf("\n");
  }
});

function send(message) {
  process.stdout.write(`${JSON.stringify(message)}\n`);
}

function firstId(message, prefix) {
  const ids = [...message.matchAll(new RegExp(`${prefix}_[A-Za-z0-9-]+`, "g"))].map((match) => match[0]).filter((id) => !id.endsWith("_123") && !id.endsWith("_synthetic"));
  return ids.at(-1) || `${prefix}_synthetic`;
}

function responseFor(message) {
  if (message.includes("Analyze the target job") || message.includes("Analyze this public job description")) {
    return {
      title: "Product-minded frontend engineer intern",
      companyName: "Northstar Labs",
      location: "Remote",
      employmentType: "Internship",
      requirements: [
        { text: "React and TypeScript", category: "skill", priority: "required" },
        { text: "Accessible interfaces", category: "skill", priority: "required" },
        { text: "Reliable tests", category: "skill", priority: "preferred" },
      ],
    };
  }
  if (message.includes("Draft a targeted resume")) {
    return {
      title: "Maya Chen — Product-minded frontend engineer",
      summary: "Frontend engineer building accessible product experiences with React and TypeScript.",
      sections: [{
        title: "Selected evidence",
        kind: "custom",
        body: "",
        bullets: [{
          text: "Built an accessible React and TypeScript study planner with keyboard navigation and a documented testing approach.",
          claimIds: [firstId(message, "claim")],
          sourceIds: [firstId(message, "source")],
        }],
      }],
    };
  }
  const sourceId = firstId(message, "source");
  return {
    claims: [{
      claimText: "Built an accessible React and TypeScript study planner with keyboard navigation.",
      category: "project",
      sourceIds: [sourceId],
      sourceExcerpts: ["Synthetic project notes support this claim."],
      notes: "Synthetic fixture claim for deterministic tests only.",
    }],
  };
}

function handle(command) {
  if (command.type === "prompt") {
    send({ type: "response", id: command.id, command: "prompt" });
    if (command.message.includes("provider error")) {
      setTimeout(() => {
        send({
          type: "agent_end",
          messages: [
            { role: "user", content: [{ type: "text", text: command.message }] },
            { role: "assistant", content: [], stopReason: "error", errorMessage: "401: CreditsError" },
          ],
        });
      }, 5);
      return;
    }
    if (command.message.includes("Return an empty claim list")) {
      setTimeout(() => {
        const text = JSON.stringify({ claims: [] });
        send({ type: "message_update", assistantMessageEvent: { type: "text_delta", delta: text } });
        send({ type: "agent_end", messages: [{ role: "assistant", content: [{ type: "text", text }] }] });
      }, 5);
      return;
    }
    if (command.message.includes("slow test")) return;
    const result = responseFor(command.message);
    setTimeout(() => {
      const text = JSON.stringify(result);
      send({ type: "message_update", assistantMessageEvent: { type: "text_delta", delta: text } });
      send({ type: "agent_end", messages: [{ role: "assistant", content: [{ type: "text", text }] }] });
    }, 5);
  } else if (command.type === "abort") {
    send({ type: "response", id: command.id, command: "abort" });
  }
}
