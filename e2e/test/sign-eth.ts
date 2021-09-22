import { Wallet } from "@ethersproject/wallet";
import { ethers } from "ethers";
import { options } from "@acala-network/api";
import { ApiPromise, WsProvider } from "@polkadot/api";
import { hexToU8a, u8aConcat, stringToU8a } from "@polkadot/util";
import { encodeAddress } from "@polkadot/keyring";
import { createTestPairs } from "@polkadot/keyring/testingPairs";

const main = async () => {
  const api = await ApiPromise.create(
    options({
      provider: new WsProvider("ws://localhost:9944"),
      types: {
        TransactionAction: {
          _enum: {
            Call: "H160",
            Create: "Null",
          },
        },
        ExtrinsicSignature: {
          _enum: {
            Ed25519: "Ed25519Signature",
            Sr25519: "Sr25519Signature",
            Ecdsa: "EcdsaSignature",
            Ethereum: "[u8; 65]",
            AcalaEip712: "[u8; 65]",
          },
        },
      },
    })
  );

  const signer = new Wallet(
    "0x0123456789012345678901234567890123456789012345678901234567890123"
  );

  const subAddr = encodeAddress(
    u8aConcat(
      stringToU8a("evm:"),
      hexToU8a(signer.address),
      new Uint8Array(8).fill(0)
    )
  );

  console.log(subAddr);

  const testPairs = createTestPairs();
  const alice = testPairs.alice;

  // await api.tx.balances.transfer(subAddr, "1000000000000").signAndSend(alice);

  const chanid = +api.consts.evm.chainId.toString()
  const nonce = (await api.query.system.account(subAddr)).nonce.toNumber()
  const validUntil = (await api.rpc.chain.getHeader()).number.toNumber() + 100
  const storageLimit = 100

  console.log({ nonce, validUntil })

  const gasPrice = '0x' + (BigInt(storageLimit) << BigInt(32) | BigInt(validUntil)).toString(16);

  console.log(gasPrice)

  const value = {
    to: '0x1111111111222222222233333333334444444444',
    nonce,
    gasLimit: 21000,
    gasPrice,
    data: '0x',
    value: 123123,
    chainId: chanid,
  }

  console.log(value)

  const signedTx = await signer.signTransaction(value)

  console.log(signedTx)

  const rawtx = ethers.utils.parseTransaction(signedTx)
  console.log(rawtx)

  const sig = ethers.utils.joinSignature({ r: rawtx.r!, s: rawtx.s, v: rawtx.v })

  console.log({sig})

  const tx = api.tx.evm.ethCall(
    { Call: value.to },
    value.data,
    value.value,
    value.gasLimit,
    storageLimit,
    validUntil
  );

  tx.addSignature(subAddr, { Ethereum: sig } as any, {
    blockHash: '0x', // ignored
    era: "0x00", // mortal
    genesisHash: '0x', // ignored
    method: "Bytes", // don't know that is this
    nonce: nonce,
    specVersion: 0, // ignored
    tip: 0,
    transactionVersion: 0, // ignored
  });

  console.log("sig", tx.signature.toHex());
  console.log("tx:", tx.toHex());

  await tx.send((res) => console.log(res.toHuman()));
};

main().catch(x => console.error(x)).finally(() => process.exit(0));

