// Apuestas en Solana DEVNET (el SOL es de prueba, no vale nada).
const { Connection, Keypair, PublicKey, SystemProgram, Transaction, LAMPORTS_PER_SOL, clusterApiUrl, sendAndConfirmTransaction } = solanaWeb3;

const conn = new Connection(clusterApiUrl('devnet'), 'confirmed');
const explorer = sig => `https://explorer.solana.com/tx/${sig}?cluster=devnet`;

// ponytail: la clave del pozo vive en el navegador (localStorage). Sirve solo para devnet;
// con plata real habría que usar un contrato (programa Anchor) que guarde el pozo.
const pot = (() => {
  try {
    const saved = localStorage.getItem('potSecret');
    if (saved) return Keypair.fromSecretKey(Uint8Array.from(JSON.parse(saved)));
  } catch {}
  const kp = Keypair.generate();
  try { localStorage.setItem('potSecret', JSON.stringify([...kp.secretKey])); } catch {}
  return kp;
})();

// Quién apostó y cuánto. Se guarda para poder devolver aunque se recargue la página.
const bet = (() => {
  try {
    const b = JSON.parse(localStorage.getItem('bet'));
    if (b) return { lamports: b.lamports, players: b.players.map(p => p && new PublicKey(p)) };
  } catch {}
  return { lamports: 0, players: [null, null] };
})();

function saveBet() {
  try { localStorage.setItem('bet', JSON.stringify({ lamports: bet.lamports, players: bet.players.map(p => p?.toBase58() ?? null) })); } catch {}
}

function phantom() {
  const p = window.phantom?.solana;
  if (!p?.isPhantom) throw new Error('Instalá la billetera Phantom');
  return p;
}

// El jugador i firma con Phantom un envío de `sol` al pozo.
async function deposit(i, sol) {
  const p = phantom();
  const { publicKey } = await p.connect();
  if (bet.players[1 - i]?.equals(publicKey)) throw new Error('Esa cuenta ya apostó: cambiá de cuenta en Phantom');
  const lamports = Math.round(sol * LAMPORTS_PER_SOL);
  if (!(lamports > 0)) throw new Error('Monto inválido');

  const tx = new Transaction().add(SystemProgram.transfer({ fromPubkey: publicKey, toPubkey: pot.publicKey, lamports }));
  tx.feePayer = publicKey;
  tx.recentBlockhash = (await conn.getLatestBlockhash()).blockhash;
  const { signature } = await p.signAndSendTransaction(tx);
  await conn.confirmTransaction(signature, 'confirmed');

  bet.players[i] = publicKey;
  bet.lamports = lamports;
  saveBet();
  return signature;
}

// El pozo paga (firma el juego con la clave del pozo).
function pay(to, lamports) {
  const tx = new Transaction().add(SystemProgram.transfer({ fromPubkey: pot.publicKey, toPubkey: to, lamports }));
  return sendAndConfirmTransaction(conn, tx, [pot]);
}

async function payWinner(i) {
  const sig = await pay(bet.players[i], bet.lamports * 2);
  bet.players = [null, null];
  bet.lamports = 0;
  saveBet();
  return sig;
}

async function refund() {
  const sigs = [];
  for (const [i, p] of bet.players.entries()) {
    if (!p) continue;
    sigs.push(await pay(p, bet.lamports));
    bet.players[i] = null; // se guarda uno por uno: si falla el segundo, no se le devuelve dos veces al primero
    saveBet();
  }
  bet.lamports = 0;
  saveBet();
  return sigs;
}

async function potBalance() {
  return (await conn.getBalance(pot.publicKey)) / LAMPORTS_PER_SOL;
}

async function airdropPot() {
  const sig = await conn.requestAirdrop(pot.publicKey, LAMPORTS_PER_SOL);
  await conn.confirmTransaction(sig, 'confirmed');
}
