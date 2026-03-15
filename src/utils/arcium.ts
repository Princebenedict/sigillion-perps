export async function submitToArcium({
  size,
  direction,
  leverage,
}: {
  size: number;
  direction: "LONG" | "SHORT";
  leverage: number;
}) {
  const nonce = window.crypto.getRandomValues(new Uint8Array(32));
  const encoder = new TextEncoder();
  const data = encoder.encode(
    size + ":" + direction + ":" + Array.from(nonce).join(",")
  );
  const hashBuffer = await window.crypto.subtle.digest("SHA-256", data.buffer as ArrayBuffer);
  return {
    commitmentHash: new Uint8Array(hashBuffer),
    arciumJobId: "arcium_" + Date.now(),
  };
}
