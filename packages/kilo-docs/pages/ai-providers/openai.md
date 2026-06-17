---
title: "Using OpenAI with Kilo Code | Setup & Models"
description: "Connect the official OpenAI API to Kilo Code. Step-by-step guide to creating an API key and configuring GPT models in VS Code and the CLI."
sidebar_label: OpenAI
---

# Using OpenAI With Kilo Code

Kilo Code supports accessing models directly through the official OpenAI API.

**Website:** [https://openai.com/](https://openai.com/)

{% callout type="tip" %}
**Already have a ChatGPT Plus or Pro subscription?** You can use it to access OpenAI's Codex models inside Kilo Code — no separate API key or pay-as-you-go charges needed. See the [ChatGPT Plus/Pro provider page](/docs/ai-providers/openai-chatgpt-plus-pro) for setup instructions.
{% /callout %}

## Getting an API Key

1.  **Sign Up/Sign In:** Go to the [OpenAI Platform](https://platform.openai.com/). Create an account or sign in.
2.  **Navigate to API Keys:** Go to the [API keys](https://platform.openai.com/api-keys) page.
3.  **Create a Key:** Click "Create new secret key". Give your key a descriptive name (e.g., "Kilo Code").
4.  **Copy the Key:** **Important:** Copy the API key _immediately_. You will not be able to see it again. Store it securely.

## Configuration in Kilo Code

1.  **Open Kilo Code Settings:** Click the gear icon ({% codicon name="gear" /%}) in the Kilo Code panel.
2.  **Select Provider:** Choose "OpenAI" from the "API Provider" dropdown.
3.  **Enter API Key:** Paste your OpenAI API key into the "OpenAI API Key" field.
4.  **Select Model:** Choose your desired model from the "Model" dropdown.

## Tips and Notes

- **Pricing:** Refer to the [OpenAI Pricing](https://openai.com/pricing) page for details on model costs.
- **Azure OpenAI Service:** Use Kilo Code's native `azure` provider for Azure OpenAI, especially GPT-5 deployments. Do not configure Azure GPT-5 through a generic [OpenAI-compatible](/docs/ai-providers/openai-compatible) custom provider.
