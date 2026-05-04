import asyncio
from openai import AsyncOpenAI

async def main():
    # Initialize the AsyncOpenAI client
    client = AsyncOpenAI(
        api_key="sk-hO8-SuEZkNdMzl3110bgpA",
        base_url="https://llmapi05.datapatterns.co.in/v1"
    )

    try:
        # Create a non-streaming completion
        response = await client.chat.completions.create(
            model="coder02",
            messages=[{"role": "user", "content": "what is AI?"}],
            max_tokens=1024,
            temperature=0.15,
            top_p=1.00,
            stream=False
        )

        # Print the formalized content
        print(response.choices[0].message.content)

    except Exception as e:
        print(f"Error: {e}")

if __name__ == "__main__":
    asyncio.run(main())
