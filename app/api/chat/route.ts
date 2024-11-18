import { openai } from "@ai-sdk/openai";
import { convertToCoreMessages, streamText } from "ai";

export async function POST(req: Request) {
  const { messages } = await req.json();

  const result = await streamText({
    model: openai("gpt-4o-mini"),
    system: `Anda adalah seorang pakar di website https://e-katalog.lkpp.go.id/. 
      Jawab pertanyaan atau tanggapan pengguna hanya dalam bahasa Indonesia.
      `,
    messages: convertToCoreMessages(messages),
  });

  return result.toDataStreamResponse();
}
