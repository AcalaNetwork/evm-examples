# Acala EVM Examples

ETHDenver Workshop Link: https://www.crowdcast.io/e/acala-ethdenver-2021

This workshop is for learning to use Acala EVM. It demonstrates how to deploy a simple ERC20 contract, a complex project like Uniswap, and use the on-chain scheduler function to build a recurring payment DApp.

Read more about Acala EVM [here](https://wiki.acala.network/learn/basics/acala-evm)
Developer Guide [here](https://wiki.acala.network/build/development-guide/smart-contracts/get-started-evm)

## Run Local Dev Node

Or you can build & run from the Acala repo.

Follow the setup instruction at https://github.com/AcalaNetwork/Acala

Start the chain:

```bash
$ cargo run --features with-mandala-runtime -- --dev -lruntime=debug -levm=debug --instant-sealing --ws-port=9944 --ws-external=true --rpc-port=9933 --rpc-external=true --rpc-cors=all --rpc-methods=unsafe --tmp
```

### Build and Run an example

- cd into one of the example project
- Install dependencies with `yarn`
- Compile contract with `yarn build`
  - You can find your contract ABI in the build directory. You can upload these ABI files to [acala evm playground](https://evm.acala.network/#/upload) for testing.
- Run the tests with `yarn test` or `yarn test --with-ethereum-compatibility` with the chain which enable evm compatibility mode.

The test cases are written with with [ethers.js](https://docs.ethers.io/v5/) and [waffle](https://ethereum-waffle.readthedocs.io/en/latest/)
