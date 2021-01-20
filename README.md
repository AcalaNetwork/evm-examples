# acala evm examples

## How to use?

### Start a test chain locally

Documentation for acala chain: https://github.com/AcalaNetwork/Acala. Start the chain with evm: 

```bash
$ make run-eth
```

### Installing javascript dependencies

In the erc20 directory, run `yarn` or `npm install`.

### Compilation Contract

In the erc20 directory, run `yarn build` or `npm run build`.

You can find your contract abi in the build directory. You can upload these abi files to [acala evm playground](https://acala-evm.vercel.app/#/upload) for testing.

### Run test cases

In the erc20 directory, run `yarn test` or `npm run test`. 

The test cases are compatible with [ethers.js](https://docs.ethers.io/v5/) and [waffle](https://ethereum-waffle.readthedocs.io/en/latest/)
