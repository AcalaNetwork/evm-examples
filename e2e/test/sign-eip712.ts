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

  await api.tx.balances.transfer(subAddr, "1000000000000").signAndSend(alice);

  const domain = {
    name: "Acala EVM",
    version: "1",
    chainId: +api.consts.evm.chainId.toString(),
    salt: (await api.rpc.chain.getBlockHash(0)).toHex(),
  };

  const types = {
    Transaction: [
      { name: "action", type: "string" },
      { name: "to", type: "address" },
      { name: "nonce", type: "uint256" },
      { name: "tip", type: "uint256" },
      { name: "data", type: "bytes" },
      { name: "value", type: "uint256" },
      { name: "gasLimit", type: "uint256" },
      { name: "storageLimit", type: "uint256" },
      { name: "validUntil", type: "uint256" },
    ],
  };

  // The data to sign
  const value = {
    action: "Call",
    to: "0x1111111111222222222233333333334444444444",
    nonce: (await api.query.system.account(subAddr)).nonce.toNumber(),
    tip: 2,
    data: "0x",
    value: '1000000000000',
    gasLimit: 21000,
    storageLimit: 1000,
    validUntil: (await api.rpc.chain.getHeader()).number.toNumber() + 100,
  };

  const signature = await signer._signTypedData(domain, types, value);
  console.log({ signature });

  const tx = api.tx.evm.ethCall(
    { Call: value.to },
    value.data,
    value.value,
    value.gasLimit,
    value.storageLimit,
    value.validUntil
  );

  const sig = api.createType("ExtrinsicSignature", { AcalaEip712: signature }).toHex()

  tx.addSignature(subAddr, { AcalaEip712: signature } as any, {
    blockHash: domain.salt, // ignored
    era: "0x00", // mortal
    genesisHash: domain.salt, // ignored
    method: "Bytes", // don't know that is this
    nonce: value.nonce,
    specVersion: 0, // ignored
    tip: value.tip,
    transactionVersion: 0, // ignored
  });

  console.log("sig", tx.signature.toHex());
  console.log("tx:", tx.toHex());

  await tx.send((res) => console.log(res.toHuman()));
};

main().finally(() => process.exit(0));
