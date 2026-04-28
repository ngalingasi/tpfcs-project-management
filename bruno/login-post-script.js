const data = res.getBody();

if (data && data.tokens && data.tokens.access) {
  bru.setEnvVar("access_token", data.tokens.access.token);
  bru.setEnvVar("refresh_token", data.tokens.refresh.token);
  console.log("✅ Tokens saved to environment!");
  console.log("Access token expires:", data.tokens.access.expires);
  console.log("Refresh token expires:", data.tokens.refresh.expires);
} else {
  console.log("❌ Login failed - no tokens in response");
  console.log("Response:", JSON.stringify(data));
}
