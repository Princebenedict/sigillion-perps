import {
  Transaction,
  SystemProgram,
} from "@solana/web3.js";

export async function openPosition({
  connection,
  publicKey,
  sendTransaction,
  direction,
  leverage,
  commitmentHash,
}: any) {
  const tx = new Transaction();

  const instruction = SystemProgram.transfer({
    fromPubkey: publicKey,
    toPubkey: publicKey,
    lamports: 0,
  });

  tx.add(instruction);

  const signature = await sendTransaction(tx, connection);
  await connection.confirmTransaction(signature);

  return signature;
}

export async function closePosition({ connection, wallet }: any) {
  const tx = new Transaction();

  const signature = await wallet.sendTransaction(tx, connection);
  await connection.confirmTransaction(signature);

  return signature;
}