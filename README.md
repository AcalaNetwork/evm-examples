# Acala EVM Examples

## Start a development chain

### Use Docker

You can use docker to run a development Acala Mandala chain

```bash
$ docker run --rm -it -p 9944:9944 acala/acala-node:0.7.2 --dev --instant-sealing --ws-external
```

### Build & Run from source code

Or you can build & run from the Acala repo.

Follow the setup instruction at https://github.com/AcalaNetwork/Acala

Start the chain with evm compatibility mode:

```bash
$ make run-eth
```

### Build and Run an example

- cd into one of the example project
- Install dependencies with `yarn`
- Compile contract with `yarn build`
  - You can find your contract ABI in the build directory. You can upload these ABI files to [acala evm playground](https://evm.acala.network/#/upload) for testing.
- Run the tests with `yarn test`

The test cases are written with with [ethers.js](https://docs.ethers.io/v5/) and [waffle](https://ethereum-waffle.readthedocs.io/en/latest/)
