import { Router, type IRouter } from "express";
import { ChatWithAssistantBody, ChatWithAssistantResponse } from "@workspace/api-zod";

const router: IRouter = Router();

function fallbackReply(message: string, assistantName: string, context?: string) {
  const prompt = message.toLowerCase();
  const topic = context ? ` for ${context.split(":")[0]}` : "";
  if (prompt.includes("plan") || prompt.includes("study") || prompt.includes("revise")) {
    return `I’m ${assistantName}. Let’s make this manageable${topic}: choose one small outcome, work for 20 minutes, then spend 5 minutes checking what you can recall without notes. Tell me the subject and deadline and I’ll turn it into a short plan.`;
  }
  if (prompt.includes("explain") || prompt.includes("what is") || prompt.includes("how does")) {
    return `I’m ${assistantName}. Start with the plain idea, then connect it to an example: ${message.trim()} is asking for a concept breakdown. Write what you already understand in one sentence, circle the unclear word, and I’ll help you unpack that step by step.`;
  }
  if (prompt.includes("stuck") || prompt.includes("difficult") || prompt.includes("don't understand")) {
    return `No problem. I’m ${assistantName}, and we can untangle it without rushing. Break the question into: what is given, what is being asked, and which step feels unclear. Share the exact step or paste the question, and I’ll guide you rather than do the work for you.`;
  }
  return `I’m ${assistantName}. A useful next step${topic} is to turn your question into one specific task you can finish in 10 minutes. What subject is this for, and what part feels hardest right now?`;
}

router.post("/ai/chat", async (req, res): Promise<void> => {
  const parsed = ChatWithAssistantBody.safeParse(req.body);
  if (!parsed.success) {
    req.log.warn({ errors: parsed.error.message }, "Invalid assistant request");
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    req.log.warn("OPENAI_API_KEY is not configured; using study fallback");
    res.json(ChatWithAssistantResponse.parse({
      assistantName: parsed.data.assistantName,
      reply: fallbackReply(parsed.data.message, parsed.data.assistantName, parsed.data.context),
    }));
    return;
  }

  const context = parsed.data.context
    ? `The student is currently studying in this context: ${parsed.data.context}`
    : "The student is studying with friends in a shared online study party.";

  try {
    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        max_tokens: 500,
        messages: [
          {
            role: "system",
            content: `You are ${parsed.data.assistantName}, a warm, concise study buddy for teenagers. ${context} Explain ideas clearly, encourage the student, and never do an assignment dishonestly. Use short paragraphs and practical examples. Do not use emojis.`,
          },
          { role: "user", content: parsed.data.message },
        ],
      }),
    });

    if (response.status === 429) {
      req.log.warn("Assistant provider quota is unavailable");
      res.json(ChatWithAssistantResponse.parse({
        assistantName: parsed.data.assistantName,
        reply: fallbackReply(parsed.data.message, parsed.data.assistantName, parsed.data.context),
      }));
      return;
    }

    if (!response.ok) {
      req.log.warn({ status: response.status }, "Assistant provider returned an error; using study fallback");
      res.json(ChatWithAssistantResponse.parse({
        assistantName: parsed.data.assistantName,
        reply: fallbackReply(parsed.data.message, parsed.data.assistantName, parsed.data.context),
      }));
      return;
    }

    const payload = (await response.json()) as {
      choices?: Array<{ message?: { content?: string } }>;
    };
    const reply = payload.choices?.[0]?.message?.content?.trim();
    if (!reply) {
      res.status(502).json({ error: "The assistant returned an empty answer" });
      return;
    }

    res.json(ChatWithAssistantResponse.parse({
      assistantName: parsed.data.assistantName,
      reply,
    }));
  } catch (error) {
    req.log.warn({ error }, "Assistant request failed; using study fallback");
    res.json(ChatWithAssistantResponse.parse({
      assistantName: parsed.data.assistantName,
      reply: fallbackReply(parsed.data.message, parsed.data.assistantName, parsed.data.context),
    }));
  }
});

export default router;