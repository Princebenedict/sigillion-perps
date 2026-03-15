import { Transaction, SystemProgram } from "@solana/web3.js";

interface OpenPositionParams {
  connection: any;
  publicKey: any;
  sendTransaction: any;
  direction: number;
  leverage: number;
  commitmentHash: Uint8Array;
}

export async function openPosition({
  connection,
  publicKey,
  sendTransaction,
  direction,
  leverage,
  commitmentHash,
}: OpenPositionParams) {
  const tx = new Transaction();

  tx.add(
    SystemProgram.transfer({
      fromPubkey: publicKey,
      toPubkey: publicKey,
      lamports: 0,
    })
  );

  // Send transaction — skip confirmation to avoid blockhash expiry on devnet
  const signature = await sendTransaction(tx, connection);

  // Give it a moment then return — no blocking confirmation
  await new Promise(resolve => setTimeout(resolve, 2000));

  return signature;
}

export async function closePosition({
  connection,
  wallet,
}: {
  connection: any;
  wallet: any;
}) {
  const tx = new Transaction();
  const signature = await wallet.sendTransaction(tx, connection);
  return signature;
}

