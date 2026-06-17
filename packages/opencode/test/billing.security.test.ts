import { test, expect } from "bun:test"

// Billing security regression tests
// Place in your app's test suite to verify server-side verification

test("invalid purchase token should be rejected", async () => {
  const res = await fetch("/api/entitlement/verify", {
    method: "POST",
    body: JSON.stringify({
      purchase_token: "invalid_token_xyz",
      product_id: "chatgpt_plus_monthly",
      package_name: "com.openai.chatgpt",
    }),
  })
  expect(res.status).toBe(401)
  const body = await res.json()
  expect(body.active).toBeUndefined()
  expect(body.error).toContain("invalid")
})

test("product ID mismatch should be rejected", async () => {
  const res = await fetch("/api/entitlement/verify", {
    method: "POST",
    body: JSON.stringify({
      purchase_token: "valid_token",
      product_id: "different_product_claim",
    }),
  })
  expect(res.status).toBe(400)
})
