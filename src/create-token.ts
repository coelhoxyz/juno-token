import { Keypair, Connection, PublicKey, clusterApiUrl } from '@solana/web3.js';
import { createMint, getOrCreateAssociatedTokenAccount, mintTo, TOKEN_2022_PROGRAM_ID } from '@solana/spl-token';
import { Metaplex, keypairIdentity, irysStorage } from '@metaplex-foundation/js';
import * as fs from 'fs';
import * as path from 'path'; // Import path module

async function createToken() {
    // Connect to Devnet
    const connection = new Connection(clusterApiUrl('devnet'), 'confirmed');

    // Define the path for the wallet file
    const walletPath = path.join(__dirname, 'wallet.json');
    let walletKeypair: Keypair;

    // Check if wallet file exists
    if (fs.existsSync(walletPath)) {
        // Load wallet from file
        const secretKey = Uint8Array.from(JSON.parse(fs.readFileSync(walletPath, 'utf8')));
        walletKeypair = Keypair.fromSecretKey(secretKey);
        console.log('Loaded wallet from', walletPath);
    } else {
        // Generate new wallet and save to file
        walletKeypair = Keypair.generate();
        fs.writeFileSync(walletPath, JSON.stringify(Array.from(walletKeypair.secretKey)));
        console.log('Generated new wallet and saved to', walletPath);
    }

    // Airdrop SOL to the wallet if needed (e.g., 1 SOL)
    const lamportsNeeded = 1 * 1000000000; // 1 SOL = 1,000,000,000 lamports
    const balance = await connection.getBalance(walletKeypair.publicKey);
    if (balance < lamportsNeeded) {
        console.log('Airdropping 1 SOL to', walletKeypair.publicKey.toBase58());
        const airdropSignature = await connection.requestAirdrop(
            walletKeypair.publicKey,
            lamportsNeeded
        );
        const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash();
        await connection.confirmTransaction({
            blockhash,
            lastValidBlockHeight,
            signature: airdropSignature,
        });
        console.log('Airdrop complete. New balance:', await connection.getBalance(walletKeypair.publicKey) / 1000000000, 'SOL');
    } else {
        console.log('Wallet has sufficient SOL:', balance / 1000000000, 'SOL');
    }

    // Create a new mint (token)
    const mint = await createMint(
        connection,
        walletKeypair, // Payer
        walletKeypair.publicKey, // Mint authority
        null, // Freeze authority (null for immutable)
        9, // Decimals
        undefined, // Keypair for mint (auto-generated)
        { commitment: 'confirmed' },
        TOKEN_2022_PROGRAM_ID // Use Token-2022 program for metadata support
    );
    console.log('Token Mint Address:', mint.toBase58());

    // Create associated token account
    const tokenAccount = await getOrCreateAssociatedTokenAccount(
        connection,
        walletKeypair,
        mint,
        walletKeypair.publicKey,
        false,
        'confirmed',
        undefined,
        TOKEN_2022_PROGRAM_ID
    );
    console.log('Token Account Address:', tokenAccount.address.toBase58());

    // Mint tokens (e.g., 1,000,000)
    await mintTo(
        connection,
        walletKeypair,
        mint,
        tokenAccount.address,
        walletKeypair,
        1_000_000_000_000_000_000, // 1B tokens (9 decimals)
        [],
        { commitment: 'confirmed' },
        TOKEN_2022_PROGRAM_ID
    );
    console.log('Minted 1,000,000,000,000,000,000 tokens to', tokenAccount.address.toBase58());

    // Set up Metaplex for metadata
    const metaplex = Metaplex.make(connection)
        .use(keypairIdentity(walletKeypair))
        .use(irysStorage({ address: 'https://devnet.bundlr.network', providerUrl: clusterApiUrl('devnet') }));

    // Add metadata
    await metaplex.nfts().create({
        uri: 'https://arweave.net/your_metadata_hash', // Replace with your metadata URI
        name: 'YourTokenName',
        symbol: 'YTN',
        sellerFeeBasisPoints: 500, // 5% royalty
        tokenOwner: walletKeypair.publicKey,
        isMutable: true,
    });
    console.log('Metadata added to token');
}

createToken().catch(console.error);