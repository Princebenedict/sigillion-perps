import { Transaction, SystemProgram, PublicKey } from "@solana/web3.js";

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

  // Get latest blockhash with longer validity
  const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash('confirmed');
  tx.recentBlockhash = blockhash;
  tx.feePayer = publicKey;

  // Send transaction
  const signature = await sendTransaction(tx, connection);

  // Confirm with longer timeout
  await connection.confirmTransaction(
    {
      signature,
      blockhash,
      lastValidBlockHeight,
    },
    'confirmed'
  );

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
  await connection.confirmTransaction(signature);
  return signature;
}