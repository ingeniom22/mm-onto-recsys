import { z } from "zod";
import { openai } from "@ai-sdk/openai";
import { ToolInvocation, convertToCoreMessages, streamText, generateText } from "ai";

export const maxDuration = 60;
export const dynamic = 'force-dynamic';

interface Message {
  role: 'user' | 'assistant';
  content: string;
  toolInvocations?: ToolInvocation[];
}


const weatherSchema = z.object({
  city: z.string().describe('The city to get the weather for'),
  unit: z.enum(['C', 'F']).describe('The unit to display the temperature in'),
});

type WeatherParams = z.infer<typeof weatherSchema>;

const getWeather = {
  description: 'Get the weather for a location',
  parameters: weatherSchema,
  execute: async ({ city, unit }: WeatherParams) => {
    const weather = {
      value: 24,
      description: 'Sunny',
    };

    return `It is currently ${weather.value}°${unit} and ${weather.description} in ${city}!`;
  },
};


async function fetchColqwenImages(query: string) {
  const url = process.env.RUNPOD_COLQWEN_URL as string; // Load URL from environment variables
  const apiKey = process.env.RUNPOD_COLQWEN_API_KEY as string; // Load API key from environment variables

  if (!url || !apiKey) {
    throw new Error("RUNPOD_COLQWEN_URL or RUNPOD_COLQWEN_API_KEY is not defined in environment variables.");
  }

  const headers = {
    Authorization: `Bearer ${apiKey}`, //change to get from .env RUNPOD_COLQWEN_API_KEY
    "Content-Type": "application/json",
  };

  const body = {
    input: {
      query: query,
    },
  };

  try {
    const response = await fetch(url, {
      method: "POST",
      headers,
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      throw new Error(`HTTP error! Status: ${response.status}`);
    }

    const data = await response.json();
    console.log("Response Data:", data);

    return data.output;
  } catch (error) {
    console.error("Fetch error:", error);
    throw error;
  }
}


async function fetchKG(query: string) {
  const url = process.env.OAI_TOOLS_URL as string; // Load URL from environment variables
  // const apiKey = process.env.RUNPOD_COLQWEN_API_KEY as string; // Load API key from environment variables

  if (!url) {
    throw new Error("OAI_TOOLS_URL is not defined in environment variables.");
  }

  const headers = {
    "Content-Type": "application/json",
  };

  // const helper_prompt = 

  const body = {
    query: query,
  };

  try {
    const response = await fetch(url + "/query-kg", {
      method: "POST",
      headers,
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      throw new Error(`HTTP error! Status: ${response.status}`);
    }

    const data = await response.json();
    console.log("Response Data:", data);

    return data;
  } catch (error) {
    console.error("Fetch error:", error);
    throw error;
  }
}

const RAGSchema = z.object({
  query: z.string().describe('User query'),
});


type RAGParams = z.infer<typeof RAGSchema>;


const getRAG = {
  description: 'Mendapatkan informasi tambahan dari dokumen e-lkpp.go.id, gunakan informasi tersebut untuk menjawab pertanyaan user',
  parameters: RAGSchema,
  execute: async ({ query }: RAGParams) => {
    const data = await fetchColqwenImages(query)

    const content = data.map((item: { base64: string }) => ({
      type: 'image',
      image: `data:image/jpeg;base64,${item.base64}`, // No need for `new URL` here
    }));

    content.push({
      type: 'text',
      text: query,
    });

    // console.log(content)

    const result = await generateText({
      model: openai("gpt-4o-mini",),
      system: "Answer user question based on the images given, if information doesnt exists in images, simply say you dont know",
      messages: [
        {
          role: 'user',
          content: content
        }
      ]
    });

    const { text } = result
    console.log(text)
    return text
    // return result.text
  },
};


const getKG = {
  description: `Mendapatkan informasi tambahan dari knowledge graph, gunakan informasi tersebut untuk menjawab pertanyaan user
  mengenai pendefinisian dari europa`,
  parameters: RAGSchema,
  execute: async ({ query }: RAGParams) => {
    const data = await fetchKG(query)

    const { result } = data
    console.log(result)
    return result
    // return result.text
  },
}

export async function POST(req: Request) {
  const { messages }: { messages: Message[] } = await req.json();

  const result = await streamText({
    model: openai("gpt-4o-mini"),
    system: `Anda adalah seorang pakar di website https://e-katalog.lkpp.go.id/. 
      Jawab pertanyaan atau tanggapan pengguna hanya dalam bahasa Indonesia.
      `,
    messages: convertToCoreMessages(messages),

    tools: { getRAG, getWeather, getKG },
  });

  return result.toDataStreamResponse();
}
